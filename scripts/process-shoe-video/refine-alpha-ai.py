"""
refine-alpha-ai.py
==================

Refinacion AI de bordes alpha para PNGs RGBA que ya vienen con fondo quitado
pero con bordes irregulares / halos / inconsistencias entre variantes.

Pipeline por frame:
  1) Leer RGBA
  2) Pequeno close morfologico -> cerrar agujeros 1-2 px en el alpha
  3) Edge-aware smoothing del alpha con cv2.ximgproc.guidedFilter usando
     RGB como guia -> suaviza bordes RESPETANDO la silueta real del producto
     (es el truco que usan KNN-matting y RVM para bordes uniformes)
  4) S-curve / soft threshold -> empuja semi-transparentes residuales hacia
     0 o 255 (mata la "neblina gris" sin perder el feather del borde real)
  5) Color despill: F = (C - (1-a)·B) / a, donde B = color de fondo viejo
     estimado por percentil sobre los pixels semi-transparentes. Elimina
     halos blancos/grises remanentes del background original.
  6) Recompose RGBA y guardar PNG.

Usado en CPU (Vega 8 sin CUDA), procesa cada frame en <1s. Para 144x3=432
frames toma ~5min.

Uso:
  py -3.11 scripts/process-shoe-video/refine-alpha-ai.py \
      --src "Golden goose - SF/Golden goose - SF" \
      --dst "Golden goose - SF refined"
"""
import argparse
import sys
import time
from pathlib import Path

import cv2
import numpy as np
from cv2 import ximgproc


SUPPORTED_EXTS = (".png",)


def refine_one(rgba: np.ndarray) -> np.ndarray:
    """Devuelve un RGBA con alpha suavizado + RGB despillado."""
    assert rgba.ndim == 3 and rgba.shape[2] == 4, "esperaba RGBA"
    rgb = rgba[..., :3].astype(np.float32) / 255.0
    a = rgba[..., 3].astype(np.float32) / 255.0

    # 1) Close morfologico chico (cierra holes 1px)
    a_u8 = (a * 255).astype(np.uint8)
    kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (3, 3))
    a_u8 = cv2.morphologyEx(a_u8, cv2.MORPH_CLOSE, kernel, iterations=1)
    a = a_u8.astype(np.float32) / 255.0

    # 2) Guided filter edge-aware sobre alpha usando RGB como guia.
    #    radius 6 y eps 1e-3 -> suaviza el "diente de sierra" sin meter halo.
    guide = (rgb * 255).astype(np.uint8)
    a_gf = ximgproc.guidedFilter(
        guide=guide,
        src=(a * 255).astype(np.uint8),
        radius=6,
        eps=int(1e-3 * 255 * 255),  # eps en escala 0-255^2
    )
    a = a_gf.astype(np.float32) / 255.0

    # 3) S-curve: pixels en zona ambigua se empujan a los extremos.
    #    formula: smoothstep desde (lo, hi) - aplasta el "humo" gris.
    lo, hi = 0.10, 0.90
    a_s = np.clip((a - lo) / (hi - lo), 0.0, 1.0)
    a_s = a_s * a_s * (3 - 2 * a_s)  # smoothstep cubico
    a = a_s

    # 4) Color despill — estimar bg color con los pixels semi-transparentes
    #    (donde se filtra el bg viejo). Usar percentil 70 (mas brillante,
    #    suele ser blanco/gris).
    edge_mask = (a > 0.05) & (a < 0.5)
    if edge_mask.any():
        bg_est = np.percentile(rgb[edge_mask].reshape(-1, 3), 70, axis=0)
    else:
        # Fallback: blanco. Si no hay zona ambigua, no se va a usar igual.
        bg_est = np.array([1.0, 1.0, 1.0], dtype=np.float32)
    bg_est = bg_est.astype(np.float32)

    # F = (C - (1-a)·B) / a — solo donde alpha > epsilon para evitar /0.
    eps = 1e-3
    a3 = np.clip(a[..., None], eps, 1.0)
    F = (rgb - (1.0 - a3) * bg_est[None, None, :]) / a3
    F = np.clip(F, 0.0, 1.0)

    # Blend del despill SOLO en la banda de borde para no tocar el centro
    # del producto (donde el RGB original es exacto).
    edge_w = np.clip((1.0 - np.abs(a - 0.5) * 2.0), 0.0, 1.0)[..., None]  # peak en a=0.5
    rgb_out = rgb * (1 - edge_w) + F * edge_w
    rgb_out = np.clip(rgb_out, 0.0, 1.0)

    out = np.empty_like(rgba)
    out[..., :3] = (rgb_out * 255).astype(np.uint8)
    out[..., 3] = (a * 255).astype(np.uint8)
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
        img = cv2.imread(str(p), cv2.IMREAD_UNCHANGED)
        if img is None:
            print(f"  [skip] no pude leer {p.name}")
            continue
        # OpenCV lee BGRA -> reordeno a RGBA para procesar (afecta el guide
        # solo, no es critico pero mantengo coherencia)
        bgra = img if img.shape[2] == 4 else cv2.cvtColor(img, cv2.COLOR_BGR2BGRA)
        rgba = bgra[..., [2, 1, 0, 3]]
        out = refine_one(rgba)
        bgra_out = out[..., [2, 1, 0, 3]]
        cv2.imwrite(str(dst / p.name), bgra_out, [cv2.IMWRITE_PNG_COMPRESSION, 6])
        if i % 24 == 0 or i == len(files):
            dt = time.time() - t0
            print(f"  {i}/{len(files)}  ({dt:.1f}s, {dt / i:.2f}s/frame)", flush=True)
    print(f"  OK — {time.time() - t0:.1f}s total")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--src", required=True, help="dir raiz con subcarpetas por variante")
    ap.add_argument("--dst", required=True, help="dir raiz de salida (se crean subcarpetas)")
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

    t0 = time.time()
    for v in args.variants:
        process_folder(src_root / v, dst_root / v)
    print(f"\n=== DONE en {time.time() - t0:.1f}s ===")


if __name__ == "__main__":
    main()
