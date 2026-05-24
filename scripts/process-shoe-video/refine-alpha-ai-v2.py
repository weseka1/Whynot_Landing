"""
refine-alpha-ai-v2.py
=====================

SEGUNDA PASADA AI — mata el halo blanco residual que sobresale de la silueta
despues de v1 (refine-alpha-ai.py).

Stack ultra:
  - VITMatte-base (transformer SOTA de image matting, hustvl/vitmatte-base-
    composition-1k via Hugging Face transformers). Refina la zona "unknown"
    del trimap con un encoder ViT + decoder convolucional.
  - Trimap generado por erode/dilate del alpha de v1 (banda angosta ~6px
    porque ya partimos de un alpha pre-limpio).
  - Luminance-aware halo killer: en la banda de borde, los pixels con
    luminancia alta (Y > 0.82) reciben penalty en su alpha proporcional
    a cuanto mas claros sean que la mediana del producto. Esto elimina el
    halo blanco aun cuando VITMatte lo marca como semi-foreground.
  - Color despill agresivo: solo en la banda de borde post-VITMatte,
    re-aplico F = (C - (1-a)·Bg) / a con Bg estimado por el percentil 80
    de los pixels >0.85 luminance cercanos.
  - S-curve final dura (0.18 / 0.82) para crushear cualquier "humo" gris.

CPU only (sin CUDA). ~2-3s por frame. 432 frames → ~15-20min.

Uso:
  py -3.11 scripts/process-shoe-video/refine-alpha-ai-v2.py \\
      --src "Golden goose - SF refined" \\
      --dst "Golden goose - SF refined v2"
"""
import argparse
import sys
import time
from pathlib import Path

import cv2
import numpy as np
from PIL import Image
import torch
from transformers import VitMatteForImageMatting, VitMatteImageProcessor


SUPPORTED_EXTS = (".png",)

_VITMATTE_MODEL = None
_VITMATTE_PROCESSOR = None


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


def make_trimap(alpha_u8: np.ndarray, band_px: int = 6) -> np.ndarray:
    """Trimap angosto desde alpha pre-refinado. 255 = fg seguro, 0 = bg
    seguro, 128 = unknown (banda de borde)."""
    binary = (alpha_u8 > 200).astype(np.uint8) * 255
    fg = cv2.erode(binary, np.ones((band_px, band_px), np.uint8), iterations=1)
    bg = cv2.dilate(binary, np.ones((band_px, band_px), np.uint8), iterations=1)
    tri = np.full_like(binary, 128)
    tri[fg == 255] = 255
    tri[bg == 0] = 0
    return tri


def vitmatte_refine(rgb_u8: np.ndarray, trimap_u8: np.ndarray) -> np.ndarray:
    """Corre VITMatte sobre la imagen completa (512x384 es chico, no tile)."""
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
    """Rec.709 luma."""
    return 0.2126 * rgb_f[..., 0] + 0.7152 * rgb_f[..., 1] + 0.0722 * rgb_f[..., 2]


def kill_white_halo(rgb_f: np.ndarray, alpha_f: np.ndarray) -> np.ndarray:
    """En la banda de borde (alpha 0.05-0.98), penaliza alpha proporcional
    a cuanto mas claro sea el pixel que la mediana del producto interno.

    Esto resuelve el caso "VITMatte deja un pixel a alpha=0.85 con RGB
    casi-blanco" — ese pixel es halo, no producto. Bajo su alpha.
    """
    Y = luminance(rgb_f)
    # mediana del producto solido (alpha > 0.95)
    solid_mask = alpha_f > 0.95
    if not solid_mask.any():
        return alpha_f
    Y_prod = float(np.median(Y[solid_mask]))
    # En la banda de borde, calculo "brightness excess" sobre la mediana.
    edge = (alpha_f > 0.05) & (alpha_f < 0.98)
    excess = np.clip(Y - max(Y_prod, 0.55), 0.0, 1.0)  # 0..~0.45 (mas claro que el producto)
    # Penalty: cada 0.10 de excess multiplica alpha por 0.65. Pixels en el
    # halo blanco quedan en alpha ~0.1 → caen al smoothstep final.
    penalty = np.where(edge, (1.0 - excess * 2.2).clip(0.0, 1.0), 1.0)
    return alpha_f * penalty


def despill_edge(rgb_f: np.ndarray, alpha_f: np.ndarray) -> np.ndarray:
    """Color despill en la banda de borde: estima Bg con pixels brillantes
    cercanos, aplica F = (C - (1-a)·Bg) / a. Devuelve RGB despillado (float).
    """
    eps = 1e-3
    Y = luminance(rgb_f)
    edge = (alpha_f > 0.05) & (alpha_f < 0.95)
    if not edge.any():
        return rgb_f
    bright_edge_mask = edge & (Y > 0.80)
    if bright_edge_mask.any():
        bg = np.percentile(rgb_f[bright_edge_mask].reshape(-1, 3), 80, axis=0)
    else:
        bg = np.array([1.0, 1.0, 1.0], dtype=np.float32)
    bg = bg.astype(np.float32)
    a3 = np.clip(alpha_f[..., None], eps, 1.0)
    F = (rgb_f - (1.0 - a3) * bg[None, None, :]) / a3
    F = np.clip(F, 0.0, 1.0)
    # Aplico SOLO donde alpha < 0.97 para no tocar el centro del producto.
    blend_w = np.clip(1.0 - alpha_f, 0.0, 1.0)[..., None]  # mas mezcla a menor alpha
    rgb_out = rgb_f * (1.0 - blend_w) + F * blend_w
    return np.clip(rgb_out, 0.0, 1.0)


def smoothstep_hard(a_f: np.ndarray, lo: float = 0.18, hi: float = 0.82) -> np.ndarray:
    """Smoothstep duro: aplasta el 'humo' gris a 0 o 1 conservando feather
    del borde real. Mas duro que v1 (0.10/0.90)."""
    x = np.clip((a_f - lo) / (hi - lo), 0.0, 1.0)
    return x * x * (3 - 2 * x)


def refine_one(rgba: np.ndarray) -> np.ndarray:
    assert rgba.ndim == 3 and rgba.shape[2] == 4
    rgb_u8 = rgba[..., :3]
    a_u8 = rgba[..., 3]

    # 1) Trimap angosto desde alpha v1 (que ya esta bastante limpio)
    trimap = make_trimap(a_u8, band_px=6)

    # 2) VITMatte refina la banda unknown
    a_refined = vitmatte_refine(rgb_u8, trimap)

    # 3) Luminance-aware halo killer + smoothstep duro
    rgb_f = rgb_u8.astype(np.float32) / 255.0
    a_f = a_refined.astype(np.float32) / 255.0
    a_f = kill_white_halo(rgb_f, a_f)
    a_f = smoothstep_hard(a_f, lo=0.18, hi=0.82)

    # 4) Color despill (post-VITMatte, sobre RGB original)
    rgb_out = despill_edge(rgb_f, a_f)

    out = np.empty_like(rgba)
    out[..., :3] = (rgb_out * 255).astype(np.uint8)
    out[..., 3] = (a_f * 255).clip(0, 255).astype(np.uint8)
    return out


def process_folder(src: Path, dst: Path) -> None:
    dst.mkdir(parents=True, exist_ok=True)
    files = sorted([p for p in src.iterdir() if p.suffix.lower() in SUPPORTED_EXTS])
    if not files:
        print(f"[WARN] sin PNGs en {src}")
        return

    print(f"\n=== {src.name} -> {dst.name} ({len(files)} frames) ===", flush=True)
    t0 = time.time()
    for i, p in enumerate(files, 1):
        bgra = cv2.imread(str(p), cv2.IMREAD_UNCHANGED)
        if bgra is None or bgra.shape[2] != 4:
            print(f"  [skip] {p.name}")
            continue
        rgba = bgra[..., [2, 1, 0, 3]]
        out = refine_one(rgba)
        bgra_out = out[..., [2, 1, 0, 3]]
        cv2.imwrite(str(dst / p.name), bgra_out, [cv2.IMWRITE_PNG_COMPRESSION, 6])
        if i % 12 == 0 or i == len(files):
            dt = time.time() - t0
            rem = (len(files) - i) * (dt / i)
            print(f"  {i}/{len(files)}  ({dt:.0f}s, {dt / i:.2f}s/frame, ~{rem:.0f}s rem)",
                  flush=True)
    print(f"  OK -- {time.time() - t0:.1f}s total")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--src", required=True)
    ap.add_argument("--dst", required=True)
    ap.add_argument("--variants", nargs="*", default=["White Black", "Silver Star", "Gold Star"])
    args = ap.parse_args()

    src_root = Path(args.src).resolve()
    dst_root = Path(args.dst).resolve()
    if not src_root.exists():
        print(f"[FAIL] no existe {src_root}")
        sys.exit(1)

    print(f"src: {src_root}")
    print(f"dst: {dst_root}")
    print(f"variantes: {args.variants}")

    # Warm-up VITMatte una sola vez
    load_vitmatte()

    t0 = time.time()
    for v in args.variants:
        process_folder(src_root / v, dst_root / v)
    print(f"\n=== DONE en {time.time() - t0:.1f}s ===")


if __name__ == "__main__":
    main()
