"""
remove-bg-v8.py — Pipeline mejorado (VITMatte sobre 2x para bordes nitidos).

vs v7: VITMatte ahora corre sobre la imagen 2x (1024x768) en vez de 1x.
       4x mas detalle para refinar borde de suela / cordones / costuras.
       Aun bancable en RAM (4x menos workload que en 4x original que crasheaba).

Steps por frame:
  1) Real-ESRGAN 4x (animevideov3, GPU AMD con tile 64)
  2) isnet alpha_matting sobre 4x (mejor segmentacion)
  3) Downscale RGB y alpha a 2x con LANCZOS
  4) Trimap thin 4/4 px sobre alpha 2x
  5) VITMatte sobre RGB_2x + trimap_2x → alpha refinado 2x
  6) Downscale alpha 2x → 1x con LANCZOS (super-sampling de bordes)
  7) Compose RGB ORIGINAL + alpha 1x (premultiplied, textura intacta)

Resume: si el archivo de salida ya existe, lo saltea (permite re-correr).
"""
import argparse
import glob
import os
import shutil
import subprocess
import sys
import tempfile
import time
import gc
from pathlib import Path

import numpy as np
from PIL import Image
import cv2
import torch
from transformers import VitMatteForImageMatting, VitMatteImageProcessor
from rembg import remove, new_session


SUPPORTED_EXTS = (".jpg", ".jpeg", ".png", ".webp", ".bmp")
PROJECT_ROOT = Path(__file__).resolve().parent.parent.parent
REALESRGAN_BIN = PROJECT_ROOT / "tools" / "realesrgan" / "realesrgan-ncnn-vulkan.exe"

_VITMATTE_MODEL = None
_VITMATTE_PROCESSOR = None
_REMBG_SESSION = None


def load_vitmatte():
    global _VITMATTE_MODEL, _VITMATTE_PROCESSOR
    if _VITMATTE_MODEL is not None:
        return _VITMATTE_MODEL, _VITMATTE_PROCESSOR
    print("[INFO] cargando VITMatte-small...", flush=True)
    _VITMATTE_PROCESSOR = VitMatteImageProcessor.from_pretrained("hustvl/vitmatte-small-composition-1k")
    _VITMATTE_MODEL = VitMatteForImageMatting.from_pretrained("hustvl/vitmatte-small-composition-1k")
    _VITMATTE_MODEL.eval()
    return _VITMATTE_MODEL, _VITMATTE_PROCESSOR


def load_rembg():
    global _REMBG_SESSION
    if _REMBG_SESSION is None:
        _REMBG_SESSION = new_session("isnet-general-use")
    return _REMBG_SESSION


def mask_to_trimap(mask: np.ndarray, erode_size: int = 4, dilate_size: int = 4) -> np.ndarray:
    binary = (mask > 127).astype(np.uint8) * 255
    fg = cv2.erode(binary, np.ones((erode_size, erode_size), np.uint8), iterations=1)
    bg = cv2.dilate(binary, np.ones((dilate_size, dilate_size), np.uint8), iterations=1)
    trimap = np.full_like(binary, 128)
    trimap[fg == 255] = 255
    trimap[bg == 0] = 0
    return trimap


def vitmatte_refine(rgb: np.ndarray, trimap: np.ndarray) -> np.ndarray:
    model, processor = load_vitmatte()
    pil_img = Image.fromarray(rgb).convert("RGB")
    pil_tri = Image.fromarray(trimap).convert("L")
    inputs = processor(images=pil_img, trimaps=pil_tri, return_tensors="pt")
    with torch.no_grad():
        outputs = model(**inputs)
    alpha = outputs.alphas[0, 0].cpu().numpy()
    alpha = (alpha * 255).clip(0, 255).astype(np.uint8)
    if alpha.shape != trimap.shape:
        alpha = cv2.resize(alpha, (trimap.shape[1], trimap.shape[0]),
                           interpolation=cv2.INTER_LINEAR)
    # Liberar memoria intermedia
    del inputs, outputs
    gc.collect()
    return alpha


def compose_rgba(rgb: np.ndarray, alpha: np.ndarray) -> np.ndarray:
    """Premultiplied alpha."""
    rgb_f = rgb.astype(np.float32)
    weight = (alpha.astype(np.float32) / 255.0)[:, :, None]
    rgb_premul = (rgb_f * weight).clip(0, 255).astype(np.uint8)
    return np.dstack([rgb_premul, alpha])


def upscale_realesrgan(in_path: Path, out_path: Path) -> None:
    subprocess.run([
        str(REALESRGAN_BIN),
        "-i", str(in_path),
        "-o", str(out_path),
        "-n", "realesr-animevideov3",
        "-s", "4",
        "-t", "64",
        "-j", "1:1:1",
    ], check=True, stdout=subprocess.DEVNULL, stderr=subprocess.PIPE)


def process_one(in_path: Path, out_path: Path, tmp_dir: Path) -> None:
    # 1) RGB original — textura final
    orig_pil = Image.open(in_path).convert("RGB")
    orig_rgb = np.array(orig_pil)
    orig_size = orig_pil.size  # (W, H)
    size_2x = (orig_size[0] * 2, orig_size[1] * 2)  # 1024x768

    # 2) Upscale 4x con Real-ESRGAN
    tmp_in = tmp_dir / "in.png"
    tmp_up = tmp_dir / "up.png"
    orig_pil.save(tmp_in)
    upscale_realesrgan(tmp_in, tmp_up)
    up_pil = Image.open(tmp_up).convert("RGB")  # 2048x1536

    # 3) isnet alpha_matting sobre la upscaleada 4x
    session = load_rembg()
    cutout_up = remove(
        up_pil,
        session=session,
        alpha_matting=True,
        alpha_matting_foreground_threshold=240,
        alpha_matting_background_threshold=15,
        alpha_matting_erode_size=4,
    )
    isnet_alpha_4x = np.array(cutout_up)[:, :, 3]

    # 4) Downscale RGB y alpha a 2x (1024x768) — sweet spot RAM/calidad
    rgb_2x = np.array(up_pil.resize(size_2x, Image.LANCZOS))
    alpha_2x = np.array(Image.fromarray(isnet_alpha_4x, "L").resize(size_2x, Image.LANCZOS))
    del up_pil, cutout_up, isnet_alpha_4x
    gc.collect()

    # 5) Trimap sobre alpha 2x (banda 4/4 = ~8 px en escala 2x)
    trimap_2x = mask_to_trimap(alpha_2x, erode_size=4, dilate_size=4)

    # 6) VITMatte refine sobre 2x (4x menos workload que 4x — banca en RAM)
    alpha_refined_2x = vitmatte_refine(rgb_2x, trimap_2x)
    del rgb_2x, trimap_2x, alpha_2x
    gc.collect()

    # 7) Downscale alpha 2x → 1x con LANCZOS (super-sampling preserva bordes)
    alpha_final = np.array(Image.fromarray(alpha_refined_2x, "L").resize(orig_size, Image.LANCZOS))
    del alpha_refined_2x

    # 8) Compose con RGB ORIGINAL — textura intacta + alpha refinado
    rgba_final = compose_rgba(orig_rgb, alpha_final)
    Image.fromarray(rgba_final, mode="RGBA").save(out_path, optimize=True)


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("input_dir")
    ap.add_argument("--output", default=None)
    args = ap.parse_args()

    input_dir = Path(args.input_dir).resolve()
    if not input_dir.is_dir():
        print(f"[ERR] no existe: {input_dir}", file=sys.stderr)
        return 1

    output_dir = Path(args.output) if args.output else input_dir / "transparent"
    output_dir.mkdir(parents=True, exist_ok=True)

    inputs = []
    for ext in SUPPORTED_EXTS:
        inputs.extend(input_dir.glob(f"*{ext}"))
        inputs.extend(input_dir.glob(f"*{ext.upper()}"))
    inputs = sorted(set(inputs))

    if not inputs:
        print(f"[ERR] no hay imagenes en {input_dir}", file=sys.stderr)
        return 1

    print(f"[INFO] entrada : {input_dir}")
    print(f"[INFO] salida  : {output_dir}")
    print(f"[INFO] imagenes: {len(inputs)}")
    print(f"[INFO] VITMatte sobre 2x (1024x768) — 4x mas detalle que v7\n", flush=True)

    tmp_dir = Path(tempfile.mkdtemp(prefix="v8_"))
    print(f"[INFO] tmp: {tmp_dir}\n", flush=True)

    t0 = time.time()
    try:
        for i, in_path in enumerate(inputs):
            out_path = output_dir / (in_path.stem + ".png")
            if out_path.exists() and out_path.stat().st_size > 0:
                n = i + 1
                print(f"  [{n}/{len(inputs)}] {in_path.name:30s} (skip)", flush=True)
                continue
            t_frame = time.time()
            try:
                process_one(in_path, out_path, tmp_dir)
            except Exception as e:
                print(f"[ERR] {in_path.name}: {e}", file=sys.stderr, flush=True)
                continue
            dt = time.time() - t_frame
            n = i + 1
            elapsed = time.time() - t0
            eta = elapsed * (len(inputs) - n) / n
            print(f"  [{n}/{len(inputs)}] {in_path.name:30s} {dt:5.1f}s   ETA {eta:5.0f}s", flush=True)
            gc.collect()
    finally:
        shutil.rmtree(tmp_dir, ignore_errors=True)

    print()
    print(f"[OK] terminado en {time.time() - t0:.0f}s — {len(inputs)} frames", flush=True)
    print(f"[OUT] {output_dir}", flush=True)
    return 0


if __name__ == "__main__":
    sys.exit(main())
