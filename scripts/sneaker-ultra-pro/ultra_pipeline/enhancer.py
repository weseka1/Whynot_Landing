"""Etapa 1 — pre-enhancement IA AUXILIAR.

Objetivo: mejorar el input de los modelos de segmentacion (SAM2, BiRefNet,
VITMatte) cuando la escena tiene bajo contraste (blanco sobre blanco, gris
sobre gris). La imagen mejorada NUNCA se exporta — solo se pasa a los
segmentadores. La composicion final usa la imagen ORIGINAL.

Combina:
  - deteccion automatica de fondo claro / bajo contraste
  - CLAHE adaptativo en L del LAB (sube contraste local sin saturar color)
  - unsharp mask inteligente (sharpen edge-aware, threshold para no
    amplificar grano de JPG)
  - Real-ESRGAN x4 (via ncnn-vulkan, AMD/NVIDIA/Intel compatible) — recupera
    bordes finos y duplica densidad de pixeles para que VITMatte tenga mas
    pixeles de banda 'unknown' donde refinar.
"""
from __future__ import annotations

import shutil
import subprocess
from pathlib import Path

import cv2
import numpy as np
from PIL import Image


# ---------- low-contrast / light-bg detection ----------

def is_low_contrast_light_bg(rgb: np.ndarray,
                              brightness_threshold: int = 200,
                              std_threshold: float = 30.0) -> bool:
    """Heuristica: True si los pixeles del borde son claros y homogeneos."""
    h, w, _ = rgb.shape
    thick = max(8, min(h, w) // 40)
    top = rgb[:thick, :, :]
    bot = rgb[-thick:, :, :]
    lef = rgb[:, :thick, :]
    rig = rgb[:, -thick:, :]
    border = np.concatenate([top.reshape(-1, 3),
                             bot.reshape(-1, 3),
                             lef.reshape(-1, 3),
                             rig.reshape(-1, 3)], axis=0)
    mean = float(border.mean())
    std = float(border.std())
    return mean >= brightness_threshold and std <= std_threshold


def detect_contrast_class(rgb: np.ndarray) -> str:
    """Clasifica la escena:
        - 'white_on_white'  : fondo claro homogeneo, objeto claro
        - 'low_contrast'    : bajo contraste general (gris sobre gris)
        - 'normal'          : contraste OK
    """
    h, w, _ = rgb.shape
    thick = max(8, min(h, w) // 40)
    border = np.concatenate([
        rgb[:thick, :, :].reshape(-1, 3),
        rgb[-thick:, :, :].reshape(-1, 3),
        rgb[:, :thick, :].reshape(-1, 3),
        rgb[:, -thick:, :].reshape(-1, 3),
    ], axis=0)
    bm, bs = float(border.mean()), float(border.std())
    gm, gs = float(rgb.mean()), float(rgb.std())

    if bm >= 220 and bs <= 20 and gm >= 180:
        return "white_on_white"
    if gs <= 35:
        return "low_contrast"
    return "normal"


# ---------- CLAHE adaptativo ----------

def clahe_lab(rgb: np.ndarray, clip_limit: float = 2.5,
              tile_size: int = 8) -> np.ndarray:
    """CLAHE sobre canal L del LAB. Sube contraste local, preserva color."""
    lab = cv2.cvtColor(rgb, cv2.COLOR_RGB2LAB)
    l, a, b = cv2.split(lab)
    clahe = cv2.createCLAHE(clipLimit=clip_limit,
                            tileGridSize=(tile_size, tile_size))
    l_eq = clahe.apply(l)
    lab_eq = cv2.merge([l_eq, a, b])
    return cv2.cvtColor(lab_eq, cv2.COLOR_LAB2RGB)


def adaptive_clahe(rgb: np.ndarray, base_clip: float, tile_size: int) -> np.ndarray:
    """CLAHE con clipLimit ajustado segun la varianza global de la imagen.
    Imagenes muy planas reciben mas boost; imagenes ya contrastadas menos.
    """
    g_std = float(rgb.std())
    # std baja (< 30) → boost 1.5x, std alta (> 60) → boost 0.75x
    factor = float(np.clip(45.0 / max(g_std, 1.0), 0.75, 1.6))
    clip = base_clip * factor
    return clahe_lab(rgb, clip_limit=clip, tile_size=tile_size)


# ---------- intelligent unsharp ----------

def unsharp_mask(rgb: np.ndarray, amount: float = 0.6,
                  radius: float = 1.2, threshold: int = 3) -> np.ndarray:
    """Unsharp con threshold: solo amplifica diferencias > threshold (no toca
    zonas planas, asi no amplifica grano de JPG)."""
    blurred = cv2.GaussianBlur(rgb, (0, 0), sigmaX=radius, sigmaY=radius)
    diff = rgb.astype(np.int16) - blurred.astype(np.int16)
    mask = (np.abs(diff) >= threshold).astype(np.float32)
    sharp = rgb.astype(np.float32) + diff.astype(np.float32) * amount * mask
    return np.clip(sharp, 0, 255).astype(np.uint8)


# ---------- adaptive local contrast (para white-on-white extremo) ----------

def adaptive_local_contrast(rgb: np.ndarray) -> np.ndarray:
    """Stretch local de luminancia: la zona donde la varianza es muy baja
    recibe un boost lineal de contraste basado en el rango local.
    Util para fondo blanco contra suela blanca / cuero blanco.
    """
    lab = cv2.cvtColor(rgb, cv2.COLOR_RGB2LAB)
    l = lab[:, :, 0].astype(np.float32)
    # rango local en ventana grande
    kx = 31
    l_min = cv2.erode(l, np.ones((kx, kx), np.uint8))
    l_max = cv2.dilate(l, np.ones((kx, kx), np.uint8))
    rng = np.maximum(l_max - l_min, 1.0)
    # stretch: lleva l_min->0, l_max->255 localmente
    l_stretched = (l - l_min) * (255.0 / rng)
    # blend conservador (no rompemos color/foto)
    l_out = (0.55 * l + 0.45 * l_stretched).clip(0, 255).astype(np.uint8)
    lab[:, :, 0] = l_out
    return cv2.cvtColor(lab, cv2.COLOR_LAB2RGB)


# ---------- Real-ESRGAN wrapper ----------

class RealESRGAN:
    def __init__(self, bin_path: Path, model: str, scale: int, logger=None):
        self.bin_path = bin_path
        self.model = model
        self.scale = scale
        self.logger = logger
        self.available = bin_path.exists() if bin_path else False
        if not self.available and logger:
            logger.warning(f"Real-ESRGAN no encontrado en {bin_path} — pass-through")

    def upscale_file(self, in_path: Path, out_path: Path) -> bool:
        if not self.available:
            shutil.copyfile(in_path, out_path)
            return False
        try:
            subprocess.run(
                [
                    str(self.bin_path),
                    "-i", str(in_path),
                    "-o", str(out_path),
                    "-n", self.model,
                    "-s", str(self.scale),
                    "-t", "32",
                    "-j", "1:1:1",
                ],
                check=True,
                stdout=subprocess.DEVNULL,
                stderr=subprocess.PIPE,
                timeout=600,
            )
            return True
        except (subprocess.CalledProcessError, subprocess.TimeoutExpired) as e:
            if self.logger:
                self.logger.warning(f"Real-ESRGAN fallo ({e}) — pass-through")
            shutil.copyfile(in_path, out_path)
            return False


# ---------- pipeline-facing API ----------

def enhance_for_segmentation(rgb_orig: np.ndarray, cfg, upscaler: RealESRGAN,
                              tmp_dir: Path, logger=None) -> tuple[np.ndarray, dict]:
    """Produce el RGB que se le pasa a los segmentadores.

    Pasos (todos opcionales por config):
      1. detectar tipo de contraste
      2. CLAHE adaptativo
      3. adaptive local contrast (solo en white-on-white)
      4. unsharp mask inteligente
      5. Real-ESRGAN x4 upscale

    Devuelve (rgb_enhanced_upscaled, meta) donde 'meta' incluye:
      - 'contrast_class'
      - 'clahe_applied', 'unsharp_applied', 'localcontrast_applied'
      - 'upscale_ok'
      - 'scale' (factor aplicado: 4 si esrgan ok, 1 si pass-through)
    """
    meta: dict = {}
    work = rgb_orig

    if cfg.enhance_enabled and cfg.detect_low_contrast:
        cls = detect_contrast_class(rgb_orig)
    else:
        cls = "normal"
    meta["contrast_class"] = cls

    # 2) CLAHE: siempre que enhance_enabled. Adaptativo si bajo contraste.
    if cfg.enhance_enabled and cfg.clahe_enabled:
        if cls in ("white_on_white", "low_contrast"):
            work = adaptive_clahe(work, cfg.clahe_clip_limit, cfg.clahe_tile_size)
        else:
            work = clahe_lab(work, cfg.clahe_clip_limit, cfg.clahe_tile_size)
        meta["clahe_applied"] = True
    else:
        meta["clahe_applied"] = False

    # 3) Adaptive local contrast (solo white-on-white extremo)
    if cfg.enhance_enabled and cfg.adaptive_local_contrast and cls == "white_on_white":
        work = adaptive_local_contrast(work)
        meta["localcontrast_applied"] = True
    else:
        meta["localcontrast_applied"] = False

    # 4) Unsharp
    if cfg.enhance_enabled and cfg.unsharp_enabled:
        work = unsharp_mask(work, cfg.unsharp_amount, cfg.unsharp_radius,
                             cfg.unsharp_threshold)
        meta["unsharp_applied"] = True
    else:
        meta["unsharp_applied"] = False

    # 5) Real-ESRGAN x4
    if cfg.enhance_enabled and cfg.upscale_enabled:
        tmp_in = tmp_dir / "enh_in.png"
        tmp_out = tmp_dir / "enh_up.png"
        Image.fromarray(work).save(tmp_in)
        ok = upscaler.upscale_file(tmp_in, tmp_out)
        meta["upscale_ok"] = ok
        meta["scale"] = upscaler.scale if ok else 1
        work = np.array(Image.open(tmp_out).convert("RGB"))
    else:
        meta["upscale_ok"] = False
        meta["scale"] = 1

    if logger:
        logger.info(
            "enhance: class=%s  clahe=%s  localc=%s  unsharp=%s  upscale=%s(x%d)"
            % (meta["contrast_class"], meta["clahe_applied"],
               meta["localcontrast_applied"], meta["unsharp_applied"],
               meta["upscale_ok"], meta["scale"])
        )
    return work, meta
