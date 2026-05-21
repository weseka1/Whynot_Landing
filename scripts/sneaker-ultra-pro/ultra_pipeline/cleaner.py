"""Etapa 6 — limpieza profesional del alpha.

  - intelligent S-curve (thresholds adaptativos por imagen)
  - guided filter multi-pass (edge-aware refinement)
  - morphological cleanup (islas chicas / huecos chicos, protege cordones)
  - joint bilateral smoothing (anti-aliasing edge-aware)
  - anti-halo color decontamination (RGB sin contaminacion de fondo blanco)

Trabaja sobre el alpha. El RGB pasado a 'decontaminate_halo' DEBE ser el
ORIGINAL (no el enhanced) — esa funcion devuelve un RGB modificado SOLO
en la banda semi-transparente del borde, manteniendo intacto el interior.
"""
from __future__ import annotations

import cv2
import numpy as np


def s_curve(alpha: np.ndarray, low: int, high: int) -> np.ndarray:
    a = alpha.astype(np.float32)
    a = (a - float(low)) * 255.0 / float(max(high - low, 1))
    return np.clip(a, 0, 255).astype(np.uint8)


def intelligent_thresholding(alpha: np.ndarray, base_low: int, base_high: int) -> tuple[int, int]:
    """Ajusta (low, high) de S-curve segun stats del alpha.
    - si hay mucho area semi-transparente -> thresholds mas conservadores
    - si el alpha es muy bimodal -> thresholds mas agresivos
    """
    a = alpha.astype(np.float32)
    mid_band = ((a > 50) & (a < 205)).mean()  # fraccion semi-trans
    # mid_band alto (>0.1) → la S-curve corre el riesgo de comer detalle: ablandar
    if mid_band > 0.10:
        low = max(20, base_low - 20)
        high = min(235, base_high + 15)
    elif mid_band < 0.02:
        # imagen muy bimodal -> agresivo
        low = min(base_low + 10, 90)
        high = max(base_high - 10, 180)
    else:
        low, high = base_low, base_high
    return low, high


def guided_multipass(alpha: np.ndarray, rgb: np.ndarray,
                      radius: int = 2, eps: float = 1e-4,
                      passes: int = 2) -> np.ndarray:
    bgr = cv2.cvtColor(rgb, cv2.COLOR_RGB2BGR)
    out = alpha
    for i in range(max(1, passes)):
        try:
            out = cv2.ximgproc.guidedFilter(guide=bgr, src=out,
                                            radius=radius, eps=eps)
        except Exception:
            break
    return out


def morphological_cleanup(alpha: np.ndarray,
                           remove_specks_below_px: int = 80,
                           fill_holes_below_px: int = 16,
                           protect_ratio: float = 0.003) -> np.ndarray:
    binary = (alpha > 64).astype(np.uint8) * 255

    # connected components — quitar islas chicas pero proteger las medianas
    # (>= protect_ratio del FG principal). Esto preserva cordones desprendidos.
    num, labels, stats, _ = cv2.connectedComponentsWithStats(binary, connectivity=8)
    if num > 1:
        areas = stats[1:, cv2.CC_STAT_AREA]
        if len(areas) > 0:
            largest = 1 + int(np.argmax(areas))
            largest_area = int(areas[largest - 1])
            for k in range(1, num):
                if k == largest:
                    continue
                area = int(stats[k, cv2.CC_STAT_AREA])
                if area < remove_specks_below_px and area < largest_area * protect_ratio:
                    binary[labels == k] = 0

    # rellenar huecos chicos en FG (sin tocar huecos que tocan el borde)
    inv = 255 - binary
    num_h, labels_h, stats_h, _ = cv2.connectedComponentsWithStats(inv, connectivity=8)
    H, W = binary.shape
    for k in range(1, num_h):
        area = int(stats_h[k, cv2.CC_STAT_AREA])
        x = stats_h[k, cv2.CC_STAT_LEFT]
        y = stats_h[k, cv2.CC_STAT_TOP]
        w = stats_h[k, cv2.CC_STAT_WIDTH]
        h = stats_h[k, cv2.CC_STAT_HEIGHT]
        if x == 0 or y == 0 or x + w == W or y + h == H:
            continue
        if area < fill_holes_below_px:
            binary[labels_h == k] = 255

    cleaned = alpha.copy()
    cleaned[binary == 0] = 0
    return cleaned


def joint_bilateral_smooth(alpha: np.ndarray, rgb: np.ndarray,
                            sigma_space: float = 5.0,
                            sigma_color: float = 25.0) -> np.ndarray:
    try:
        return cv2.ximgproc.jointBilateralFilter(
            joint=cv2.cvtColor(rgb, cv2.COLOR_RGB2BGR),
            src=alpha,
            d=-1,
            sigmaColor=sigma_color,
            sigmaSpace=sigma_space,
        )
    except Exception:
        return alpha


def decontaminate_halo(rgb: np.ndarray, alpha: np.ndarray,
                        inner_radius: int = 5,
                        protect_alpha: int = 250) -> np.ndarray:
    """Anti-halo color decontamination.

    En la banda semi-transparente, el RGB esta contaminado por el fondo.
    Reemplazamos ese RGB por el color promedio del FG firme vecino, dentro
    de una ventana de radio 'inner_radius'. La banda con alpha >=
    protect_alpha se considera FG firme y NO se toca (preserva textura).

    Devuelve nuevo RGB. NO toca alpha.
    """
    h, w, _ = rgb.shape
    fg_firm = (alpha >= protect_alpha).astype(np.uint8) * 255
    semi = ((alpha > 8) & (alpha < protect_alpha))
    if not semi.any() or not (fg_firm > 0).any():
        return rgb

    rgb_f = rgb.astype(np.float32)
    weight2d = fg_firm.astype(np.float32) / 255.0
    rgb_w = rgb_f * weight2d[:, :, None]
    k = int(inner_radius * 2 + 1)
    rgb_sum = cv2.boxFilter(rgb_w, ddepth=-1, ksize=(k, k), normalize=False)
    w_sum = cv2.boxFilter(weight2d, ddepth=-1, ksize=(k, k), normalize=False)
    w_sum = np.maximum(w_sum, 1e-6)
    rgb_avg = rgb_sum / w_sum[:, :, None]

    out = rgb_f.copy()
    out[semi] = rgb_avg[semi]
    return out.clip(0, 255).astype(np.uint8)


def full_clean(alpha: np.ndarray, rgb_for_guide: np.ndarray, cfg,
                logger=None) -> tuple[np.ndarray, np.ndarray]:
    """Aplica toda la cadena de limpieza al alpha y devuelve (alpha_clean, rgb_clean).

    'rgb_for_guide' DEBE ser el RGB ORIGINAL (sin alteracion IA). Sale rgb_clean
    con decontaminacion anti-halo aplicada SOLO en banda semi-trans.
    """
    # 1) intelligent thresholding + S-curve
    if cfg.alpha_boost_enabled:
        if cfg.intelligent_thresholding:
            low, high = intelligent_thresholding(alpha, cfg.alpha_boost_low,
                                                  cfg.alpha_boost_high)
            if logger:
                logger.info(f"S-curve auto: low={low} high={high}")
        else:
            low, high = cfg.alpha_boost_low, cfg.alpha_boost_high
        alpha = s_curve(alpha, low, high)

    # 2) guided multi-pass
    alpha = guided_multipass(alpha, rgb_for_guide,
                              radius=cfg.guided_radius,
                              eps=cfg.guided_eps,
                              passes=cfg.guided_passes)

    # 3) morphological cleanup
    alpha = morphological_cleanup(
        alpha,
        remove_specks_below_px=cfg.morph_remove_specks_below_px,
        fill_holes_below_px=cfg.morph_fill_holes_below_px,
        protect_ratio=cfg.morph_protect_islands_above_ratio,
    )

    # 4) joint bilateral smoothing
    if cfg.joint_bilateral_enabled:
        alpha = joint_bilateral_smooth(
            alpha, rgb_for_guide,
            sigma_space=cfg.bilateral_sigma_space,
            sigma_color=cfg.bilateral_sigma_color,
        )

    # 5) anti-halo decontamination
    if cfg.decontaminate_halo:
        rgb_clean = decontaminate_halo(
            rgb_for_guide, alpha,
            inner_radius=cfg.halo_inner_radius,
            protect_alpha=cfg.halo_protect_alpha,
        )
    else:
        rgb_clean = rgb_for_guide

    return alpha, rgb_clean
