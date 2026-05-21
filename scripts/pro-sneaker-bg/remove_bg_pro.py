"""remove_bg_pro.py — Pipeline profesional de extraccion de fondo para sneakers.

Uso:
    py -3.11 remove_bg_pro.py "<carpeta>"
    py -3.11 remove_bg_pro.py "<carpeta>" --output "<salida>"
    py -3.11 remove_bg_pro.py "<carpeta>" --sam2
    py -3.11 remove_bg_pro.py "<carpeta>" --debug

Etapas:
    1) RGB original
    2) CLAHE local (si fondo claro)
    3) Real-ESRGAN x4 upscale
    4) BiRefNet segmentacion (rembg)
    5) SAM2 refinement (opcional)
    6) Trimap adaptativo
    7) VITMatte-base alpha matting (tiled)
    8) Downscale LANCZOS
    9) Alpha boost + guided filter + morfologia + bilateral
   10) Anti-halo decontamination + composite premultiplicado
"""
from __future__ import annotations

import argparse
import sys
from pathlib import Path

from pro_pipeline import PipelineConfig, process_folder
from pro_pipeline.io_utils import setup_logger


DEFAULT_INPUT = (
    Path(__file__).resolve().parents[2]
    / "Yamilito el mejor del mundo"
    / "GOLDEN GOOSE"
    / "Super Star"
    / "White Black"
)


def parse_args() -> argparse.Namespace:
    ap = argparse.ArgumentParser(
        description="Background removal profesional para sneakers (BiRefNet + SAM2 + VITMatte).",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=__doc__,
    )
    ap.add_argument("input_dir", nargs="?", default=str(DEFAULT_INPUT),
                    help="Carpeta con imagenes a procesar (default: White Black de GG Super Star)")
    ap.add_argument("--output", default=None, help="Carpeta de salida (default: <input>/transparent)")
    ap.add_argument("--masks", default=None, help="Carpeta de mascaras grayscale (opcional)")
    ap.add_argument("--debug", action="store_true",
                    help="Guarda intermedios (seg base, trimap, alpha) en <output>/debug")

    # Toggles de etapas
    ap.add_argument("--no-upscale", action="store_true", help="Saltar Real-ESRGAN")
    ap.add_argument("--no-clahe", action="store_true", help="Saltar deteccion fondo claro + CLAHE")
    ap.add_argument("--no-decontaminate", action="store_true", help="Saltar anti-halo")
    ap.add_argument("--force", action="store_true", help="Reprocesar aunque exista output")

    # Modelos
    ap.add_argument("--primary-model", default="birefnet-general",
                    choices=["birefnet-general", "birefnet-general-lite",
                             "isnet-general-use", "u2net"],
                    help="Modelo de segmentacion base (default birefnet-general)")
    ap.add_argument("--vitmatte-model", default="hustvl/vitmatte-base-composition-1k",
                    help="VITMatte model id (HF)")

    # SAM2
    ap.add_argument("--sam2", action="store_true", help="Activar refinamiento SAM2")
    ap.add_argument("--sam2-checkpoint", default=None,
                    help="Path al .pt de SAM2 (default: models/sam2.1_hiera_large.pt)")
    ap.add_argument("--sam2-config", default="configs/sam2.1/sam2.1_hiera_l.yaml",
                    help="Config YAML de SAM2")

    # Hiperparametros
    ap.add_argument("--tile-size", type=int, default=1024)
    ap.add_argument("--overlap", type=int, default=256)
    ap.add_argument("--trimap-min", type=int, default=8)
    ap.add_argument("--trimap-max", type=int, default=24)
    ap.add_argument("--alpha-low", type=int, default=60, help="S-curve low threshold")
    ap.add_argument("--alpha-high", type=int, default=200, help="S-curve high threshold")
    ap.add_argument("--guided-radius", type=int, default=2)
    ap.add_argument("--halo-radius", type=int, default=4)

    return ap.parse_args()


def build_config(args: argparse.Namespace) -> PipelineConfig:
    cfg = PipelineConfig()
    cfg.input_dir = Path(args.input_dir).resolve()
    cfg.output_dir = Path(args.output).resolve() if args.output \
        else cfg.input_dir / "transparent"
    cfg.masks_dir = Path(args.masks).resolve() if args.masks else None
    cfg.debug_dir = (cfg.output_dir / "debug") if args.debug else None

    cfg.upscale_enabled = not args.no_upscale
    cfg.detect_low_contrast_bg = not args.no_clahe
    cfg.decontaminate_halo = not args.no_decontaminate
    cfg.skip_existing = not args.force

    cfg.primary_model = args.primary_model
    cfg.vitmatte_model_id = args.vitmatte_model

    cfg.sam2_enabled = args.sam2
    if args.sam2_checkpoint:
        cfg.sam2_checkpoint = Path(args.sam2_checkpoint).resolve()
    else:
        cfg.sam2_checkpoint = (Path(__file__).parent / "models" / "sam2.1_hiera_large.pt")
    cfg.sam2_config = args.sam2_config

    cfg.vitmatte_tile_size = args.tile_size
    cfg.vitmatte_overlap = args.overlap
    cfg.trimap_min_band = args.trimap_min
    cfg.trimap_max_band = args.trimap_max
    cfg.alpha_boost_low = args.alpha_low
    cfg.alpha_boost_high = args.alpha_high
    cfg.guided_radius = args.guided_radius
    cfg.halo_radius = args.halo_radius

    return cfg


def main() -> int:
    args = parse_args()
    logger = setup_logger("pro-bg")

    cfg = build_config(args)

    if not cfg.input_dir.is_dir():
        logger.error(f"no existe la carpeta: {cfg.input_dir}")
        return 1

    results = process_folder(cfg, logger=logger)
    return 0 if results.get("ok") and not results.get("errors") else 1


if __name__ == "__main__":
    sys.exit(main())
