"""Orquestador del pipeline pro de extraccion de fondo.

Flujo (10 etapas):
  1. Carga RGB original
  2. Deteccion fondo claro → CLAHE local (mejora contraste)
  3. Real-ESRGAN x4 upscale (ncnn-vulkan)
  4. Segmentacion primaria (BiRefNet via rembg, fallback ISNet, fallback GrabCut)
  5. SAM2 refinement opcional + fusion de mascaras
  6. Trimap adaptativo (ancho de banda segun complejidad local)
  7. VITMatte-base tiled (alpha matting profesional)
  8. Downscale 4x → 1x con LANCZOS (super-sampling)
  9. Alpha boost (S-curve) + guided filter + morphological cleanup
 10. Anti-halo color decontamination + compose RGBA premultiplicado
"""
from __future__ import annotations

import gc
import shutil
import tempfile
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path

import numpy as np
from PIL import Image
from tqdm import tqdm

from . import io_utils
from .config import PipelineConfig
from .matting import adaptive_trimap, vitmatte_tiled, closed_form_fallback
from .postprocess import (
    alpha_boost_scurve,
    decontaminate_halo,
    edge_aware_smooth,
    guided_filter_alpha,
    morphological_cleanup,
)
from .preprocess import maybe_enhance
from .segmentation import SAM2Refiner, fuse_masks, segment_with_fallback
from .upscale import RealESRGAN


_SAM2: SAM2Refiner | None = None


def _get_sam2(cfg: PipelineConfig, logger) -> SAM2Refiner | None:
    global _SAM2
    if not cfg.sam2_enabled:
        return None
    if _SAM2 is not None:
        return _SAM2
    _SAM2 = SAM2Refiner(
        checkpoint_path=cfg.sam2_checkpoint,
        config_path=cfg.sam2_config,
        device=cfg.device,
        logger=logger,
    )
    return _SAM2 if _SAM2.available else None


def process_one(in_path: Path, out_path: Path, cfg: PipelineConfig,
                upscaler: RealESRGAN, tmp_dir: Path, logger,
                mask_path: Path | None = None,
                debug_dir: Path | None = None) -> dict:
    """Procesa una sola imagen. Devuelve dict con metricas/intermedios."""
    stats: dict = {"path": str(in_path)}

    # 1) Carga RGB original (textura final)
    orig_rgb = io_utils.load_rgb(in_path)
    orig_size = (orig_rgb.shape[1], orig_rgb.shape[0])  # (W, H)
    stats["orig_size"] = orig_size

    # 2) Deteccion fondo claro + CLAHE (solo afecta input del segmentador)
    if cfg.detect_low_contrast_bg:
        rgb_for_seg, clahe_applied = maybe_enhance(
            orig_rgb, cfg.clahe_clip_limit, cfg.clahe_tile_size, logger=logger
        )
        stats["clahe_applied"] = clahe_applied
    else:
        rgb_for_seg = orig_rgb
        stats["clahe_applied"] = False

    # 3) Upscale 4x con Real-ESRGAN (Vulkan)
    tmp_in = tmp_dir / "stage_in.png"
    tmp_up = tmp_dir / "stage_up.png"
    Image.fromarray(rgb_for_seg).save(tmp_in)
    if cfg.upscale_enabled:
        ok = upscaler.upscale_to_file(tmp_in, tmp_up)
        stats["upscale_ok"] = ok
        up_rgb = np.array(Image.open(tmp_up).convert("RGB"))
    else:
        up_rgb = rgb_for_seg
        stats["upscale_ok"] = False

    # 4) Segmentacion primaria con fallback en cascada
    alpha_seg_up = segment_with_fallback(
        up_rgb,
        primary_model=cfg.primary_model,
        alpha_matting=cfg.primary_alpha_matting,
        fg_th=cfg.primary_fg_threshold,
        bg_th=cfg.primary_bg_threshold,
        erode_size=cfg.primary_erode_size,
        logger=logger,
    )

    # 5) SAM2 refinement opcional + fusion
    sam2 = _get_sam2(cfg, logger)
    sam_mask = sam2.refine(up_rgb, alpha_seg_up) if sam2 else None
    alpha_base_up = fuse_masks(alpha_seg_up, sam_mask)
    del alpha_seg_up

    if debug_dir is not None:
        io_utils.save_debug(alpha_base_up, debug_dir / f"{in_path.stem}_01_segbase.png")

    # 6) Trimap adaptativo en escala 4x
    trimap_up = adaptive_trimap(
        alpha_base_up, up_rgb,
        min_band=cfg.trimap_min_band,
        max_band=cfg.trimap_max_band,
        edge_window=cfg.trimap_edge_window,
    )
    del alpha_base_up

    if debug_dir is not None:
        io_utils.save_debug(trimap_up, debug_dir / f"{in_path.stem}_02_trimap.png")

    # 7) VITMatte-base tiled
    try:
        alpha_matte_up = vitmatte_tiled(
            up_rgb, trimap_up,
            model_id=cfg.vitmatte_model_id,
            tile_size=cfg.vitmatte_tile_size,
            overlap=cfg.vitmatte_overlap,
            device=cfg.device,
            logger=logger,
        )
    except Exception as e:
        logger.warning(f"VITMatte fallo ({e}) — fallback closed-form")
        alpha_matte_up = closed_form_fallback(up_rgb, trimap_up)

    del up_rgb, trimap_up
    gc.collect()

    if debug_dir is not None:
        io_utils.save_debug(alpha_matte_up, debug_dir / f"{in_path.stem}_03_vitmatte.png")

    # 8) Downscale alpha 4x → 1x con LANCZOS (super-sampling preserva bordes)
    alpha_1x = np.array(
        Image.fromarray(alpha_matte_up, "L").resize(orig_size, Image.LANCZOS)
    )
    del alpha_matte_up

    # 9a) Alpha boost (S-curve) — elimina semi-transparencias residuales
    alpha_boosted = alpha_boost_scurve(
        alpha_1x, low=cfg.alpha_boost_low, high=cfg.alpha_boost_high
    )

    # 9b) Guided filter — alinea bordes alpha con bordes RGB original
    alpha_guided = guided_filter_alpha(
        alpha_boosted, orig_rgb,
        radius=cfg.guided_radius, eps=cfg.guided_eps,
    )

    # 9c) Morphological cleanup (islas chicas + huecos chicos)
    alpha_clean = morphological_cleanup(
        alpha_guided,
        remove_specks_below_px=cfg.morph_remove_specks_below_px,
        fill_holes_below_px=cfg.morph_fill_holes_below_px,
    )

    # 9d) Edge-aware bilateral smoothing (anti-aliasing sin perder detalle)
    alpha_smooth = edge_aware_smooth(alpha_clean, orig_rgb)

    if debug_dir is not None:
        io_utils.save_debug(alpha_smooth, debug_dir / f"{in_path.stem}_04_alpha_final.png")

    # 10a) Anti-halo color decontamination (RGB sin contaminacion de fondo blanco)
    if cfg.decontaminate_halo:
        rgb_clean = decontaminate_halo(orig_rgb, alpha_smooth,
                                        inner_radius=cfg.halo_radius)
    else:
        rgb_clean = orig_rgb

    # 10b) Compose RGBA premultiplicado
    io_utils.save_rgba(rgb_clean, alpha_smooth, out_path)

    if mask_path is not None:
        io_utils.save_mask(alpha_smooth, mask_path)

    stats["ok"] = True
    return stats


def process_folder(cfg: PipelineConfig, logger=None) -> dict:
    """Procesa todas las imagenes de cfg.input_dir → cfg.output_dir."""
    if logger is None:
        logger = io_utils.setup_logger()

    cfg.output_dir.mkdir(parents=True, exist_ok=True)
    if cfg.masks_dir is not None:
        cfg.masks_dir.mkdir(parents=True, exist_ok=True)
    if cfg.debug_dir is not None:
        cfg.debug_dir.mkdir(parents=True, exist_ok=True)

    images = io_utils.list_images(cfg.input_dir, cfg.supported_exts)
    if not images:
        logger.error(f"no hay imagenes en {cfg.input_dir}")
        return {"ok": False, "count": 0}

    logger.info(f"input   : {cfg.input_dir}")
    logger.info(f"output  : {cfg.output_dir}")
    logger.info(f"imagenes: {len(images)}")
    logger.info(f"device  : {cfg.device}")
    logger.info(f"upscale : {cfg.upscale_model} x{cfg.upscale_factor}"
                 if cfg.upscale_enabled else "upscale : OFF")
    logger.info(f"primary : {cfg.primary_model}")
    logger.info(f"sam2    : {'ON' if cfg.sam2_enabled else 'OFF'}")
    logger.info(f"vitmatte: {cfg.vitmatte_model_id} tile={cfg.vitmatte_tile_size} ov={cfg.vitmatte_overlap}")

    upscaler = RealESRGAN(
        bin_path=cfg.realesrgan_path(),
        model=cfg.upscale_model,
        scale=cfg.upscale_factor,
        logger=logger,
    )

    tmp_dir = Path(tempfile.mkdtemp(prefix="pro_bg_"))
    t0 = time.time()
    results = {"ok": True, "count": 0, "errors": [], "skipped": 0}

    try:
        pbar = tqdm(images, desc="pro-bg", unit="img")
        for in_path in pbar:
            out_path = cfg.output_dir / (in_path.stem + ".png")
            if cfg.skip_existing and out_path.exists() and out_path.stat().st_size > 0:
                results["skipped"] += 1
                pbar.set_postfix_str(f"skip {in_path.name}")
                continue
            mask_path = (cfg.masks_dir / (in_path.stem + ".png")) if cfg.masks_dir else None
            t_img = time.time()
            try:
                process_one(in_path, out_path, cfg, upscaler, tmp_dir, logger,
                            mask_path=mask_path, debug_dir=cfg.debug_dir)
                dt = time.time() - t_img
                results["count"] += 1
                pbar.set_postfix_str(f"{in_path.name} {dt:.1f}s")
            except Exception as e:
                logger.exception(f"fallo procesando {in_path.name}: {e}")
                results["errors"].append((str(in_path), str(e)))
                continue
            gc.collect()
    finally:
        shutil.rmtree(tmp_dir, ignore_errors=True)

    total = time.time() - t0
    logger.info(f"terminado en {total:.0f}s — ok={results['count']} "
                 f"skip={results['skipped']} err={len(results['errors'])}")
    logger.info(f"output: {cfg.output_dir}")
    return results
