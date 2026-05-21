"""download_models.py — Descarga checkpoints/weights de todos los modelos.

Descarga:
  - BiRefNet ONNX → ~/.u2net/birefnet-general.onnx (via rembg auto-download)
  - VITMatte-base → ~/.cache/huggingface/hub/ (via transformers cache)
  - SAM2.1 hiera large → ./models/sam2.1_hiera_large.pt (opcional)

Real-ESRGAN ncnn-vulkan ya debe estar en tools/realesrgan/realesrgan-ncnn-vulkan.exe
(no se baja desde aca — instalalo desde https://github.com/xinntao/Real-ESRGAN/releases).
"""
from __future__ import annotations

import argparse
import sys
import urllib.request
from pathlib import Path


SAM2_URLS = {
    "tiny":  ("sam2.1_hiera_tiny.pt",
              "https://dl.fbaipublicfiles.com/segment_anything_2/092824/sam2.1_hiera_tiny.pt"),
    "small": ("sam2.1_hiera_small.pt",
              "https://dl.fbaipublicfiles.com/segment_anything_2/092824/sam2.1_hiera_small.pt"),
    "base":  ("sam2.1_hiera_base_plus.pt",
              "https://dl.fbaipublicfiles.com/segment_anything_2/092824/sam2.1_hiera_base_plus.pt"),
    "large": ("sam2.1_hiera_large.pt",
              "https://dl.fbaipublicfiles.com/segment_anything_2/092824/sam2.1_hiera_large.pt"),
}


def human(n_bytes: int) -> str:
    units = ["B", "KB", "MB", "GB"]
    s = float(n_bytes)
    for u in units:
        if s < 1024 or u == units[-1]:
            return f"{s:.1f} {u}"
        s /= 1024
    return f"{s:.1f} GB"


def download_with_progress(url: str, dest: Path) -> None:
    dest.parent.mkdir(parents=True, exist_ok=True)
    if dest.exists() and dest.stat().st_size > 0:
        print(f"  [skip] ya existe: {dest.name} ({human(dest.stat().st_size)})")
        return
    print(f"  -> {url}")
    print(f"     → {dest}")

    last_pct = [-1]

    def _hook(blocks: int, blocksize: int, total: int) -> None:
        if total <= 0:
            return
        pct = int(min(100, blocks * blocksize * 100 / total))
        if pct // 5 != last_pct[0] // 5:
            sys.stdout.write(f"\r     {pct:3d}%  ({human(blocks * blocksize)}/{human(total)})")
            sys.stdout.flush()
            last_pct[0] = pct

    try:
        urllib.request.urlretrieve(url, dest, reporthook=_hook)
        sys.stdout.write("\n")
        print(f"  [ok] {dest.name} {human(dest.stat().st_size)}")
    except Exception as e:
        print(f"\n  [ERR] descarga fallida: {e}")
        if dest.exists():
            dest.unlink(missing_ok=True)
        raise


def download_birefnet() -> None:
    """Trigger rembg auto-download del BiRefNet ONNX."""
    print("\n[1/3] BiRefNet (rembg auto-download)...")
    try:
        from rembg import new_session
        session = new_session("birefnet-general")
        print(f"  [ok] BiRefNet listo (session={type(session).__name__})")
    except Exception as e:
        print(f"  [ERR] {e}")
        print("  intenta: pip install rembg onnxruntime")


def download_vitmatte(model_id: str = "hustvl/vitmatte-base-composition-1k") -> None:
    """Trigger HF download de VITMatte."""
    print(f"\n[2/3] VITMatte ({model_id})...")
    try:
        from transformers import VitMatteForImageMatting, VitMatteImageProcessor
        VitMatteImageProcessor.from_pretrained(model_id)
        VitMatteForImageMatting.from_pretrained(model_id)
        print("  [ok] VITMatte listo en HF cache")
    except Exception as e:
        print(f"  [ERR] {e}")
        print("  intenta: pip install transformers torch")


def download_sam2(variant: str = "large") -> None:
    print(f"\n[3/3] SAM2.1 ({variant})...")
    if variant not in SAM2_URLS:
        print(f"  [ERR] variant invalido: {variant} (usa tiny|small|base|large)")
        return
    fname, url = SAM2_URLS[variant]
    dest = Path(__file__).parent / "models" / fname
    try:
        download_with_progress(url, dest)
    except Exception:
        print("  SAM2 es opcional — el pipeline funciona sin el.")


def main() -> int:
    ap = argparse.ArgumentParser(description="Descarga modelos para el pipeline pro de sneakers")
    ap.add_argument("--sam2-variant", default="large",
                    choices=list(SAM2_URLS.keys()),
                    help="Variante de SAM2.1 a descargar (default large ~900MB)")
    ap.add_argument("--no-sam2", action="store_true", help="No descargar SAM2")
    ap.add_argument("--vitmatte-model", default="hustvl/vitmatte-base-composition-1k")
    args = ap.parse_args()

    print("==> Descargando modelos del pipeline pro-sneaker-bg\n")

    download_birefnet()
    download_vitmatte(args.vitmatte_model)
    if not args.no_sam2:
        download_sam2(args.sam2_variant)

    print("\n==> Listo. Probar el pipeline:")
    print('    py -3.11 remove_bg_pro.py "<carpeta>"')
    return 0


if __name__ == "__main__":
    sys.exit(main())
