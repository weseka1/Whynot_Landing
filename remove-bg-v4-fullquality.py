"""
remove-bg-v4-fullquality.py — pipeline que se traba pero sale excelente.
VITMatte procesa imagen 2048x1536 COMPLETA (sin tiling) — ~3GB RAM peak.

Uso: py -3.11 remove-bg-v4-fullquality.py "C:/path/to/folder"
Output: <folder>/transparent/<name>.png (RGBA con alpha real)
"""
import argparse, gc, shutil, subprocess, sys, tempfile, time
from pathlib import Path
import numpy as np
import cv2
from PIL import Image
import torch
from transformers import VitMatteForImageMatting, VitMatteImageProcessor
from rembg import remove, new_session

SUPPORTED_EXTS = (".jpg", ".jpeg", ".png", ".webp", ".bmp")
PROJECT_ROOT = Path(__file__).resolve().parent
REALESRGAN_BIN = PROJECT_ROOT / "tools" / "realesrgan" / "realesrgan-ncnn-vulkan.exe"

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

def upscale_realesrgan(in_path, out_path):
    subprocess.run([
        str(REALESRGAN_BIN),
        "-i", str(in_path), "-o", str(out_path),
        "-n", "realesrgan-x4plus-anime",
        "-s", "4", "-t", "32", "-j", "1:1:1",
    ], check=True, stdout=subprocess.DEVNULL, stderr=subprocess.PIPE)

def mask_to_trimap(mask, erode_size=8, dilate_size=8):
    binary = (mask > 127).astype(np.uint8) * 255
    fg = cv2.erode(binary, np.ones((erode_size, erode_size), np.uint8), iterations=1)
    bg = cv2.dilate(binary, np.ones((dilate_size, dilate_size), np.uint8), iterations=1)
    trimap = np.full_like(binary, 128)
    trimap[fg == 255] = 255
    trimap[bg == 0] = 0
    return trimap

def vitmatte_refine(rgb, trimap):
    """VITMatte sobre la imagen COMPLETA — pide mucha RAM (~3GB). Se traba
    pero da el mejor resultado porque procesa todo el contexto a la vez."""
    model, processor = load_vitmatte()
    pil_img = Image.fromarray(rgb).convert("RGB")
    pil_tri = Image.fromarray(trimap).convert("L")
    inputs = processor(images=pil_img, trimaps=pil_tri, return_tensors="pt")
    with torch.no_grad():
        outputs = model(**inputs)
    alpha = outputs.alphas[0, 0].cpu().numpy()
    alpha = (alpha * 255).clip(0, 255).astype(np.uint8)
    if alpha.shape != trimap.shape:
        alpha = cv2.resize(alpha, (trimap.shape[1], trimap.shape[0]), interpolation=cv2.INTER_LINEAR)
    del inputs, outputs
    gc.collect()
    return alpha

def compose_rgba(rgb, alpha):
    """Premultiplied alpha (sin halo claro en bordes contra fondos oscuros)."""
    rgb_f = rgb.astype(np.float32)
    weight = (alpha.astype(np.float32) / 255.0)[:, :, None]
    rgb_premul = (rgb_f * weight).clip(0, 255).astype(np.uint8)
    return np.dstack([rgb_premul, alpha])

def process_one(in_path, out_path, tmp_dir):
    # 1) RGB original — textura final
    orig_pil = Image.open(in_path).convert("RGB")
    orig_rgb = np.array(orig_pil)
    orig_size = orig_pil.size  # (W, H)

    # 2) Real-ESRGAN 4x → 2048x1536
    tmp_in = tmp_dir / "in.png"
    tmp_up = tmp_dir / "up.png"
    orig_pil.save(tmp_in)
    upscale_realesrgan(tmp_in, tmp_up)
    up_pil = Image.open(tmp_up).convert("RGB")
    rgb_4x = np.array(up_pil)

    # 3) isnet alpha_matting sobre 4x
    session = load_rembg()
    cutout = remove(up_pil, session=session,
                    alpha_matting=True,
                    alpha_matting_foreground_threshold=240,
                    alpha_matting_background_threshold=10,
                    alpha_matting_erode_size=2)
    alpha_isnet_4x = np.array(cutout)[:, :, 3]
    del up_pil, cutout
    gc.collect()

    # 4) Trimap 4x — banda 8/8 px (en escala 4x = ~2 px en original)
    trimap_4x = mask_to_trimap(alpha_isnet_4x, erode_size=8, dilate_size=8)
    del alpha_isnet_4x

    # 5) VITMatte-base sobre 2048x1536 COMPLETA (aquí se traba con poca RAM)
    alpha_refined_4x = vitmatte_refine(rgb_4x, trimap_4x)
    del rgb_4x, trimap_4x
    gc.collect()

    # 6) Downscale alpha 4x → 1x con LANCZOS (super-sampling preserva bordes)
    alpha_final = np.array(Image.fromarray(alpha_refined_4x, "L").resize(orig_size, Image.LANCZOS))
    del alpha_refined_4x

    # 7) Compose con RGB ORIGINAL (textura intacta) + alpha premultiplicado
    rgba_final = compose_rgba(orig_rgb, alpha_final)
    Image.fromarray(rgba_final, mode="RGBA").save(out_path, optimize=True)

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("input_dir")
    args = ap.parse_args()
    input_dir = Path(args.input_dir).resolve()
    output_dir = input_dir / "transparent"
    output_dir.mkdir(parents=True, exist_ok=True)

    inputs = []
    for ext in SUPPORTED_EXTS:
        inputs.extend(input_dir.glob(f"*{ext}"))
        inputs.extend(input_dir.glob(f"*{ext.upper()}"))
    inputs = sorted(set(inputs))

    tmp_dir = Path(tempfile.mkdtemp(prefix="v4_"))
    t0 = time.time()
    try:
        for i, in_path in enumerate(inputs):
            out_path = output_dir / (in_path.stem + ".png")
            if out_path.exists() and out_path.stat().st_size > 0:
                print(f"  [{i+1}/{len(inputs)}] {in_path.name} (skip)", flush=True)
                continue
            t_frame = time.time()
            try:
                process_one(in_path, out_path, tmp_dir)
            except Exception as e:
                print(f"[ERR] {in_path.name}: {e}", file=sys.stderr, flush=True)
                continue
            dt = time.time() - t_frame
            print(f"  [{i+1}/{len(inputs)}] {in_path.name} {dt:.1f}s", flush=True)
            gc.collect()
    finally:
        shutil.rmtree(tmp_dir, ignore_errors=True)
    print(f"\n[OK] {time.time()-t0:.0f}s — {len(inputs)} frames")
    print(f"[OUT] {output_dir}")

if __name__ == "__main__":
    sys.exit(main())
