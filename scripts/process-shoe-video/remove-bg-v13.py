"""
remove-bg-v13.py — pipeline final con ajustes de threshold.

Ajustes vs v12:
- isnet: alpha_matting_foreground_threshold 240 → 200 (mas perdonador,
  menos chance de comer suela/cuero blanco)
- isnet: alpha_matting_background_threshold 10 → 5 (mas estricto bg)
- isnet: alpha_matting_erode_size 2 → 1 (banda unknown mas fina, menos
  ambiguedad)
- POST-MATTING: alpha contrast boost (S-curve) + guided filter final:
  los pixels semi-transparentes "sospechosos" (alpha 60-200) se mueven
  hacia los extremos (0 o 255). Esto elimina los huecos blancos en
  bordes interiores del objeto.
- Tiling 1024 + overlap 256 (igual que v12)
- VITMatte-base (igual que v12)
"""
import argparse
import gc
import shutil
import subprocess
import sys
import tempfile
import time
from pathlib import Path

import numpy as np
import cv2
from PIL import Image
import torch
from transformers import VitMatteForImageMatting, VitMatteImageProcessor
from rembg import remove, new_session


SUPPORTED_EXTS = (".jpg", ".jpeg", ".png", ".webp", ".bmp")
PROJECT_ROOT = Path(__file__).resolve().parent.parent.parent
REALESRGAN_BIN = PROJECT_ROOT / "tools" / "realesrgan" / "realesrgan-ncnn-vulkan.exe"

# Tiling config — tile grande + overlap grande
TILE_SIZE = 1024
OVERLAP = 256

# Alpha boost config (S-curve para eliminar semi-transparencias residuales)
BOOST_LOW = 60   # alpha < 60 → 0 (transparent)
BOOST_HIGH = 200 # alpha > 200 → 255 (solid)

_VITMATTE_MODEL = None
_VITMATTE_PROCESSOR = None
_REMBG_SESSION = None


def load_vitmatte():
    global _VITMATTE_MODEL, _VITMATTE_PROCESSOR
    if _VITMATTE_MODEL is not None:
        return _VITMATTE_MODEL, _VITMATTE_PROCESSOR
    print("[INFO] cargando VITMatte-base...", flush=True)
    _VITMATTE_PROCESSOR = VitMatteImageProcessor.from_pretrained("hustvl/vitmatte-base-composition-1k")
    _VITMATTE_MODEL = VitMatteForImageMatting.from_pretrained("hustvl/vitmatte-base-composition-1k")
    _VITMATTE_MODEL.eval()
    return _VITMATTE_MODEL, _VITMATTE_PROCESSOR


def load_rembg():
    global _REMBG_SESSION
    if _REMBG_SESSION is None:
        _REMBG_SESSION = new_session("isnet-general-use")
    return _REMBG_SESSION


def upscale_realesrgan(in_path: Path, out_path: Path) -> None:
    subprocess.run([
        str(REALESRGAN_BIN),
        "-i", str(in_path),
        "-o", str(out_path),
        "-n", "realesrgan-x4plus-anime",
        "-s", "4",
        "-t", "32",
        "-j", "1:1:1",
    ], check=True, stdout=subprocess.DEVNULL, stderr=subprocess.PIPE)


def mask_to_trimap(mask: np.ndarray, erode_size: int = 12, dilate_size: int = 12) -> np.ndarray:
    binary = (mask > 127).astype(np.uint8) * 255
    fg = cv2.erode(binary, np.ones((erode_size, erode_size), np.uint8), iterations=1)
    bg = cv2.dilate(binary, np.ones((dilate_size, dilate_size), np.uint8), iterations=1)
    trimap = np.full_like(binary, 128)
    trimap[fg == 255] = 255
    trimap[bg == 0] = 0
    return trimap


def vitmatte_refine_tile(rgb: np.ndarray, trimap: np.ndarray) -> np.ndarray:
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
    del inputs, outputs
    return alpha


def feather_mask(h: int, w: int, overlap: int) -> np.ndarray:
    mask = np.ones((h, w), dtype=np.float32)
    if overlap <= 0:
        return mask
    ramp = np.linspace(0, 1, overlap, dtype=np.float32)
    mask[:overlap, :] *= ramp[:, None]
    mask[-overlap:, :] *= ramp[::-1][:, None]
    mask[:, :overlap] *= ramp[None, :]
    mask[:, -overlap:] *= ramp[::-1][None, :]
    return mask


def vitmatte_tiled(rgb: np.ndarray, trimap: np.ndarray,
                   tile_size: int = TILE_SIZE, overlap: int = OVERLAP) -> np.ndarray:
    H, W = trimap.shape
    accum = np.zeros((H, W), dtype=np.float32)
    weight = np.zeros((H, W), dtype=np.float32)
    stride = tile_size - overlap

    y_starts = list(range(0, max(1, H - overlap), stride))
    if y_starts[-1] + tile_size < H:
        y_starts.append(H - tile_size)
    elif y_starts[-1] + tile_size > H:
        y_starts[-1] = max(0, H - tile_size)
    x_starts = list(range(0, max(1, W - overlap), stride))
    if x_starts[-1] + tile_size < W:
        x_starts.append(W - tile_size)
    elif x_starts[-1] + tile_size > W:
        x_starts[-1] = max(0, W - tile_size)

    for y in y_starts:
        for x in x_starts:
            y2 = min(y + tile_size, H)
            x2 = min(x + tile_size, W)
            y1, x1 = y, x
            th, tw = y2 - y1, x2 - x1

            tile_tri = trimap[y1:y2, x1:x2]
            has_unknown = ((tile_tri > 0) & (tile_tri < 255)).any()

            if not has_unknown:
                alpha_tile = tile_tri
            else:
                tile_rgb = rgb[y1:y2, x1:x2]
                alpha_tile = vitmatte_refine_tile(tile_rgb, tile_tri)

            fm = feather_mask(th, tw, overlap)
            accum[y1:y2, x1:x2] += alpha_tile.astype(np.float32) * fm
            weight[y1:y2, x1:x2] += fm
            gc.collect()

    weight = np.maximum(weight, 1e-6)
    return (accum / weight).clip(0, 255).astype(np.uint8)


def alpha_boost(alpha: np.ndarray, low: int = BOOST_LOW, high: int = BOOST_HIGH) -> np.ndarray:
    """S-curve sobre alpha: pixels 0-low → 0, low-high → expanded linear,
    high-255 → 255. Elimina semi-transparencias residuales."""
    a = alpha.astype(np.float32)
    a = (a - low) * 255.0 / (high - low)
    return np.clip(a, 0, 255).astype(np.uint8)


def compose_rgba(rgb: np.ndarray, alpha: np.ndarray) -> np.ndarray:
    rgb_f = rgb.astype(np.float32)
    weight = (alpha.astype(np.float32) / 255.0)[:, :, None]
    rgb_premul = (rgb_f * weight).clip(0, 255).astype(np.uint8)
    return np.dstack([rgb_premul, alpha])


def process_one(in_path: Path, out_path: Path, tmp_dir: Path) -> None:
    # 1) RGB original
    orig_pil = Image.open(in_path).convert("RGB")
    orig_rgb = np.array(orig_pil)
    orig_size = orig_pil.size

    # 2) Upscale 4x con Real-ESRGAN
    tmp_in = tmp_dir / "in.png"
    tmp_up = tmp_dir / "up.png"
    orig_pil.save(tmp_in)
    upscale_realesrgan(tmp_in, tmp_up)
    up_pil = Image.open(tmp_up).convert("RGB")
    rgb_4x = np.array(up_pil)

    # 3) isnet con thresholds MAS PERDONADORES — menos chance de comer
    #    el objeto (suela blanca contra cuero blanco). fg_threshold 240 → 200.
    session = load_rembg()
    cutout_up = remove(
        up_pil,
        session=session,
        alpha_matting=True,
        alpha_matting_foreground_threshold=200,  # mas perdonador
        alpha_matting_background_threshold=5,     # mas estricto bg
        alpha_matting_erode_size=1,               # banda mas fina
    )
    alpha_isnet_4x = np.array(cutout_up)[:, :, 3]
    del up_pil, cutout_up
    gc.collect()

    # 4) Trimap 4x — banda 12/12 px
    trimap_4x = mask_to_trimap(alpha_isnet_4x, erode_size=12, dilate_size=12)
    del alpha_isnet_4x

    # 5) VITMatte-base con tiling
    alpha_refined_4x = vitmatte_tiled(rgb_4x, trimap_4x)
    del rgb_4x, trimap_4x
    gc.collect()

    # 6) Downscale alpha 4x → 1x con LANCZOS
    alpha_1x = np.array(Image.fromarray(alpha_refined_4x, "L").resize(orig_size, Image.LANCZOS))
    del alpha_refined_4x

    # 7) ALPHA BOOST: S-curve elimina semi-transparencias residuales
    #    (pixels 60-200 se mueven a 0 o 255 segun caigan)
    alpha_boosted = alpha_boost(alpha_1x, low=BOOST_LOW, high=BOOST_HIGH)
    del alpha_1x

    # 8) Guided filter sobre el alpha boosted usando RGB original como guia
    #    (recupera bordes nitidos donde la imagen tiene contraste, suaviza
    #    donde es uniforme — sin comer detalle interno)
    bgr_guide = cv2.cvtColor(orig_rgb, cv2.COLOR_RGB2BGR)
    alpha_final = cv2.ximgproc.guidedFilter(
        guide=bgr_guide,
        src=alpha_boosted,
        radius=2,
        eps=1e-4,
    )
    del alpha_boosted

    # 9) Compose
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
    print(f"[INFO] v13: thresholds ajustados + alpha boost + guided filter\n", flush=True)

    tmp_dir = Path(tempfile.mkdtemp(prefix="v13_"))
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
