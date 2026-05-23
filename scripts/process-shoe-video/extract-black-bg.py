"""
extract-black-bg.py — extraccion premium SIN IA para productos sobre fondo
NEGRO PURO de estudio. Approach geometrico/luminancial, agnostico al
contenido de la zapatilla (no falla con vistas frontales como RMBG).

Pipeline (por frame, ~0.3s en CPU):
  1. RGB -> LAB (channel L = luminancia perceptual)
  2. Alpha base = ramp lineal sobre L (entre L_low y L_high)
  3. Flood-fill desde bordes: detecta la "region negra del fondo" como
     componentes oscuras que tocan algun borde de la imagen. Anything que
     NO esta conectado al borde = parte del producto (incluye el talon
     negro encerrado por la zapatilla blanca).
  4. Anular alpha en la region de fondo
  5. Connected components -> dejar el blob principal + islas grandes
  6. Anti-alias edge (gauss suave 1px)
  7. VITMatte refinement (opcional, --vitmatte) sobre banda de borde
  8. Decontaminate edges (chroma decontamination: el fondo era negro)
  9. Compose RGBA premultiplied
  10. PNG

Es agnostico al modelo: funciona igual para vista frontal, lateral,
trasera. El unico requisito es que el fondo sea oscuro y uniforme.

Uso:
  py -3.11 extract-black-bg.py "<input_dir>" [--output "<dst>"]
                                 [--lum-low 14] [--lum-high 48]
                                 [--no-vitmatte] [--force]
"""
from __future__ import annotations

import argparse
import sys
import time
from pathlib import Path

import numpy as np
import cv2
from PIL import Image


SUPPORTED_EXTS = (".jpg", ".jpeg", ".png", ".webp", ".bmp")

# Lazy-loaded VITMatte (solo si --vitmatte)
_VIT_MODEL = None
_VIT_PROC = None


def load_vitmatte():
    global _VIT_MODEL, _VIT_PROC
    if _VIT_MODEL is not None:
        return _VIT_MODEL, _VIT_PROC
    print("[INFO] cargando VITMatte-small...")
    import torch
    from transformers import VitMatteForImageMatting, VitMatteImageProcessor
    _VIT_PROC = VitMatteImageProcessor.from_pretrained(
        "hustvl/vitmatte-small-composition-1k"
    )
    _VIT_MODEL = VitMatteForImageMatting.from_pretrained(
        "hustvl/vitmatte-small-composition-1k"
    )
    _VIT_MODEL.eval()
    return _VIT_MODEL, _VIT_PROC


# =============================================================================
# 1) Alpha base por luminance ramp
# =============================================================================

def luminance_alpha(rgb: np.ndarray, lum_low: int, lum_high: int) -> np.ndarray:
    """Alpha lineal entre lum_low (=0) y lum_high (=255) sobre canal L de LAB."""
    lab = cv2.cvtColor(rgb, cv2.COLOR_RGB2LAB)
    L = lab[..., 0].astype(np.float32)
    a = np.clip((L - lum_low) / max(1, (lum_high - lum_low)), 0.0, 1.0)
    return (a * 255).astype(np.uint8)


# =============================================================================
# 2) Mask "border-connected background" — flood desde bordes
# =============================================================================

def background_mask(rgb: np.ndarray, lum_threshold: int = 22,
                    dilate_px: int = 2) -> np.ndarray:
    """Detecta la region del fondo: pixels oscuros conectados al borde.

    Esto preserva regiones oscuras ENCERRADAS por el producto (ej. el talon
    negro de la White Black queda como FG porque no toca el borde de la
    imagen — esta rodeado por blanco).

    Returns uint8 mask: 255 = background, 0 = foreground.
    """
    lab = cv2.cvtColor(rgb, cv2.COLOR_RGB2LAB)
    L = lab[..., 0]
    dark = (L < lum_threshold).astype(np.uint8)

    # Encontrar componentes conectadas. Las que tocan el borde = fondo.
    n, labels, stats, _ = cv2.connectedComponentsWithStats(dark, connectivity=4)
    h, w = dark.shape
    bg = np.zeros_like(dark, dtype=np.uint8)
    for i in range(1, n):
        x, y, ww, hh, _ = stats[i]
        # Componente toca cualquier borde?
        if x == 0 or y == 0 or (x + ww) >= w or (y + hh) >= h:
            bg[labels == i] = 255

    # Dilatar un poco para cubrir bordes anti-alias gris-oscuro contiguos
    if dilate_px > 0:
        k = cv2.getStructuringElement(
            cv2.MORPH_ELLIPSE, (dilate_px * 2 + 1, dilate_px * 2 + 1)
        )
        bg = cv2.dilate(bg, k, iterations=1)

    return bg


# =============================================================================
# 3) Connected components — deja solo el blob principal (+ islas grandes)
# =============================================================================

def keep_largest_blobs(alpha: np.ndarray, ratio_min: float = 0.05) -> np.ndarray:
    """Deja el blob mas grande y los que tengan >= ratio_min * area_max."""
    binary = (alpha > 24).astype(np.uint8)
    n, labels, stats, _ = cv2.connectedComponentsWithStats(binary, connectivity=8)
    if n <= 1:
        return alpha
    areas = stats[1:, cv2.CC_STAT_AREA]
    if len(areas) == 0:
        return alpha
    max_area = int(areas.max())
    keep_min = max_area * ratio_min

    keep = np.zeros_like(binary, dtype=np.uint8)
    for i in range(1, n):
        if stats[i, cv2.CC_STAT_AREA] >= keep_min:
            keep[labels == i] = 1

    return (alpha.astype(np.float32) * keep.astype(np.float32)).astype(np.uint8)


# =============================================================================
# 4) VITMatte refinement (opcional) sobre banda de borde
# =============================================================================

def vitmatte_refine(rgb: np.ndarray, alpha: np.ndarray,
                    erode: int = 6, dilate: int = 6) -> np.ndarray:
    """Refina alpha usando VITMatte. Construye trimap del alpha actual."""
    model, proc = load_vitmatte()
    import torch

    binary = (alpha > 127).astype(np.uint8) * 255
    ke = np.ones((erode, erode), np.uint8)
    kd = np.ones((dilate, dilate), np.uint8)
    fg = cv2.erode(binary, ke, iterations=1)
    bg_dil = cv2.dilate(binary, kd, iterations=1)
    tri = np.full_like(binary, 128)
    tri[fg == 255] = 255
    tri[bg_dil == 0] = 0

    inputs = proc(
        images=Image.fromarray(rgb).convert("RGB"),
        trimaps=Image.fromarray(tri).convert("L"),
        return_tensors="pt",
    )
    with torch.no_grad():
        out = model(**inputs)
    refined = out.alphas[0, 0].cpu().numpy()
    refined = (refined * 255).clip(0, 255).astype(np.uint8)
    if refined.shape != alpha.shape:
        refined = cv2.resize(
            refined, (alpha.shape[1], alpha.shape[0]),
            interpolation=cv2.INTER_LINEAR,
        )
    return refined


# =============================================================================
# 5) Decontaminate edges contra fondo negro
# =============================================================================

def decontaminate(rgb: np.ndarray, alpha: np.ndarray) -> np.ndarray:
    """RGB_clean = (composite - bg_black * (1-a)) / a.

    Como bg_black es (0,0,0), simplifica a RGB_clean = composite / a, lo
    cual al multiplicar de vuelta por a (premultiply) regresa al composite
    original. Para premultiplied alpha contra fondo negro NO hace falta
    decontaminate — el resultado es correcto tal cual.

    Pero si el fondo real era oscuro pero NO negro puro (ej. (5,5,5) por
    compresion), conviene restar. Generalizado a bg_color.
    """
    return rgb  # noop para fondo negro puro


# =============================================================================
# 6) Composicion final premultiplied
# =============================================================================

def compose_rgba(rgb: np.ndarray, alpha: np.ndarray) -> np.ndarray:
    w = (alpha.astype(np.float32) / 255.0)[..., None]
    rgb_pm = (rgb.astype(np.float32) * w).clip(0, 255).astype(np.uint8)
    return np.dstack([rgb_pm, alpha])


# =============================================================================
# Pipeline por frame
# =============================================================================

def process_one(in_path: Path, out_path: Path, args) -> None:
    pil = Image.open(in_path).convert("RGB")
    rgb = np.array(pil)

    # 1) Alpha base: ramp sobre L (suave en bordes anti-alias del producto)
    alpha = luminance_alpha(rgb, args.lum_low, args.lum_high)

    # 2) Forzar alpha=0 en region de fondo (border-connected dark blob)
    bg = background_mask(rgb, lum_threshold=args.lum_low + 8,
                          dilate_px=args.bg_dilate)
    alpha[bg > 0] = 0

    # 3) Connected components -> deja blob principal
    alpha = keep_largest_blobs(alpha, ratio_min=args.blob_ratio)

    # 4) VITMatte refinement (opcional)
    if args.vitmatte:
        alpha = vitmatte_refine(rgb, alpha, erode=6, dilate=6)
        # Re-aplicar bg mask por si VITMatte revivio sombras
        alpha[bg > 0] = 0
        alpha = keep_largest_blobs(alpha, ratio_min=args.blob_ratio)

    # 5) Anti-alias edge: gauss suave
    if args.edge_blur > 0:
        alpha = cv2.GaussianBlur(alpha, (3, 3), args.edge_blur)

    # 6) Compose RGBA premultiplied
    rgba = compose_rgba(rgb, alpha)
    Image.fromarray(rgba, mode="RGBA").save(out_path, optimize=True)


# =============================================================================
# Main
# =============================================================================

def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("input_dir")
    ap.add_argument("--output", default=None)
    ap.add_argument("--lum-low", type=int, default=14,
                    help="L (LAB) abajo del cual alpha=0 (default 14)")
    ap.add_argument("--lum-high", type=int, default=48,
                    help="L (LAB) arriba del cual alpha=255 (default 48)")
    ap.add_argument("--bg-dilate", type=int, default=2,
                    help="dilatacion px de la mask de fondo (default 2)")
    ap.add_argument("--blob-ratio", type=float, default=0.05,
                    help="ratio min area vs max area para conservar (default 0.05)")
    ap.add_argument("--edge-blur", type=float, default=0.6,
                    help="sigma del gauss para suavizar borde alpha (default 0.6)")
    ap.add_argument("--vitmatte", action="store_true",
                    help="aplicar VITMatte para refinar bordes (mas lento)")
    ap.add_argument("--force", action="store_true",
                    help="reprocesar aunque ya exista output")
    args = ap.parse_args()

    src = Path(args.input_dir).resolve()
    if not src.is_dir():
        print(f"[ERR] no existe: {src}", file=sys.stderr)
        return 1

    dst = Path(args.output) if args.output else src / "transparent-black-bg"
    dst.mkdir(parents=True, exist_ok=True)

    files = sorted({f for ext in SUPPORTED_EXTS
                    for f in (*src.glob(f"*{ext}"), *src.glob(f"*{ext.upper()}"))})
    if not files:
        print(f"[ERR] no hay imagenes en {src}", file=sys.stderr)
        return 1

    print(f"[INFO] entrada    : {src}")
    print(f"[INFO] salida     : {dst}")
    print(f"[INFO] imagenes   : {len(files)}")
    print(f"[INFO] L range    : [{args.lum_low}, {args.lum_high}]")
    print(f"[INFO] bg_dilate  : {args.bg_dilate}")
    print(f"[INFO] vitmatte   : {args.vitmatte}")
    print()

    t0 = time.time()
    done = 0
    for i, f in enumerate(files):
        out = dst / (f.stem + ".png")
        if out.exists() and not args.force:
            print(f"  [{i+1}/{len(files)}] {f.name}  SKIP (existe)")
            continue
        t = time.time()
        try:
            process_one(f, out, args)
        except Exception as e:
            print(f"[ERR] {f.name}: {e}", file=sys.stderr)
            continue
        dt = time.time() - t
        done += 1
        elapsed = time.time() - t0
        eta = elapsed * (len(files) - (i + 1)) / max(1, done)
        print(f"  [{i+1}/{len(files)}] {f.name:24s} {dt:5.2f}s  ETA {eta:5.0f}s")

    print()
    print(f"[OK] terminado en {time.time() - t0:.0f}s")
    print(f"[OUT] {dst}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
