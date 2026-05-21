"""Post-procesado de alpha: boost, guided filter, anti-halo, morfologia.

Cada funcion devuelve un alpha uint8 nuevo (H,W). Los pasos se aplican en
secuencia desde el alpha refinado por VITMatte hasta el alpha final.
"""
from __future__ import annotations

import cv2
import numpy as np


def alpha_boost_scurve(alpha: np.ndarray, low: int = 60, high: int = 200) -> np.ndarray:
    """S-curve sobre alpha:
        alpha 0..low    → 0
        alpha low..high → expandido linealmente a 0..255
        alpha high..255 → 255
    Elimina semi-transparencias residuales en bordes interiores (huecos blancos
    fantasma) sin tocar transparencias legitimas en cordones/transluces.
    """
    a = alpha.astype(np.float32)
    a = (a - float(low)) * 255.0 / float(high - low)
    return np.clip(a, 0, 255).astype(np.uint8)


def guided_filter_alpha(alpha: np.ndarray, rgb_guide: np.ndarray,
                         radius: int = 2, eps: float = 1e-4) -> np.ndarray:
    """Edge-aware refinement: alinea bordes del alpha con los bordes del RGB."""
    bgr = cv2.cvtColor(rgb_guide, cv2.COLOR_RGB2BGR)
    return cv2.ximgproc.guidedFilter(guide=bgr, src=alpha, radius=radius, eps=eps)


def morphological_cleanup(alpha: np.ndarray,
                           remove_specks_below_px: int = 64,
                           fill_holes_below_px: int = 16) -> np.ndarray:
    """Remueve islas chicas (manchas BG) y rellena huecos chicos en FG.
    Trabaja sobre una version binarizada y luego re-aplica la transparencia
    fina del alpha original donde sigue siendo FG.
    """
    binary = (alpha > 64).astype(np.uint8) * 255

    # 1) Quitar islas chicas (connected components)
    num, labels, stats, _ = cv2.connectedComponentsWithStats(binary, connectivity=8)
    if num > 1:
        # Componente 0 = fondo. Identificamos el componente FG mas grande.
        areas = stats[1:, cv2.CC_STAT_AREA]
        if len(areas) > 0:
            largest = 1 + int(np.argmax(areas))
            largest_area = int(areas[largest - 1])
            for k in range(1, num):
                if k == largest:
                    continue
                area = int(stats[k, cv2.CC_STAT_AREA])
                # Conservar islas medianas (cordones desprendidos) — solo borrar
                # las muy chicas y las que son <0.5% del FG principal
                if area < remove_specks_below_px or area < largest_area * 0.005:
                    binary[labels == k] = 0

    # 2) Rellenar huecos chicos en el FG
    inverted = 255 - binary
    num_h, labels_h, stats_h, _ = cv2.connectedComponentsWithStats(inverted, connectivity=8)
    H, W = binary.shape
    border_area = (H * 2 + W * 2) * 2
    for k in range(1, num_h):
        area = int(stats_h[k, cv2.CC_STAT_AREA])
        x = stats_h[k, cv2.CC_STAT_LEFT]
        y = stats_h[k, cv2.CC_STAT_TOP]
        w = stats_h[k, cv2.CC_STAT_WIDTH]
        h = stats_h[k, cv2.CC_STAT_HEIGHT]
        touches_border = (x == 0 or y == 0 or x + w == W or y + h == H)
        if not touches_border and area < fill_holes_below_px and area < border_area:
            binary[labels_h == k] = 255

    # 3) Donde antes habia FG en alpha y ahora binary lo confirma → mantener
    #    el alpha original (preserva transparencia fina de cordones).
    #    Donde binary=0 → forzar alpha=0.
    cleaned = alpha.copy()
    cleaned[binary == 0] = 0
    return cleaned


def decontaminate_halo(rgb: np.ndarray, alpha: np.ndarray,
                        inner_radius: int = 4) -> np.ndarray:
    """Anti-halo color decontamination.

    En bordes semi-transparentes (0 < alpha < 255) el color RGB del pixel suele
    estar contaminado por el fondo (blanco). Reemplazamos ese RGB por el color
    promedio del FG vecino (sample a 'inner_radius' px hacia adentro).

    Resultado: el alpha sigue dando transparencia suave, pero el color base es
    el del objeto, no del fondo. Esto elimina visualmente el halo blanco al
    componer sobre cualquier fondo.

    Devuelve nuevo RGB (no toca alpha).
    """
    h, w, _ = rgb.shape
    # Mascara FG firme
    fg_firm = (alpha > 240).astype(np.uint8) * 255
    # Banda semi-transparente
    semi = ((alpha > 8) & (alpha < 240))
    if not semi.any() or not (fg_firm > 0).any():
        return rgb

    # Mean blur del RGB ponderado por fg_firm → color FG promedio en ventana
    # de inner_radius*2 alrededor de cada pixel.
    rgb_f = rgb.astype(np.float32)
    weight2d = fg_firm.astype(np.float32) / 255.0   # (H,W)
    rgb_w = rgb_f * weight2d[:, :, None]            # (H,W,3)
    k = int(inner_radius * 2 + 1)
    rgb_sum = cv2.boxFilter(rgb_w, ddepth=-1, ksize=(k, k), normalize=False)
    weight_sum = cv2.boxFilter(weight2d, ddepth=-1, ksize=(k, k), normalize=False)
    weight_sum = np.maximum(weight_sum, 1e-6)        # (H,W)
    rgb_avg = rgb_sum / weight_sum[:, :, None]       # broadcast (H,W,1) sobre (H,W,3)

    # Reemplazar SOLO la banda semi-transparente
    out = rgb_f.copy()
    out[semi] = rgb_avg[semi]
    return out.clip(0, 255).astype(np.uint8)


def edge_aware_smooth(alpha: np.ndarray, rgb_guide: np.ndarray,
                       sigma_space: float = 5.0,
                       sigma_color: float = 25.0) -> np.ndarray:
    """Suavizado bilateral preservando bordes. Util para reducir alising sin
    comer detalle."""
    return cv2.ximgproc.jointBilateralFilter(
        joint=cv2.cvtColor(rgb_guide, cv2.COLOR_RGB2BGR),
        src=alpha,
        d=-1,
        sigmaColor=sigma_color,
        sigmaSpace=sigma_space,
    )
