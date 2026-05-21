"""Preprocesado: deteccion de fondo claro + boost de contraste local.

Para sneakers blancas sobre fondo blanco/gris claro el modelo de segmentacion
tiene poca separacion tonal en los bordes. Aplicamos CLAHE en el canal L del
LAB para subir el contraste local sin distorsionar colores ni texturas. Es
una mejora puntual del INPUT para el segmentador — la imagen RGB final
para el composite es la original (intacta).
"""
from __future__ import annotations

import cv2
import numpy as np


def is_low_contrast_light_bg(rgb: np.ndarray, threshold: int = 220,
                              std_threshold: float = 25.0) -> bool:
    """Heuristica: marca True si los pixeles del borde de la imagen son claros y
    homogeneos (tipico fondo blanco/gris de producto)."""
    h, w, _ = rgb.shape
    border_thickness = max(8, min(h, w) // 40)
    top = rgb[:border_thickness, :, :]
    bot = rgb[-border_thickness:, :, :]
    lef = rgb[:, :border_thickness, :]
    rig = rgb[:, -border_thickness:, :]
    border = np.concatenate([top.reshape(-1, 3),
                             bot.reshape(-1, 3),
                             lef.reshape(-1, 3),
                             rig.reshape(-1, 3)], axis=0)
    mean = float(border.mean())
    std = float(border.std())
    return mean >= threshold and std <= std_threshold


def enhance_local_contrast(rgb: np.ndarray, clip_limit: float = 2.0,
                            tile_size: int = 8) -> np.ndarray:
    """CLAHE sobre canal L del LAB. Sube contraste local, preserva color."""
    lab = cv2.cvtColor(rgb, cv2.COLOR_RGB2LAB)
    l, a, b = cv2.split(lab)
    clahe = cv2.createCLAHE(clipLimit=clip_limit,
                            tileGridSize=(tile_size, tile_size))
    l_eq = clahe.apply(l)
    lab_eq = cv2.merge([l_eq, a, b])
    return cv2.cvtColor(lab_eq, cv2.COLOR_LAB2RGB)


def maybe_enhance(rgb: np.ndarray, clip_limit: float, tile_size: int,
                   logger=None) -> tuple[np.ndarray, bool]:
    """Devuelve (rgb_ajustado, applied)."""
    if is_low_contrast_light_bg(rgb):
        if logger:
            logger.info("fondo claro detectado → CLAHE local L*")
        return enhance_local_contrast(rgb, clip_limit, tile_size), True
    return rgb, False
