"""download_weights.py — descarga todos los pesos del pipeline.

Descarga:
  - SAM2.1 hiera <variant>.pt → models/
  - BiRefNet ONNX → ~/.u2net/ (via rembg auto-download)
  - VITMatte-base → HF cache (via transformers cache)

Real-ESRGAN ncnn-vulkan se descarga aparte (binario, no via pip).
Si no existe, install.bat avisa donde bajarlo.
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

REPO_ROOT = Path(__file__).resolve().parent
MODELS_DIR = REPO_ROOT / "models"


def human(n: int) -> str:
    s = float(n)
    for u in ["B", "KB", "MB", "GB"]:
        if s < 1024 or u == "GB":
            return f"{s:.1f} {u}"
        s /= 1024
    return f"{s:.1f} GB"


def download(url: str, dest: Path) -> None:
    dest.parent.mkdir(parents=True, exist_ok=True)
    if dest.exists() and dest.stat().st_size > 0:
        print(f"  [skip] {dest.name} ({human(dest.stat().st_size)})")
        return
    print(f"  -> {url}\n     → {dest}")
    last = [-1]

    def _hook(b, bs, total):
        if total <= 0:
            return
        pct = int(min(100, b * bs * 100 / total))
        if pct // 5 != last[0] // 5:
            sys.stdout.write(f"\r     {pct:3d}%  ({human(b*bs)}/{human(total)})")
            sys.stdout.flush()
            last[0] = pct

    try:
        urllib.request.urlretrieve(url, dest, reporthook=_hook)
        sys.stdout.write("\n")
        print(f"  [ok] {dest.name} {human(dest.stat().st_size)}")
    except Exception as e:
        print(f"\n  [ERR] {e}")
        if dest.exists():
            dest.unlink(missing_ok=True)
        raise


def download_sam2(variant: str) -> None:
    print(f"\n[1/3] SAM2.1 ({variant})")
    if variant not in SAM2_URLS:
        print(f"  [ERR] variant invalido: {variant}")
        return
    fname, url = SAM2_URLS[variant]
    dest = MODELS_DIR / fname
    try:
        download(url, dest)
    except Exception:
        print("  SAM2 es opcional — el pipeline cae a BiRefNet si no esta.")


def download_birefnet(model: str = "birefnet-general") -> None:
    print(f"\n[2/3] BiRefNet ({model})")
    try:
        from rembg import new_session
        session = new_session(model)
        print(f"  [ok] BiRefNet listo (session={type(session).__name__})")
    except Exception as e:
        print(f"  [ERR] {e}")
        print("  intenta: pip install rembg onnxruntime")


def download_vitmatte(model_id: str = "hustvl/vitmatte-base-composition-1k") -> None:
    print(f"\n[3/3] VITMatte ({model_id})")
    try:
        from transformers import VitMatteForImageMatting, VitMatteImageProcessor
        VitMatteImageProcessor.from_pretrained(model_id)
        VitMatteForImageMatting.from_pretrained(model_id)
        print("  [ok] VITMatte listo en HF cache")
    except Exception as e:
        print(f"  [ERR] {e}")
        print("  intenta: pip install transformers torch")


def main() -> int:
    ap = argparse.ArgumentParser(description="Descarga pesos para sneaker-ultra-pro")
    ap.add_argument("--sam2-variant", default="large",
                    choices=list(SAM2_URLS.keys()))
    ap.add_argument("--no-sam2", action="store_true")
    ap.add_argument("--birefnet-model", default="birefnet-general")
    ap.add_argument("--vitmatte-model", default="hustvl/vitmatte-base-composition-1k")
    args = ap.parse_args()

    print("==> Descargando pesos sneaker-ultra-pro\n")
    if not args.no_sam2:
        download_sam2(args.sam2_variant)
    download_birefnet(args.birefnet_model)
    download_vitmatte(args.vitmatte_model)

    print("\n==> Listo. Probar:")
    print("    py -3.11 main.py")
    return 0


if __name__ == "__main__":
    sys.exit(main())
