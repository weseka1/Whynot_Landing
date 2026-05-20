"""
remove-bg-v7.py — Pipeline FINAL:
  1) Real-ESRGAN 4x upscale (modelo animevideo, liviano)
  2) isnet-general-use con alpha_matting sobre el upscaled
  3) VITMatte refine con trimap thin (6/6 px en escala 4x)
  4) Downscale del alpha a tamaño original con LANCZOS (super-sample)
  5) Compose con RGB ORIGINAL (textura intacta) + premultiplied alpha

Mejor de los dos mundos: bordes ultra-precisos del 4x + textura natural.

Uso:
  py -3.11 remove-bg-v7.py "C:/path/to/folder"
"""
import argparse
import glob
import os
import shutil
import subprocess
import sys
import tempfile
import time
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
    print("[INFO] cargando VITMatte-small...")
    _VITMATTE_PROCESSOR = VitMatteImageProcessor.from_pretrained("hustvl/vitmatte-small-composition-1k")
    _VITMATTE_MODEL = VitMatteForImageMatting.from_pretrained("hustvl/vitmatte-small-composition-1k")
    _VITMATTE_MODEL.eval()
    return _VITMATTE_MODEL, _VITMATTE_PROCESSOR


def load_rembg():
    global _REMBG_SESSION
    if _REMBG_SESSION is None:
        _REMBG_SESSION = new_session("isnet-general-use")
    return _REMBG_SESSION


def mask_to_trimap(mask: np.ndarray, erode_size: int = 6, dilate_size: int = 6) -> np.ndarray:
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
    return alpha


def compose_rgba(rgb: np.ndarray, alpha: np.ndarray) -> np.ndarray:
    """Premultiplied alpha — sin halo claro en bordes contra fondos oscuros."""
    rgb_f = rgb.astype(np.float32)
    weight = (alpha.astype(np.float32) / 255.0)[:, :, None]
    rgb_premul = (rgb_f * weight).clip(0, 255).astype(np.uint8)
    return np.dstack([rgb_premul, alpha])


def upscale_realesrgan(in_path: Path, out_path: Path, model: str = "realesr-animevideov3") -> None:
    """Real-ESRGAN ncnn-vulkan, 4x. Modelo liviano para GPU AMD limitada."""
    subprocess.run([
        str(REALESRGAN_BIN),
        "-i", str(in_path),
        "-o", str(out_path),
        "-n", model,
        "-s", "4",
        "-t", "64",
        "-j", "1:1:1",
    ], check=True, stdout=subprocess.DEVNULL, stderr=subprocess.PIPE)


def process_one(in_path: Path, out_path: Path, tmp_dir: Path) -> None:
    """Pipeline OPTIMIZADO para no agotar RAM:
       - Real-ESRGAN 4x sobre original (GPU)
       - isnet sobre 4x (mejor detalle de mascara)
       - DOWNSCALE el alpha de isnet a 1x ← clave: VITMatte ahora trabaja
         sobre 512x384 en vez de 2048x1536 (16x menos workload, evita OOM)
       - VITMatte refine sobre RGB original 512x384 + trimap 512x384
       - Compose con RGB original sin tocar
    """
    # 1) RGB original — textura final
    orig_pil = Image.open(in_path).convert("RGB")
    orig_rgb = np.array(orig_pil)
    orig_size = orig_pil.size  # (W, H)

    # 2) Upscale 4x con Real-ESRGAN (solo para mejor mascara isnet)
    tmp_in = tmp_dir / "in.png"
    tmp_up = tmp_dir / "up.png"
    orig_pil.save(tmp_in)
    upscale_realesrgan(tmp_in, tmp_up)
    up_pil = Image.open(tmp_up).convert("RGB")

    # 3) isnet alpha_matting sobre la upscaleada (mejor segmentacion inicial)
    session = load_rembg()
    cutout_up = remove(
        up_pil,
        session=session,
        alpha_matting=True,
        alpha_matting_foreground_threshold=240,
        alpha_matting_background_threshold=15,
        alpha_matting_erode_size=4,
    )
    isnet_alpha_up = np.array(cutout_up)[:, :, 3]

    # 4) Liberar la imagen upscaleada — VITMatte no la necesita
    del up_pil, cutout_up

    # 5) Downscale del alpha a 1x con LANCZOS (super-sampling preserva bordes)
    alpha_pil = Image.fromarray(isnet_alpha_up, mode="L").resize(orig_size, Image.LANCZOS)
    alpha_1x = np.array(alpha_pil)

    # 6) Trimap a 1x (16x mas chico que antes)
    trimap = mask_to_trimap(alpha_1x, erode_size=2, dilate_size=2)

    # 7) VITMatte refine sobre RGB ORIGINAL 512x384 (16x menos workload)
    alpha_refined = vitmatte_refine(orig_rgb, trimap)

    # 8) Compose: RGB original + alpha refinado
    rgba_final = compose_rgba(orig_rgb, alpha_refined)
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
    print()

    tmp_dir = Path(tempfile.mkdtemp(prefix="v7_"))
    print(f"[INFO] tmp: {tmp_dir}\n")

    t0 = time.time()
    try:
        for i, in_path in enumerate(inputs):
            out_path = output_dir / (in_path.stem + ".png")
            # Resume: skip if already done (permite re-correr si el proceso murio)
            if out_path.exists() and out_path.stat().st_size > 0:
                n = i + 1
                print(f"  [{n}/{len(inputs)}] {in_path.name:30s} (skip — ya existe)", flush=True)
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
            # Liberar memoria entre frames (evita acumulacion de VRAM/RAM)
            import gc
            gc.collect()
    finally:
        shutil.rmtree(tmp_dir, ignore_errors=True)

    print()
    print(f"[OK] terminado en {time.time() - t0:.0f}s — {len(inputs)} frames")
    print(f"[OUT] {output_dir}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
