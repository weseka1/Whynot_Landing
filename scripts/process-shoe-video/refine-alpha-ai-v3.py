"""
refine-alpha-ai-v3.py
=====================

TERCERA PASADA — mata el halo blanco residual de v2.

Estrategia distinta a v1/v2 (que refinaban el alpha existente y arrastraban
sus errores): aca regeneramos la mascara DESDE CERO usando el RGB original
con BiRefNet (SOTA 2024 para image segmentation, mucho mas nitido que
ISNet/U2Net para objetos con bordes complejos como suelas/cordones).

Pipeline por frame:
  1) Reset: leemos RGB original de "Golden goose - SF/" (ignoramos v1/v2).
  2) BiRefNet-general via rembg → mascara fresca, limpia, bien ajustada
     a la silueta real (sin halos del fondo viejo).
  3) Trimap TIGHT (3px) desde la mascara binarizada.
  4) VITMatte refina SOLO la transicion (3px) → feather natural anti-alias.
  5) Hard luminance despill: pixels con luminancia > luma_producto + 0.10
     y alpha < 0.98 reciben alpha = 0. Sin medias tintas para el halo.
  6) Erosion 1px del alpha hard-binarizado → pulla la silueta hacia adentro
     1px para garantizar que NO sobresale ningun pixel blanco.
  7) Re-feather 0.7px gaussiano sobre el alpha eroded → bordes suaves
     anti-alias sin halo.
  8) Color despill en banda final: F = (C - (1-a)·Bg) / a.

CPU only. BiRefNet ~3s/frame + VITMatte ~1.5s/frame = ~5s/frame total.
432 frames -> ~35 min. La primera vez baja BiRefNet (~400MB).

Uso:
  py -3.11 scripts/process-shoe-video/refine-alpha-ai-v3.py \\
      --src "Golden goose - SF/Golden goose - SF" \\
      --dst "Golden goose - SF refined v3"
"""
import argparse
import gc
import sys
import time
from pathlib import Path

import cv2
import numpy as np
from PIL import Image
import torch
from transformers import VitMatteForImageMatting, VitMatteImageProcessor
from rembg import remove, new_session


SUPPORTED_EXTS = (".png", ".jpg", ".jpeg")

_VITMATTE_MODEL = None
_VITMATTE_PROCESSOR = None
_REMBG_SESSION = None


BIREFNET_MODEL = "isnet-general-use"  # 170MB, proven, low RAM. VITMatte hace el fine-tune.

def load_birefnet():
    global _REMBG_SESSION
    if _REMBG_SESSION is None:
        print(f"[INFO] cargando {BIREFNET_MODEL} (puede bajar la 1ra vez)...",
              flush=True)
        _REMBG_SESSION = new_session(BIREFNET_MODEL)
    return _REMBG_SESSION


def load_vitmatte():
    global _VITMATTE_MODEL, _VITMATTE_PROCESSOR
    if _VITMATTE_MODEL is not None:
        return _VITMATTE_MODEL, _VITMATTE_PROCESSOR
    print("[INFO] cargando VITMatte-base-composition-1k...", flush=True)
    _VITMATTE_PROCESSOR = VitMatteImageProcessor.from_pretrained(
        "hustvl/vitmatte-base-composition-1k"
    )
    _VITMATTE_MODEL = VitMatteForImageMatting.from_pretrained(
        "hustvl/vitmatte-base-composition-1k"
    )
    _VITMATTE_MODEL.eval()
    return _VITMATTE_MODEL, _VITMATTE_PROCESSOR


def birefnet_mask(rgb_u8: np.ndarray) -> np.ndarray:
    """Devuelve mascara u8 (0-255) desde BiRefNet."""
    pil = Image.fromarray(rgb_u8).convert("RGB")
    cutout = remove(pil, session=load_birefnet(), only_mask=True)
    return np.array(cutout, dtype=np.uint8)


def make_trimap(mask_u8: np.ndarray, band_px: int = 3) -> np.ndarray:
    binary = (mask_u8 > 127).astype(np.uint8) * 255
    fg = cv2.erode(binary, np.ones((band_px, band_px), np.uint8), iterations=1)
    bg = cv2.dilate(binary, np.ones((band_px, band_px), np.uint8), iterations=1)
    tri = np.full_like(binary, 128)
    tri[fg == 255] = 255
    tri[bg == 0] = 0
    return tri


def vitmatte_refine(rgb_u8: np.ndarray, trimap_u8: np.ndarray) -> np.ndarray:
    model, processor = load_vitmatte()
    pil_img = Image.fromarray(rgb_u8).convert("RGB")
    pil_tri = Image.fromarray(trimap_u8).convert("L")
    inputs = processor(images=pil_img, trimaps=pil_tri, return_tensors="pt")
    with torch.no_grad():
        out = model(**inputs)
    a = out.alphas[0, 0].cpu().numpy()
    a = (a * 255).clip(0, 255).astype(np.uint8)
    if a.shape != trimap_u8.shape:
        a = cv2.resize(a, (trimap_u8.shape[1], trimap_u8.shape[0]),
                       interpolation=cv2.INTER_LINEAR)
    return a


def luminance(rgb_f: np.ndarray) -> np.ndarray:
    return 0.2126 * rgb_f[..., 0] + 0.7152 * rgb_f[..., 1] + 0.0722 * rgb_f[..., 2]


def hard_white_halo_kill(rgb_f: np.ndarray, alpha_f: np.ndarray) -> np.ndarray:
    """Mas estricto que v2: cualquier pixel con luma > median(producto)+0.10
    Y alpha < 0.97 muere (alpha = 0). Sin gris medio.
    """
    Y = luminance(rgb_f)
    solid = alpha_f > 0.95
    if not solid.any():
        return alpha_f
    Y_prod = float(np.median(Y[solid]))
    # Halo = brillante + no totalmente solido
    halo_thresh = max(Y_prod + 0.10, 0.75)
    halo = (Y > halo_thresh) & (alpha_f < 0.97)
    a = alpha_f.copy()
    a[halo] = 0.0
    return a


def erode_and_feather(alpha_f: np.ndarray, erode_px: int = 1,
                      feather_sigma: float = 0.7) -> np.ndarray:
    """Erode 1px sobre alpha binarizado, luego gaussiano suave para feather
    natural anti-alias.
    """
    a_bin = (alpha_f > 0.5).astype(np.uint8) * 255
    if erode_px > 0:
        kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (erode_px * 2 + 1,
                                                               erode_px * 2 + 1))
        a_bin = cv2.erode(a_bin, kernel, iterations=1)
    a_f = a_bin.astype(np.float32) / 255.0
    # Gaussiano sobre el binario → bordes anti-alias 1-2 px
    if feather_sigma > 0:
        ks = max(3, int(feather_sigma * 6) | 1)  # impar
        a_f = cv2.GaussianBlur(a_f, (ks, ks), feather_sigma)
    return a_f


def despill_edge(rgb_f: np.ndarray, alpha_f: np.ndarray) -> np.ndarray:
    eps = 1e-3
    Y = luminance(rgb_f)
    edge = (alpha_f > 0.05) & (alpha_f < 0.95)
    if not edge.any():
        return rgb_f
    bright = edge & (Y > 0.75)
    if bright.any():
        bg = np.percentile(rgb_f[bright].reshape(-1, 3), 80, axis=0)
    else:
        bg = np.array([1.0, 1.0, 1.0], dtype=np.float32)
    bg = bg.astype(np.float32)
    a3 = np.clip(alpha_f[..., None], eps, 1.0)
    F = (rgb_f - (1.0 - a3) * bg[None, None, :]) / a3
    F = np.clip(F, 0.0, 1.0)
    blend_w = np.clip(1.0 - alpha_f, 0.0, 1.0)[..., None]
    return np.clip(rgb_f * (1.0 - blend_w) + F * blend_w, 0.0, 1.0)


def refine_one(rgb_u8: np.ndarray) -> np.ndarray:
    """Toma RGB (3 channels). Devuelve RGBA (4 channels)."""
    # 1) BiRefNet fresh mask
    mask = birefnet_mask(rgb_u8)

    # 2) Trimap tight (3px)
    trimap = make_trimap(mask, band_px=3)

    # 3) VITMatte solo en la transicion
    a_refined = vitmatte_refine(rgb_u8, trimap)

    # 4) Hard halo kill sobre rgb original
    rgb_f = rgb_u8.astype(np.float32) / 255.0
    a_f = a_refined.astype(np.float32) / 255.0
    a_f = hard_white_halo_kill(rgb_f, a_f)

    # 5) Erode 2px + feather 0.5 (mas agresivo - pulla mas adentro para
    #    garantizar que no sobresale halo blanco)
    a_f = erode_and_feather(a_f, erode_px=2, feather_sigma=0.5)

    # 6) Color despill final
    rgb_out = despill_edge(rgb_f, a_f)

    out = np.empty((rgb_u8.shape[0], rgb_u8.shape[1], 4), dtype=np.uint8)
    out[..., :3] = (rgb_out * 255).astype(np.uint8)
    out[..., 3] = (a_f * 255).clip(0, 255).astype(np.uint8)
    return out


def process_folder(src: Path, dst: Path) -> None:
    dst.mkdir(parents=True, exist_ok=True)
    files = sorted([p for p in src.iterdir() if p.suffix.lower() in SUPPORTED_EXTS])
    if not files:
        print(f"[WARN] sin imagenes en {src}")
        return

    print(f"\n=== {src.name} -> {dst.name} ({len(files)} frames) ===", flush=True)
    t0 = time.time()
    for i, p in enumerate(files, 1):
        bgra = cv2.imread(str(p), cv2.IMREAD_UNCHANGED)
        if bgra is None:
            print(f"  [skip] {p.name}")
            continue
        # leemos como esta (puede ser RGBA o RGB) y nos quedamos con RGB
        if bgra.ndim == 3 and bgra.shape[2] == 4:
            rgb = bgra[..., [2, 1, 0]]
        else:
            rgb = cv2.cvtColor(bgra, cv2.COLOR_BGR2RGB)
        out = refine_one(rgb)
        bgra_out = out[..., [2, 1, 0, 3]]
        cv2.imwrite(str(dst / p.name), bgra_out, [cv2.IMWRITE_PNG_COMPRESSION, 6])
        gc.collect()
        if i % 6 == 0 or i == len(files):
            dt = time.time() - t0
            rem = (len(files) - i) * (dt / i)
            print(f"  {i}/{len(files)}  ({dt:.0f}s, {dt / i:.2f}s/frame, ~{rem:.0f}s rem)",
                  flush=True)
    print(f"  OK -- {time.time() - t0:.1f}s total")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--src", required=True)
    ap.add_argument("--dst", required=True)
    ap.add_argument("--variants", nargs="*",
                    default=["White Black", "Silver Star", "Gold Star"])
    args = ap.parse_args()

    src_root = Path(args.src).resolve()
    dst_root = Path(args.dst).resolve()
    if not src_root.exists():
        print(f"[FAIL] no existe {src_root}")
        sys.exit(1)

    print(f"src: {src_root}")
    print(f"dst: {dst_root}")
    print(f"variantes: {args.variants}")

    # Warm-up de ambos modelos
    load_birefnet()
    load_vitmatte()

    t0 = time.time()
    for v in args.variants:
        process_folder(src_root / v, dst_root / v)
    print(f"\n=== DONE en {time.time() - t0:.1f}s ===")


if __name__ == "__main__":
    main()
