"""Etapa 3 — BiRefNet refinement.

BiRefNet (Bilateral Reference Network) entrega alpha continua con detalle
fino de cordones, costuras, suelas serruchadas. Lo usamos como REFINER:
fusiona la mascara binaria/score de SAM2 con la alpha continua de BiRefNet
y produce una alpha "soft" lista para alimentar al alpha matting.

Fusion edge-aware:
  - donde BiRefNet ya da alpha >= birefnet_strong_threshold → trust BiRefNet
    (bordes finos, microdetalle)
  - donde SAM2 dice claramente FG (binario > 0) y BiRefNet ambigua
    (30..230) → empuja alpha hacia FG sin saltar a 255 puro
  - donde SAM2 dice claramente BG (binario == 0) y BiRefNet < 80 → 0
  - en el resto se queda BiRefNet (gana microdetalle)
"""
from __future__ import annotations

from typing import Optional

import cv2
import numpy as np
from PIL import Image


_REMBG_SESSIONS: dict = {}


def _get_session(model: str):
    if model not in _REMBG_SESSIONS:
        from rembg import new_session
        _REMBG_SESSIONS[model] = new_session(model)
    return _REMBG_SESSIONS[model]


def birefnet_alpha(rgb: np.ndarray, model: str = "birefnet-general",
                    alpha_matting: bool = True,
                    fg_threshold: int = 200,
                    bg_threshold: int = 5,
                    erode_size: int = 1,
                    logger=None) -> Optional[np.ndarray]:
    """Devuelve alpha uint8 (H,W). None si rembg/onnxruntime falla."""
    try:
        from rembg import remove
    except ImportError:
        if logger:
            logger.error("rembg no instalado — pip install rembg onnxruntime")
        return None
    try:
        session = _get_session(model)
        pil = Image.fromarray(rgb)
        out = remove(
            pil,
            session=session,
            alpha_matting=alpha_matting,
            alpha_matting_foreground_threshold=fg_threshold,
            alpha_matting_background_threshold=bg_threshold,
            alpha_matting_erode_size=erode_size,
        )
        arr = np.array(out)
        if arr.ndim == 3 and arr.shape[2] == 4:
            return arr[:, :, 3]
        return None
    except Exception as e:
        if logger:
            logger.warning(f"BiRefNet/{model} fallo: {e}")
        return None


def fuse_sam2_birefnet(sam_binary: Optional[np.ndarray],
                       birefnet: Optional[np.ndarray],
                       strategy: str = "edge_aware",
                       birefnet_strong: int = 230,
                       sam_band: tuple = (30, 230),
                       logger=None) -> np.ndarray:
    """Fusion edge-aware. Devuelve alpha base lista para trimap+matting.

    Inputs:
        sam_binary: mascara binaria 0/255 de SAM2 (o None)
        birefnet : alpha continua de BiRefNet (o None)
    """
    # casos degenerados
    if birefnet is None and sam_binary is None:
        raise RuntimeError("ni SAM2 ni BiRefNet produjeron mascara — todo fallo")
    if birefnet is None:
        if logger:
            logger.warning("BiRefNet no disponible — usando SAM2 binaria como base")
        return sam_binary.astype(np.uint8)
    if sam_binary is None:
        if logger:
            logger.warning("SAM2 no disponible — usando BiRefNet directo")
        return birefnet.astype(np.uint8)

    # resize si shapes difieren (debería ser igual, paranoico)
    if sam_binary.shape != birefnet.shape:
        sam_binary = cv2.resize(sam_binary, (birefnet.shape[1], birefnet.shape[0]),
                                 interpolation=cv2.INTER_NEAREST)

    a = birefnet.astype(np.float32)
    s = (sam_binary > 127).astype(np.float32) * 255.0
    lo, hi = sam_band

    if strategy == "trust_birefnet":
        return birefnet

    if strategy == "conservative":
        # AND blando: ambos deben coincidir
        out = a.copy()
        out[s == 0] = 0
        return out.clip(0, 255).astype(np.uint8)

    # edge_aware (default) — mejor para sneakers
    out = a.copy()
    # 1) Donde BiRefNet ya es alpha fuerte (cordones blancos en alpha > 230) → trust
    #    no tocar (out[strong] = a[strong] ya esta)

    # 2) SAM dice FG fuerte + BiRefNet ambigua → push up
    ambiguous_fg = (a > lo) & (a < hi) & (s > 0)
    out[ambiguous_fg] = np.maximum(out[ambiguous_fg], 220)

    # 3) SAM dice BG + BiRefNet debil → 0 (limpia islas falsas)
    weak_bg = (a < 80) & (s == 0)
    out[weak_bg] = 0

    # 4) SAM dice FG + BiRefNet basicamente 0 (raro: BiRefNet no detecto)
    #    confiar en SAM y dar alpha 200 ahí para que VITMatte refine
    sam_only_fg = (a < 30) & (s > 0)
    out[sam_only_fg] = 200

    return out.clip(0, 255).astype(np.uint8)
