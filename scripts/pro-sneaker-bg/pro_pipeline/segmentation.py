"""Segmentacion primaria (BiRefNet via rembg) + refinamiento SAM2 opcional.

Estrategia:
  1) BiRefNet produce alpha continua (con alpha matting interno de rembg).
  2) Si SAM2 esta disponible, generamos puntos prompt desde el centroide y
     bordes salientes de la mascara BiRefNet y refinamos.
  3) Fusion: usamos AND/OR pesado segun confianza.
  4) Fallback: si BiRefNet falla, ISNet-general-use. Si todo falla, GrabCut.
"""
from __future__ import annotations

from typing import Optional

import numpy as np
from PIL import Image

# Lazy imports — segmentation cargado bajo demanda
_rembg = None
_sam2 = None


def _import_rembg():
    global _rembg
    if _rembg is None:
        from rembg import remove, new_session
        _rembg = (remove, new_session)
    return _rembg


_REMBG_SESSIONS = {}


def _get_session(model: str):
    if model not in _REMBG_SESSIONS:
        _, new_session = _import_rembg()
        _REMBG_SESSIONS[model] = new_session(model)
    return _REMBG_SESSIONS[model]


def segment_birefnet(rgb: np.ndarray, model: str, alpha_matting: bool,
                      fg_threshold: int, bg_threshold: int,
                      erode_size: int) -> np.ndarray:
    """Devuelve alpha uint8 (H,W) en escala 0..255."""
    remove, _ = _import_rembg()
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
    return np.full(rgb.shape[:2], 255, dtype=np.uint8)


def segment_with_fallback(rgb: np.ndarray, primary_model: str, alpha_matting: bool,
                           fg_th: int, bg_th: int, erode_size: int,
                           logger=None) -> np.ndarray:
    """Intenta primary → ISNet → GrabCut. Nunca devuelve None."""
    try:
        return segment_birefnet(rgb, primary_model, alpha_matting,
                                fg_th, bg_th, erode_size)
    except Exception as e:
        if logger:
            logger.warning(f"primary ({primary_model}) fallo: {e} — fallback ISNet")
    try:
        return segment_birefnet(rgb, "isnet-general-use", alpha_matting,
                                fg_th, bg_th, erode_size)
    except Exception as e:
        if logger:
            logger.warning(f"ISNet fallo: {e} — fallback GrabCut")
    return _grabcut_fallback(rgb)


def _grabcut_fallback(rgb: np.ndarray) -> np.ndarray:
    """Ultimo recurso: GrabCut con rectangulo central."""
    import cv2
    h, w = rgb.shape[:2]
    mask = np.zeros((h, w), np.uint8)
    rect = (w // 10, h // 10, w * 8 // 10, h * 8 // 10)
    bgd = np.zeros((1, 65), np.float64)
    fgd = np.zeros((1, 65), np.float64)
    bgr = cv2.cvtColor(rgb, cv2.COLOR_RGB2BGR)
    cv2.grabCut(bgr, mask, rect, bgd, fgd, 5, cv2.GC_INIT_WITH_RECT)
    out = np.where((mask == 1) | (mask == 3), 255, 0).astype(np.uint8)
    return out


# ---------- SAM2 refinement (opcional) ----------

class SAM2Refiner:
    """Wrapper opcional. Si SAM2 no esta instalado, queda inerte."""

    def __init__(self, checkpoint_path, config_path, device: str = "cpu", logger=None):
        self.predictor = None
        self.logger = logger
        try:
            from sam2.build_sam import build_sam2
            from sam2.sam2_image_predictor import SAM2ImagePredictor
        except ImportError:
            if logger:
                logger.info("SAM2 no instalado — saltando refinamiento SAM2")
            return
        if checkpoint_path is None or not checkpoint_path.exists():
            if logger:
                logger.info(f"checkpoint SAM2 no encontrado en {checkpoint_path} — saltando")
            return
        try:
            sam2 = build_sam2(config_path, str(checkpoint_path), device=device)
            self.predictor = SAM2ImagePredictor(sam2)
            if logger:
                logger.info(f"SAM2 cargado ({device})")
        except Exception as e:
            if logger:
                logger.warning(f"no se pudo cargar SAM2: {e}")

    @property
    def available(self) -> bool:
        return self.predictor is not None

    def refine(self, rgb: np.ndarray, base_mask: np.ndarray) -> Optional[np.ndarray]:
        """Refina base_mask con SAM2 usando puntos derivados del centroide y bordes."""
        if not self.available:
            return None
        import cv2
        bin_mask = (base_mask > 127).astype(np.uint8) * 255
        m = cv2.moments(bin_mask)
        if m["m00"] < 1:
            return None
        cx = int(m["m10"] / m["m00"])
        cy = int(m["m01"] / m["m00"])
        # puntos positivos: centroide + 4 puntos interiores
        ys, xs = np.where(bin_mask > 0)
        if len(xs) < 50:
            return None
        idx = np.linspace(0, len(xs) - 1, 5).astype(int)
        pos_pts = np.array([[cx, cy]] + [[xs[i], ys[i]] for i in idx], dtype=np.int32)
        # puntos negativos: corners (asumir fondo en bordes)
        h, w = rgb.shape[:2]
        neg_pts = np.array([[10, 10], [w - 10, 10],
                            [10, h - 10], [w - 10, h - 10]], dtype=np.int32)
        pts = np.concatenate([pos_pts, neg_pts], axis=0)
        labels = np.array([1] * len(pos_pts) + [0] * len(neg_pts), dtype=np.int32)

        try:
            self.predictor.set_image(rgb)
            masks, scores, _ = self.predictor.predict(
                point_coords=pts,
                point_labels=labels,
                multimask_output=True,
            )
        except Exception as e:
            if self.logger:
                self.logger.warning(f"SAM2 predict fallo: {e}")
            return None
        if masks is None or len(masks) == 0:
            return None
        best = int(np.argmax(scores))
        sam_mask = (masks[best].astype(np.uint8)) * 255
        return sam_mask


def fuse_masks(birefnet_alpha: np.ndarray, sam_mask: Optional[np.ndarray]) -> np.ndarray:
    """Fusion conservadora:
       - donde ambos coinciden con FG fuerte → FG fuerte
       - donde solo SAM dice FG y BiRefNet ambigua (50..200) → mantiene BiRefNet
       - donde BiRefNet > 230 → trust BiRefNet (bordes fine-grained)
       Resultado: mascara base mas robusta sin perder detalle BiRefNet.
    """
    if sam_mask is None:
        return birefnet_alpha
    if sam_mask.shape != birefnet_alpha.shape:
        import cv2
        sam_mask = cv2.resize(sam_mask, (birefnet_alpha.shape[1], birefnet_alpha.shape[0]),
                              interpolation=cv2.INTER_NEAREST)
    a = birefnet_alpha.astype(np.float32)
    s = (sam_mask > 127).astype(np.float32) * 255.0
    # Solo movemos a 255 zonas donde BiRefNet esta ambigua pero SAM cree firmemente FG
    ambiguous_fg = (a > 30) & (a < 230) & (s > 0)
    out = a.copy()
    out[ambiguous_fg] = np.maximum(out[ambiguous_fg], 220)  # push up, no a 255 puro
    # Zonas donde SAM dice claramente BG y BiRefNet < 80 → 0
    weak_bg = (a < 80) & (s == 0)
    out[weak_bg] = 0
    return out.clip(0, 255).astype(np.uint8)
