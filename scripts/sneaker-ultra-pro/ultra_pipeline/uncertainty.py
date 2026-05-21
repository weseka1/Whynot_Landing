"""Etapa 5 — uncertainty refinement (edge confidence map + re-matting local).

Calcula un 'confidence map' edge-aware sobre el alpha. Pixeles con alpha
cerca de los extremos (0 o 255) y consistentes con los bordes RGB se
consideran confiables. Pixeles con alpha intermedio en zonas planas RGB
se marcan como inciertos.

Las zonas inciertas se re-procesan con un guided filter de radio mayor
+ joint bilateral. Esto recupera detalles donde VITMatte dejo banda
indeterminada (sombras suaves, transluces).
"""
from __future__ import annotations

import cv2
import numpy as np


def edge_confidence_map(alpha: np.ndarray, rgb: np.ndarray) -> np.ndarray:
    """Devuelve mapa float32 [0,1] de CONFIANZA por pixel."""
    a = alpha.astype(np.float32) / 255.0
    # 1) confianza por extremidad: alpha cerca de 0 o 255 → alta confianza
    extremity = 1.0 - 4.0 * a * (1.0 - a)   # 1 en 0/255, 0 en 0.5
    extremity = np.clip(extremity, 0, 1)

    # 2) coherencia con bordes RGB: gradiente alpha vs gradiente RGB
    gray = cv2.cvtColor(rgb, cv2.COLOR_RGB2GRAY).astype(np.float32) / 255.0
    a_gx = cv2.Sobel(a, cv2.CV_32F, 1, 0, ksize=3)
    a_gy = cv2.Sobel(a, cv2.CV_32F, 0, 1, ksize=3)
    a_mag = np.sqrt(a_gx ** 2 + a_gy ** 2)
    r_gx = cv2.Sobel(gray, cv2.CV_32F, 1, 0, ksize=3)
    r_gy = cv2.Sobel(gray, cv2.CV_32F, 0, 1, ksize=3)
    r_mag = np.sqrt(r_gx ** 2 + r_gy ** 2)
    # coherence = donde alpha gradient grande Y rgb gradient grande → coherente
    coherence = np.minimum(a_mag, r_mag) / (np.maximum(a_mag, r_mag) + 1e-3)
    coherence = np.clip(coherence, 0, 1)

    # combinacion: si el pixel es de borde (alpha en (0,1)) la coherencia
    # pesa mas; si es plano la extremidad pesa.
    border_weight = 1.0 - extremity
    conf = extremity * (1.0 - border_weight) + coherence * border_weight
    return np.clip(conf, 0, 1)


def uncertainty_mask(conf: np.ndarray, threshold: float = 0.18,
                     dilate_px: int = 6) -> np.ndarray:
    """Mascara binaria 0/255 de zonas inciertas."""
    uncertain = (conf < threshold).astype(np.uint8) * 255
    if dilate_px > 0:
        k = cv2.getStructuringElement(cv2.MORPH_RECT, (dilate_px, dilate_px))
        uncertain = cv2.dilate(uncertain, k, iterations=1)
    return uncertain


def refine_uncertain_regions(alpha: np.ndarray, rgb: np.ndarray,
                              conf_threshold: float = 0.18,
                              dilate_px: int = 6,
                              logger=None) -> np.ndarray:
    """En zonas inciertas:
        1) re-filtrado guided de radio grande (12) con RGB como guia
        2) joint bilateral medio para suavizar sin perder bordes
        3) mezcla solo donde la mascara de incertidumbre lo marca
    Devuelve alpha refinado.
    """
    conf = edge_confidence_map(alpha, rgb)
    umask = uncertainty_mask(conf, conf_threshold, dilate_px)
    if umask.sum() == 0:
        return alpha

    bgr = cv2.cvtColor(rgb, cv2.COLOR_RGB2BGR)
    try:
        alpha_g = cv2.ximgproc.guidedFilter(guide=bgr, src=alpha, radius=12, eps=1e-3)
    except Exception:
        alpha_g = alpha
    try:
        alpha_b = cv2.ximgproc.jointBilateralFilter(
            joint=bgr, src=alpha_g, d=-1,
            sigmaColor=30.0, sigmaSpace=8.0,
        )
    except Exception:
        alpha_b = alpha_g

    # mezclar solo en zonas inciertas (suave con feather pequeño)
    feather = cv2.GaussianBlur(umask.astype(np.float32) / 255.0, (5, 5), 1.0)
    feather = np.clip(feather, 0, 1)
    out = alpha.astype(np.float32) * (1 - feather) + alpha_b.astype(np.float32) * feather
    if logger:
        pct = float((umask > 0).mean() * 100.0)
        logger.info(f"uncertainty: refinado {pct:.2f}% del area")
    return out.clip(0, 255).astype(np.uint8)
