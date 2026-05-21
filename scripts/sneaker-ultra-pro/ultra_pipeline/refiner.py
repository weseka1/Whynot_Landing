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
                       strategy: str = "trust_birefnet",
                       birefnet_strong: int = 230,
                       sam_band: tuple = (30, 230),
                       logger=None) -> np.ndarray:
    """Fusion de la mascara base.

    Estrategias:
      - 'trust_birefnet' (DEFAULT): BiRefNet manda; SAM2 actua SOLO como
        filtro de BG (puede QUITAR alpha en zonas claramente fondo, nunca
        AGREGAR alpha donde BiRefNet no la puso). Esto evita que una
        mascara SAM2 ruidosa (typical en variants small en CPU) inyecte
        halos en el FG.
      - 'edge_aware': SAM2 puede subir BiRefNet en zonas ambiguas. Util
        SOLO con SAM2 large + CUDA donde SAM2 es muy preciso. Riesgoso
        en CPU/iGPU.
      - 'conservative': AND blando, ambos deben coincidir.

    Inputs:
        sam_binary: mascara binaria 0/255 de SAM2 (o None)
        birefnet : alpha continua de BiRefNet (o None)
    """
    if birefnet is None and sam_binary is None:
        raise RuntimeError("ni SAM2 ni BiRefNet produjeron mascara — todo fallo")
    if birefnet is None:
        if logger:
            logger.warning("BiRefNet no disponible — usando SAM2 binaria como base")
        return sam_binary.astype(np.uint8)
    if sam_binary is None:
        return birefnet.astype(np.uint8)

    if sam_binary.shape != birefnet.shape:
        sam_binary = cv2.resize(sam_binary, (birefnet.shape[1], birefnet.shape[0]),
                                 interpolation=cv2.INTER_NEAREST)

    a = birefnet.astype(np.float32)
    s = (sam_binary > 127).astype(np.float32) * 255.0
    lo, hi = sam_band

    if strategy == "conservative":
        out = a.copy()
        out[s == 0] = 0
        return out.clip(0, 255).astype(np.uint8)

    if strategy == "edge_aware":
        # NOTA: solo conviene con SAM2 large + CUDA.
        out = a.copy()
        ambiguous_fg = (a > lo) & (a < hi) & (s > 0)
        out[ambiguous_fg] = np.maximum(out[ambiguous_fg], 220)
        weak_bg = (a < 80) & (s == 0)
        out[weak_bg] = 0
        sam_only_fg = (a < 30) & (s > 0)
        out[sam_only_fg] = 200
        return out.clip(0, 255).astype(np.uint8)

    # trust_birefnet (default) — SAM2 solo como filtro de BG
    out = a.copy()

    # Verificar coherencia global. Si SAM2 cubre mucho menos area que
    # BiRefNet (mascara SAM2 deficiente) ignorar SAM2 completamente.
    bref_fg_area = float((a > 80).sum())
    sam_fg_area = float((s > 0).sum())
    if bref_fg_area > 0:
        sam_coverage_ratio = sam_fg_area / bref_fg_area
        if logger:
            logger.info(f"fusion: SAM2/BiRefNet area ratio = {sam_coverage_ratio:.2f}")
        # Si SAM2 cubre menos del 50% del area de BiRefNet, descartar SAM2
        # (mascara SAM2 con muchos huecos internos, perderia FG legitimo)
        if sam_coverage_ratio < 0.5:
            if logger:
                logger.warning(
                    "SAM2 mascara incompleta (cobertura < 50%% vs BiRefNet) — ignoro SAM2"
                )
            return out.clip(0, 255).astype(np.uint8)

    # Solo quitar alpha donde SAM2 dice claramente BG y BiRefNet duda (< 100)
    # NUNCA subir alpha de BiRefNet.
    very_weak_bref_and_sam_bg = (a < 100) & (s == 0)
    out[very_weak_bref_and_sam_bg] = 0

    return out.clip(0, 255).astype(np.uint8)
