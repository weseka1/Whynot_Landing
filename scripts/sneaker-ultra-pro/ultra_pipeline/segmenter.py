"""Etapa 2 — SAM2 (Meta) como motor de segmentacion principal.

Estrategia auto-prompt:
  1. seed inicial — rectangulo central (asume objeto centrado, comun en
     fotografia 360 de producto).
  2. genera mascara provisional con SAM2 (multimask_output=True).
  3. elige la mejor por score.
  4. construye prompts refinados:
        - positivos: centroide + N puntos interiores (estratificados)
        - negativos: corners de la imagen (asumimos BG en esquinas)
  5. segundo pass de SAM2 con esos prompts → mascara final + score.

Si SAM2 no esta disponible (no instalado o checkpoint faltante), la funcion
'segment' devuelve None y el pipeline cae al fallback BiRefNet-only.
"""
from __future__ import annotations

from typing import Optional

import cv2
import numpy as np


class SAM2Segmenter:
    def __init__(self, checkpoint_path, config_path: str, device: str = "cpu",
                 use_fp16: bool = False, logger=None):
        self.predictor = None
        self.device = device
        self.use_fp16 = use_fp16 and device != "cpu"
        self.logger = logger
        self._image_set = False
        try:
            from sam2.build_sam import build_sam2
            from sam2.sam2_image_predictor import SAM2ImagePredictor
        except ImportError:
            if logger:
                logger.warning("SAM2 no instalado — pip install git+https://github.com/facebookresearch/sam2.git")
            return
        if checkpoint_path is None or not checkpoint_path.exists():
            if logger:
                logger.warning(f"checkpoint SAM2 no encontrado: {checkpoint_path}")
            return
        try:
            sam2 = build_sam2(config_path, str(checkpoint_path), device=device)
            self.predictor = SAM2ImagePredictor(sam2)
            if logger:
                logger.info(f"SAM2 cargado ({device}, fp16={self.use_fp16})")
        except Exception as e:
            if logger:
                logger.warning(f"no se pudo cargar SAM2: {e}")

    @property
    def available(self) -> bool:
        return self.predictor is not None

    # ---- prompt builders ----

    @staticmethod
    def _center_rect(h: int, w: int, frac: float = 0.7) -> np.ndarray:
        cy, cx = h / 2.0, w / 2.0
        rh, rw = h * frac, w * frac
        x0, y0 = int(cx - rw / 2), int(cy - rh / 2)
        x1, y1 = int(cx + rw / 2), int(cy + rh / 2)
        return np.array([x0, y0, x1, y1], dtype=np.int32)

    @staticmethod
    def _grid_inside_mask(mask: np.ndarray, n_points: int) -> np.ndarray:
        ys, xs = np.where(mask > 127)
        if len(xs) < n_points:
            return np.zeros((0, 2), dtype=np.int32)
        idx = np.linspace(0, len(xs) - 1, n_points).astype(int)
        return np.stack([xs[idx], ys[idx]], axis=1).astype(np.int32)

    @staticmethod
    def _corner_neg(h: int, w: int, pad: int) -> np.ndarray:
        return np.array([
            [pad, pad],
            [w - pad, pad],
            [pad, h - pad],
            [w - pad, h - pad],
            [w // 2, pad],
            [w // 2, h - pad],
        ], dtype=np.int32)

    # ---- public API ----

    def segment(self, rgb: np.ndarray, multimask: bool = True,
                grid_points: int = 5, neg_pad: int = 12) -> Optional[dict]:
        """Devuelve dict con keys:
            - 'alpha'       : (H,W) uint8 0..255 (mascara fina)
            - 'binary'      : (H,W) uint8 binaria 0/255
            - 'score'       : float (confianza)
            - 'pass1_score' : float (pass inicial)
        """
        if not self.available:
            return None
        import torch
        try:
            with torch.inference_mode():
                if self.use_fp16:
                    ctx = torch.autocast(self.device, dtype=torch.float16)
                else:
                    ctx = torch.autocast(self.device, dtype=torch.float32, enabled=False)
                with ctx:
                    self.predictor.set_image(rgb)
                    self._image_set = True
                    h, w = rgb.shape[:2]

                    # PASS 1 — bbox prompt central
                    box = self._center_rect(h, w, frac=0.78)
                    masks, scores, _ = self.predictor.predict(
                        box=box[None, :],
                        multimask_output=multimask,
                    )
                    if masks is None or len(masks) == 0:
                        return None
                    best = int(np.argmax(scores))
                    mask1 = (masks[best] > 0.5).astype(np.uint8) * 255
                    score1 = float(scores[best])

                    # Si la mascara cubre menos del 1% o mas del 99%, descartar y usar fallback prompt
                    coverage = mask1.mean() / 255.0
                    if coverage < 0.01 or coverage > 0.99:
                        if self.logger:
                            self.logger.warning(f"SAM2 pass1 coverage {coverage:.3f} — fallback prompt")
                        return None

                    # PASS 2 — refinar con prompts derivados
                    pos = self._grid_inside_mask(mask1, n_points=grid_points + 1)  # incluye centroide
                    if len(pos) == 0:
                        return {
                            "alpha": (masks[best] * 255).clip(0, 255).astype(np.uint8),
                            "binary": mask1,
                            "score": score1,
                            "pass1_score": score1,
                        }
                    neg = self._corner_neg(h, w, pad=neg_pad)
                    pts = np.concatenate([pos, neg], axis=0).astype(np.float32)
                    labels = np.array(
                        [1] * len(pos) + [0] * len(neg), dtype=np.int32
                    )
                    masks2, scores2, _ = self.predictor.predict(
                        point_coords=pts,
                        point_labels=labels,
                        box=box[None, :],
                        multimask_output=multimask,
                    )
                    if masks2 is None or len(masks2) == 0:
                        return {
                            "alpha": (masks[best] * 255).clip(0, 255).astype(np.uint8),
                            "binary": mask1,
                            "score": score1,
                            "pass1_score": score1,
                        }
                    best2 = int(np.argmax(scores2))
                    raw2 = masks2[best2]
                    alpha2 = (raw2.clip(0, 1) * 255).astype(np.uint8) if raw2.dtype != np.bool_ \
                            else (raw2.astype(np.uint8) * 255)
                    binary2 = (raw2 > 0.5).astype(np.uint8) * 255
                    score2 = float(scores2[best2])

                    return {
                        "alpha": alpha2,
                        "binary": binary2,
                        "score": score2,
                        "pass1_score": score1,
                    }
        except Exception as e:
            if self.logger:
                self.logger.warning(f"SAM2 predict fallo: {e}")
            return None


# ---------- GrabCut fallback (cuando SAM2 no esta disponible o falla) ----------

def grabcut_fallback(rgb: np.ndarray, iter_count: int = 5) -> np.ndarray:
    """Fallback ultimo: GrabCut con rectangulo central."""
    h, w = rgb.shape[:2]
    mask = np.zeros((h, w), np.uint8)
    rect = (w // 10, h // 10, w * 8 // 10, h * 8 // 10)
    bgd = np.zeros((1, 65), np.float64)
    fgd = np.zeros((1, 65), np.float64)
    bgr = cv2.cvtColor(rgb, cv2.COLOR_RGB2BGR)
    cv2.grabCut(bgr, mask, rect, bgd, fgd, iter_count, cv2.GC_INIT_WITH_RECT)
    out = np.where((mask == 1) | (mask == 3), 255, 0).astype(np.uint8)
    return out
