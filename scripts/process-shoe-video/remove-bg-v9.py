"""
remove-bg-v9.py — sin VITMatte (que come la suela).

Pipeline:
  1) Real-ESRGAN 4x (mejor detalle para isnet)
  2) isnet-general-use con alpha_matting (trimap interno de rembg)
  3) Erode 2px del alpha (quita anillo blanco fino del borde)
  4) Gaussian blur muy sutil (anti-aliasing del borde)
  5) Downscale alpha 4x → 1x con LANCZOS (super-sampling)
  6) Guided filter usando RGB ORIGINAL como guia → refina bordes nitidos
     SIN comer detalle interno (como hacia VITMatte con suela blanca)
  7) Compose RGB ORIGINAL + alpha premultiplicado

Conserva el objeto completo (no come la suela). Bordes nitidos por
super-sampling del 4x + guided filter, no por matting fancy.
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
from rembg import remove, new_session


SUPPORTED_EXTS = (".jpg", ".jpeg", ".png", ".webp", ".bmp")
PROJECT_ROOT = Path(__file__).resolve().parent.parent.parent
REALESRGAN_BIN = PROJECT_ROOT / "tools" / "realesrgan" / "realesrgan-ncnn-vulkan.exe"
_REMBG_SESSION = None


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
        "-n", "realesr-animevideov3",
        "-s", "4",
        "-t", "64",
        "-j", "1:1:1",
    ], check=True, stdout=subprocess.DEVNULL, stderr=subprocess.PIPE)


def compose_rgba(rgb: np.ndarray, alpha: np.ndarray) -> np.ndarray:
    rgb_f = rgb.astype(np.float32)
    weight = (alpha.astype(np.float32) / 255.0)[:, :, None]
    rgb_premul = (rgb_f * weight).clip(0, 255).astype(np.uint8)
    return np.dstack([rgb_premul, alpha])


def process_one(in_path: Path, out_path: Path, tmp_dir: Path) -> None:
    # 1) RGB original — textura final
    orig_pil = Image.open(in_path).convert("RGB")
    orig_rgb = np.array(orig_pil)
    orig_size = orig_pil.size

    # 2) Upscale 4x
    tmp_in = tmp_dir / "in.png"
    tmp_up = tmp_dir / "up.png"
    orig_pil.save(tmp_in)
    upscale_realesrgan(tmp_in, tmp_up)
    up_pil = Image.open(tmp_up).convert("RGB")

    # 3) isnet alpha_matting sobre 4x — usar trimap interno (que NO mete
    #    el VITMatte fancy que comia suela). Erode bajo para preservar
    #    detalle del objeto.
    session = load_rembg()
    cutout = remove(
        up_pil,
        session=session,
        alpha_matting=True,
        alpha_matting_foreground_threshold=240,
        alpha_matting_background_threshold=10,
        alpha_matting_erode_size=2,
    )
    alpha_4x = np.array(cutout)[:, :, 3]
    del up_pil, cutout
    gc.collect()

    # 4) Refinamiento sutil del borde (sin VITMatte)
    alpha_4x = cv2.GaussianBlur(alpha_4x, (3, 3), 0.6)

    # 5) Downscale 4x → 1x con LANCZOS (super-sampling preserva bordes)
    alpha_pil = Image.fromarray(alpha_4x, "L").resize(orig_size, Image.LANCZOS)
    alpha_1x = np.array(alpha_pil)
    del alpha_4x

    # 6) Guided filter — usar el RGB original como guia para refinar.
    #    Esto recupera bordes donde la imagen tiene contraste y los
    #    suaviza donde es uniforme. NO come detalle interno como VITMatte.
    bgr_guide = cv2.cvtColor(orig_rgb, cv2.COLOR_RGB2BGR)
    alpha_refined = cv2.ximgproc.guidedFilter(
        guide=bgr_guide,
        src=alpha_1x,
        radius=3,
        eps=1e-4,
    )

    # 7) Compose
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
    print(f"[INFO] v9: SIN VITMatte (preserva suela) + Real-ESRGAN 4x + guided filter\n", flush=True)

    tmp_dir = Path(tempfile.mkdtemp(prefix="v9_"))
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
