"""Etapa 7 — composicion final.

FUNDAMENTAL: la mascara final se aplica SOBRE LA IMAGEN ORIGINAL.
La imagen mejorada (CLAHE + unsharp + Real-ESRGAN x4) NUNCA forma parte
de la salida. Solo se uso para que SAM2/BiRefNet/VITMatte detectaran mejor.

Funciones:
  - downscale_alpha   : LANCZOS supersample-aware del alpha 4x → 1x
  - compose_final     : aplica alpha al RGB original + PNG RGBA premultiplicado
"""
from __future__ import annotations

from pathlib import Path

import numpy as np
from PIL import Image


def downscale_alpha_to_original(alpha_up: np.ndarray,
                                  original_size: tuple[int, int]) -> np.ndarray:
    """Downscale alpha desde escala upscaled (4x) a resolucion original.

    Usa LANCZOS para preservar bordes nitidos. original_size es (W, H) de la
    imagen original (PIL convention).
    """
    if alpha_up.shape[:2] == (original_size[1], original_size[0]):
        return alpha_up
    pil = Image.fromarray(alpha_up.astype(np.uint8), mode="L")
    pil = pil.resize(original_size, Image.LANCZOS)
    return np.array(pil)


def compose_final(rgb_original: np.ndarray, alpha_final: np.ndarray,
                   out_path: Path, premultiplied: bool = True) -> None:
    """Aplica alpha al RGB ORIGINAL y guarda PNG RGBA.

    rgb_original: la imagen original sin alterar (textura, color, materiales
                   reales). DEBE tener el mismo tamano que alpha_final.
    """
    if rgb_original.shape[:2] != alpha_final.shape[:2]:
        raise ValueError(
            f"shape mismatch: rgb {rgb_original.shape[:2]} vs alpha {alpha_final.shape[:2]}"
        )

    if premultiplied:
        rgb_f = rgb_original.astype(np.float32)
        w = (alpha_final.astype(np.float32) / 255.0)[:, :, None]
        rgb_out = (rgb_f * w).clip(0, 255).astype(np.uint8)
    else:
        rgb_out = rgb_original

    rgba = np.dstack([rgb_out, alpha_final])
    out_path.parent.mkdir(parents=True, exist_ok=True)
    # PNG sin compresion lossy, optimize True conserva size
    Image.fromarray(rgba, mode="RGBA").save(out_path, optimize=True, compress_level=6)
