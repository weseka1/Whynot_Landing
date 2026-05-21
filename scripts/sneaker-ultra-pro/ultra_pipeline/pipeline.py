"""Orquestador del pipeline ultra-pro.

Flujo completo (7 etapas):

  ORIGINAL RGB ─┐                                          (intacto)
                │
                ▼
   1) Pre-enhancement IA auxiliar
        - detect contrast class (white_on_white / low_contrast / normal)
        - CLAHE adaptativo (LAB-L)
        - adaptive local contrast (solo white-on-white)
        - unsharp mask inteligente
        - Real-ESRGAN x4 (Vulkan)
                │
                ▼   rgb_enhanced (4x)
   2) SAM2 segmentation  (auto-prompt + multi-mask + score)
                │
                ▼   sam_binary_4x
   3) BiRefNet refinement (alpha continua) + fusion edge-aware con SAM2
                │
                ▼   alpha_base_4x
   4) Trimap adaptativo + VITMatte tiled (multi-pass)
                │
                ▼   alpha_matte_4x
   5) Uncertainty refinement (edge confidence map + re-matting local)
                │
                ▼   alpha_refined_4x
   6) Limpieza: S-curve + guided multi-pass + morfologia + bilateral + anti-halo
                │
                ▼   alpha_refined_4x  (limpio)
   7) Downscale alpha 4x → 1x (LANCZOS) y aplicar sobre RGB ORIGINAL
                │
                ▼
       PNG RGBA premultiplicado en resolucion original.
"""
from __future__ import annotations

import gc
import shutil
import tempfile
import time
from pathlib import Path

import numpy as np
from PIL import Image

try:
    from tqdm import tqdm
except ImportError:
    def tqdm(it, **kwargs):
        return it

from . import io as ioutil
from .cleaner import full_clean
from .composer import compose_final, downscale_alpha_to_original
from .config import UltraConfig
from .enhancer import RealESRGAN, enhance_for_segmentation
from .matter import multipass_matting
from .refiner import birefnet_alpha, fuse_sam2_birefnet
from .segmenter import SAM2Segmenter, grabcut_fallback
from .uncertainty import refine_uncertain_regions


_SAM2_INSTANCE: SAM2Segmenter | None = None


def _get_sam2(cfg: UltraConfig, logger) -> SAM2Segmenter | None:
    global _SAM2_INSTANCE
    if not cfg.sam2_enabled:
        return None
    if _SAM2_INSTANCE is not None:
        return _SAM2_INSTANCE
    _SAM2_INSTANCE = SAM2Segmenter(
        checkpoint_path=cfg.sam2_checkpoint_path(),
        config_path=cfg.sam2_config_for_variant(),
        device=cfg.device,
        use_fp16=cfg.use_fp16,
        logger=logger,
    )
    return _SAM2_INSTANCE


def process_one(in_path: Path, out_path: Path, cfg: UltraConfig,
                upscaler: RealESRGAN, tmp_dir: Path, logger,
                mask_path: Path | None = None,
                debug_dir: Path | None = None) -> dict:
    """Procesa una sola imagen. Devuelve dict con metricas."""
    stats: dict = {"path": str(in_path)}

    # 0) Cargar RGB ORIGINAL (esta imagen NO se altera nunca)
    orig_rgb = ioutil.load_rgb(in_path)
    orig_size = (orig_rgb.shape[1], orig_rgb.shape[0])
    stats["orig_size"] = orig_size

    # 1) Pre-enhancement IA auxiliar (CLAHE + unsharp + Real-ESRGAN)
    rgb_enh, enh_meta = enhance_for_segmentation(orig_rgb, cfg, upscaler,
                                                   tmp_dir, logger=logger)
    stats["enhance"] = enh_meta

    if debug_dir is not None:
        ioutil.save_debug(rgb_enh, debug_dir / f"{in_path.stem}_01_enhanced.png", mode="RGB")

    # 2) SAM2 segmentation (primaria)
    sam2 = _get_sam2(cfg, logger)
    sam_result = sam2.segment(
        rgb_enh,
        multimask=cfg.sam2_multimask,
        grid_points=cfg.sam2_grid_points,
        neg_pad=cfg.sam2_neg_corner_pad,
    ) if sam2 else None

    if sam_result is not None:
        sam_binary = sam_result["binary"]
        stats["sam2_score"] = sam_result["score"]
        if logger:
            logger.info(f"SAM2 score={sam_result['score']:.3f}")
    else:
        sam_binary = None
        if logger:
            logger.warning("SAM2 no produjo mascara — usaremos BiRefNet o fallback GrabCut")

    if debug_dir is not None and sam_binary is not None:
        ioutil.save_debug(sam_binary, debug_dir / f"{in_path.stem}_02_sam2.png")

    # 3) BiRefNet refinement + fusion
    if cfg.birefnet_enabled:
        bref = birefnet_alpha(
            rgb_enh,
            model=cfg.birefnet_model,
            alpha_matting=cfg.birefnet_alpha_matting,
            fg_threshold=cfg.birefnet_fg_threshold,
            bg_threshold=cfg.birefnet_bg_threshold,
            erode_size=cfg.birefnet_erode_size,
            logger=logger,
        )
    else:
        bref = None

    if debug_dir is not None and bref is not None:
        ioutil.save_debug(bref, debug_dir / f"{in_path.stem}_03_birefnet.png")

    # Si ambos fallaron, GrabCut como ultimo recurso
    if sam_binary is None and bref is None:
        if logger:
            logger.warning("SAM2 y BiRefNet fallaron — fallback GrabCut")
        bref = grabcut_fallback(rgb_enh)

    alpha_base = fuse_sam2_birefnet(
        sam_binary, bref,
        strategy=cfg.fusion_strategy,
        birefnet_strong=cfg.fusion_birefnet_strong_threshold,
        sam_band=cfg.fusion_sam_ambiguous_band,
        logger=logger,
    )

    if debug_dir is not None:
        ioutil.save_debug(alpha_base, debug_dir / f"{in_path.stem}_04_fused.png")

    del sam_binary, bref
    gc.collect()

    # 4) Trimap adaptativo + VITMatte tiled multi-pass
    if cfg.vitmatte_enabled:
        alpha_matte = multipass_matting(rgb_enh, alpha_base, cfg, logger=logger)
    else:
        alpha_matte = alpha_base

    if debug_dir is not None:
        ioutil.save_debug(alpha_matte, debug_dir / f"{in_path.stem}_05_matte.png")

    del alpha_base
    gc.collect()

    # 5) Uncertainty refinement (edge confidence + re-matting local)
    if cfg.uncertainty_enabled:
        alpha_refined = refine_uncertain_regions(
            alpha_matte, rgb_enh,
            conf_threshold=cfg.uncertainty_threshold,
            dilate_px=cfg.uncertainty_dilate_px,
            logger=logger,
        )
    else:
        alpha_refined = alpha_matte
    del alpha_matte

    if debug_dir is not None:
        ioutil.save_debug(alpha_refined, debug_dir / f"{in_path.stem}_06_uncertain.png")

    # 6) Downscale alpha 4x → 1x (LANCZOS) para limpiar contra el RGB ORIGINAL
    alpha_1x = downscale_alpha_to_original(alpha_refined, orig_size)
    del alpha_refined

    if debug_dir is not None:
        ioutil.save_debug(alpha_1x, debug_dir / f"{in_path.stem}_07_alpha_1x.png")

    # 6b) Limpieza profesional contra RGB original
    alpha_clean, rgb_clean = full_clean(alpha_1x, orig_rgb, cfg, logger=logger)

    if debug_dir is not None:
        ioutil.save_debug(alpha_clean, debug_dir / f"{in_path.stem}_08_alpha_clean.png")

    if mask_path is not None:
        ioutil.save_mask(alpha_clean, mask_path)

    # 7) COMPOSE FINAL — mascara aplicada sobre RGB ORIGINAL
    compose_final(rgb_clean, alpha_clean, out_path,
                   premultiplied=cfg.use_premultiplied)
    stats["ok"] = True
    return stats


def process_folder(cfg: UltraConfig, logger=None) -> dict:
    """Procesa toda la carpeta."""
    if logger is None:
        logger = ioutil.setup_logger()

    cfg.output_dir.mkdir(parents=True, exist_ok=True)
    if cfg.masks_dir is not None:
        cfg.masks_dir.mkdir(parents=True, exist_ok=True)
    if cfg.debug_dir is not None:
        cfg.debug_dir.mkdir(parents=True, exist_ok=True)

    images = ioutil.list_images(cfg.input_dir, cfg.supported_exts)
    if not images:
        logger.error(f"no hay imagenes en {cfg.input_dir}")
        return {"ok": False, "count": 0, "errors": [], "skipped": 0}

    logger.info(f"input   : {cfg.input_dir}")
    logger.info(f"output  : {cfg.output_dir}")
    logger.info(f"imagenes: {len(images)}")
    logger.info(f"device  : {cfg.device}  fp16={cfg.use_fp16}")
    logger.info(f"enhance : CLAHE={cfg.clahe_enabled} unsharp={cfg.unsharp_enabled} "
                f"upscale={cfg.upscale_enabled}({cfg.upscale_model})")
    logger.info(f"SAM2    : {'ON' if cfg.sam2_enabled else 'OFF'} variant={cfg.sam2_variant}")
    logger.info(f"BiRefNet: {'ON' if cfg.birefnet_enabled else 'OFF'} model={cfg.birefnet_model}")
    logger.info(f"VITMatte: {'ON' if cfg.vitmatte_enabled else 'OFF'} "
                f"tile={cfg.vitmatte_tile_size} ov={cfg.vitmatte_overlap} "
                f"passes={cfg.vitmatte_passes}")
    logger.info(f"uncert. : {'ON' if cfg.uncertainty_enabled else 'OFF'} "
                f"th={cfg.uncertainty_threshold}")

    upscaler = RealESRGAN(
        bin_path=cfg.realesrgan_path(),
        model=cfg.upscale_model,
        scale=cfg.upscale_factor,
        logger=logger,
    )

    tmp_dir = Path(tempfile.mkdtemp(prefix="ultra_bg_"))
    t0 = time.time()
    results = {"ok": True, "count": 0, "errors": [], "skipped": 0}

    try:
        pbar = tqdm(images, desc="ultra-bg", unit="img")
        for in_path in pbar:
            out_path = cfg.output_dir / (in_path.stem + ".png")
            if cfg.skip_existing and out_path.exists() and out_path.stat().st_size > 0:
                results["skipped"] += 1
                if hasattr(pbar, "set_postfix_str"):
                    pbar.set_postfix_str(f"skip {in_path.name}")
                continue
            mask_path = (cfg.masks_dir / (in_path.stem + ".png")) if cfg.masks_dir else None
            t_img = time.time()
            try:
                process_one(in_path, out_path, cfg, upscaler, tmp_dir, logger,
                            mask_path=mask_path, debug_dir=cfg.debug_dir)
                dt = time.time() - t_img
                results["count"] += 1
                if hasattr(pbar, "set_postfix_str"):
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
