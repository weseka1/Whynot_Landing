"""Etapa 4 — Alpha matting profesional.

Trimap adaptativo:
  - banda 'unknown' ancha en zonas de alta frecuencia (cordones, texturas
    finas, suelas serruchadas)
  - banda fina en zonas planas (carcasa cerrada del zapato)

VITMatte-base tiled:
  - tile_size 1024 + overlap 256 con feather blending
  - multi-pass opcional: el segundo pass usa el alpha refinado del primero
    como base de trimap, ofreciendo mas precision en bordes

Closed-form matting (pymatting) — fallback CPU si VITMatte falla.
"""
from __future__ import annotations

import gc
from typing import Optional

import cv2
import numpy as np
from PIL import Image

_VITMATTE_MODEL = None
_VITMATTE_PROCESSOR = None
_VITMATTE_DEVICE = None


def _load_vitmatte(model_id: str, device: str = "cpu", use_fp16: bool = False, logger=None):
    global _VITMATTE_MODEL, _VITMATTE_PROCESSOR, _VITMATTE_DEVICE
    if _VITMATTE_MODEL is not None and _VITMATTE_DEVICE == device:
        return _VITMATTE_MODEL, _VITMATTE_PROCESSOR
    import torch
    from transformers import VitMatteForImageMatting, VitMatteImageProcessor
    if logger:
        logger.info(f"cargando VITMatte {model_id} ({device}, fp16={use_fp16})")
    _VITMATTE_PROCESSOR = VitMatteImageProcessor.from_pretrained(model_id)
    model = VitMatteForImageMatting.from_pretrained(model_id)
    model.eval()
    if device != "cpu":
        model = model.to(device)
        if use_fp16:
            model = model.half()
    _VITMATTE_MODEL = model
    _VITMATTE_DEVICE = device
    return _VITMATTE_MODEL, _VITMATTE_PROCESSOR


def adaptive_trimap(mask: np.ndarray, rgb: np.ndarray,
                     min_band: int = 6, max_band: int = 28,
                     edge_window: int = 32,
                     complexity_gamma: float = 1.2) -> np.ndarray:
    """Trimap con banda 'unknown' adaptativa por zona.

    Implementacion: medimos complejidad local (varianza de gradiente Sobel en
    ventana). En zonas de alta complejidad usamos banda ancha. En vez de un
    unico ancho, generamos una mascara de complejidad pixel-wise y la usamos
    como factor de blending entre erosiones de varios anchos.
    """
    binary = (mask > 127).astype(np.uint8) * 255

    gray = cv2.cvtColor(rgb, cv2.COLOR_RGB2GRAY)
    gx = cv2.Sobel(gray, cv2.CV_32F, 1, 0, ksize=3)
    gy = cv2.Sobel(gray, cv2.CV_32F, 0, 1, ksize=3)
    mag = np.sqrt(gx * gx + gy * gy)
    blur = cv2.boxFilter(mag, ddepth=-1, ksize=(edge_window, edge_window))
    bmax = float(blur.max())
    if bmax > 1e-6:
        t = blur / bmax
    else:
        t = np.zeros_like(blur)
    # gamma para enfatizar zonas complejas
    t = np.clip(t ** (1.0 / max(complexity_gamma, 1e-3)), 0, 1)

    # Generamos 4 trimaps con distintos anchos y los mezclamos por t
    bands = np.linspace(min_band, max_band, 4).astype(int)
    bands = np.maximum(bands, 1)

    # construimos 'unknown band' como la diferencia entre dilate y erode
    edge = cv2.morphologyEx(binary, cv2.MORPH_GRADIENT,
                            cv2.getStructuringElement(cv2.MORPH_RECT, (3, 3)))
    edge_idx = edge > 0
    if not edge_idx.any():
        return np.full_like(binary, 0)

    # mapa pixel-wise de ancho deseado
    # interpolamos linealmente entre band[0] y band[-1]
    width_map = (bands[0] + t * (bands[-1] - bands[0])).astype(np.float32)
    width_map[~edge_idx] = bands[0]
    # promediamos el width en el borde para tener un ancho global por aplicar
    if edge_idx.any():
        w_mean = float(width_map[edge_idx].mean())
    else:
        w_mean = float(bands[0])
    band = int(round(max(min_band, min(max_band, w_mean))))

    fg = cv2.erode(binary, np.ones((band, band), np.uint8), iterations=1)
    bg = cv2.dilate(binary, np.ones((band, band), np.uint8), iterations=1)
    trimap = np.full_like(binary, 128)
    trimap[fg == 255] = 255
    trimap[bg == 0] = 0
    return trimap


def _feather_mask(h: int, w: int, overlap: int) -> np.ndarray:
    m = np.ones((h, w), dtype=np.float32)
    if overlap <= 0:
        return m
    ramp = np.linspace(0, 1, overlap, dtype=np.float32)
    m[:overlap, :] *= ramp[:, None]
    m[-overlap:, :] *= ramp[::-1][:, None]
    m[:, :overlap] *= ramp[None, :]
    m[:, -overlap:] *= ramp[::-1][None, :]
    return m


def _vitmatte_tile(rgb_tile: np.ndarray, trimap_tile: np.ndarray,
                    model, processor, device: str, use_fp16: bool) -> np.ndarray:
    import torch
    pil_img = Image.fromarray(rgb_tile).convert("RGB")
    pil_tri = Image.fromarray(trimap_tile).convert("L")
    inputs = processor(images=pil_img, trimaps=pil_tri, return_tensors="pt")
    if device != "cpu":
        inputs = {k: v.to(device) for k, v in inputs.items()}
        if use_fp16:
            inputs = {k: (v.half() if v.dtype == torch.float32 else v) for k, v in inputs.items()}
    with torch.no_grad():
        outputs = model(**inputs)
    alpha = outputs.alphas[0, 0].detach().float().cpu().numpy()
    alpha = (alpha * 255).clip(0, 255).astype(np.uint8)
    if alpha.shape != trimap_tile.shape:
        alpha = cv2.resize(alpha, (trimap_tile.shape[1], trimap_tile.shape[0]),
                           interpolation=cv2.INTER_LINEAR)
    del inputs, outputs
    return alpha


def vitmatte_tiled(rgb: np.ndarray, trimap: np.ndarray, model_id: str,
                    tile_size: int = 1024, overlap: int = 256,
                    device: str = "cpu", use_fp16: bool = False,
                    logger=None) -> np.ndarray:
    model, processor = _load_vitmatte(model_id, device=device,
                                       use_fp16=use_fp16, logger=logger)
    H, W = trimap.shape
    accum = np.zeros((H, W), dtype=np.float32)
    weight = np.zeros((H, W), dtype=np.float32)
    stride = max(tile_size - overlap, 1)

    y_starts = list(range(0, max(1, H - overlap), stride))
    if not y_starts or y_starts[-1] + tile_size < H:
        y_starts.append(max(0, H - tile_size))
    x_starts = list(range(0, max(1, W - overlap), stride))
    if not x_starts or x_starts[-1] + tile_size < W:
        x_starts.append(max(0, W - tile_size))

    for y in y_starts:
        for x in x_starts:
            y2 = min(y + tile_size, H)
            x2 = min(x + tile_size, W)
            th, tw = y2 - y, x2 - x
            tile_tri = trimap[y:y2, x:x2]
            has_unknown = ((tile_tri > 0) & (tile_tri < 255)).any()
            if not has_unknown:
                alpha_tile = tile_tri
            else:
                tile_rgb = rgb[y:y2, x:x2]
                alpha_tile = _vitmatte_tile(tile_rgb, tile_tri, model, processor,
                                             device, use_fp16)
            fm = _feather_mask(th, tw, overlap)
            accum[y:y2, x:x2] += alpha_tile.astype(np.float32) * fm
            weight[y:y2, x:x2] += fm
            gc.collect()

    weight = np.maximum(weight, 1e-6)
    return (accum / weight).clip(0, 255).astype(np.uint8)


def trimap_from_alpha(alpha: np.ndarray, band: int = 6) -> np.ndarray:
    """Trimap rapido a partir de un alpha refinado, para el segundo pass."""
    binary = (alpha > 127).astype(np.uint8) * 255
    fg = cv2.erode(binary, np.ones((band, band), np.uint8), iterations=1)
    bg = cv2.dilate(binary, np.ones((band, band), np.uint8), iterations=1)
    tri = np.full_like(binary, 128)
    tri[fg == 255] = 255
    tri[bg == 0] = 0
    # marcamos como unknown los pixels donde el alpha era ambiguo
    ambig = (alpha > 40) & (alpha < 215)
    tri[ambig] = 128
    return tri


def multipass_matting(rgb: np.ndarray, base_mask: np.ndarray, cfg,
                      logger=None) -> np.ndarray:
    """Multi-pass VITMatte. Devuelve alpha refinado."""
    # PASS 1
    trimap1 = adaptive_trimap(
        base_mask, rgb,
        min_band=cfg.trimap_min_band,
        max_band=cfg.trimap_max_band,
        edge_window=cfg.trimap_edge_window,
        complexity_gamma=cfg.trimap_complexity_gamma,
    )
    try:
        alpha1 = vitmatte_tiled(
            rgb, trimap1,
            model_id=cfg.vitmatte_model_id,
            tile_size=cfg.vitmatte_tile_size,
            overlap=cfg.vitmatte_overlap,
            device=cfg.device,
            use_fp16=cfg.use_fp16,
            logger=logger,
        )
    except Exception as e:
        if logger:
            logger.warning(f"VITMatte pass1 fallo ({e}) — closed-form fallback")
        if cfg.closedform_fallback:
            return closed_form_matting(rgb, trimap1, logger=logger)
        raise

    if cfg.vitmatte_passes <= 1:
        return alpha1

    # PASS 2 — trimap mas fino derivado del alpha1
    trimap2 = trimap_from_alpha(alpha1, band=max(2, cfg.trimap_min_band // 2))
    try:
        alpha2 = vitmatte_tiled(
            rgb, trimap2,
            model_id=cfg.vitmatte_model_id,
            tile_size=cfg.vitmatte_tile_size,
            overlap=cfg.vitmatte_overlap,
            device=cfg.device,
            use_fp16=cfg.use_fp16,
            logger=logger,
        )
    except Exception as e:
        if logger:
            logger.warning(f"VITMatte pass2 fallo ({e}) — uso alpha1")
        return alpha1

    # Blend: confiamos en alpha2 dentro de la banda unknown del trimap2,
    # mantenemos alpha1 fuera
    band_unknown = (trimap2 > 0) & (trimap2 < 255)
    out = alpha1.copy()
    out[band_unknown] = alpha2[band_unknown]
    return out


def closed_form_matting(rgb: np.ndarray, trimap: np.ndarray, logger=None) -> np.ndarray:
    """Closed-form matting (pymatting) — fallback CPU."""
    try:
        from pymatting import estimate_alpha_cf
    except ImportError:
        if logger:
            logger.error("pymatting no instalado — pip install pymatting")
        return trimap
    img = rgb.astype(np.float64) / 255.0
    tri = trimap.astype(np.float64) / 255.0
    alpha = estimate_alpha_cf(img, tri)
    return (alpha * 255).clip(0, 255).astype(np.uint8)
