"""main.py — sneaker-ultra-pro CLI.

Pipeline:
  ORIGINAL RGB
   -> pre-enhancement IA (auxiliar, no se exporta)
   -> SAM2 segmentation (primario)
   -> BiRefNet refinement + fusion edge-aware
   -> trimap adaptativo + VITMatte tiled multi-pass
   -> uncertainty refinement (edge confidence + re-matting local)
   -> S-curve + guided multi-pass + morfologia + bilateral + anti-halo
   -> mascara aplicada SOBRE LA IMAGEN ORIGINAL
   -> PNG RGBA premultiplicado, resolucion original

Uso:
  py -3.11 main.py                       # default input/output
  py -3.11 main.py "<carpeta>"
  py -3.11 main.py "<carpeta>" --output "<salida>"
  py -3.11 main.py --debug               # guarda intermedios
  py -3.11 main.py --no-sam2             # solo BiRefNet (mas rapido)
  py -3.11 main.py --no-upscale          # sin Real-ESRGAN
  py -3.11 main.py --force               # reprocesar
"""
from __future__ import annotations

import argparse
import sys
from pathlib import Path

# Permite ejecutar 'py main.py' desde la carpeta del script
sys.path.insert(0, str(Path(__file__).resolve().parent))

from ultra_pipeline import UltraConfig, process_folder  # noqa: E402
from ultra_pipeline.io import setup_logger  # noqa: E402


DEFAULT_INPUT = (
    Path(__file__).resolve().parents[2]
    / "Yamilito el mejor del mundo"
    / "GOLDEN GOOSE"
    / "Super Star"
    / "White Black"
)


def parse_args() -> argparse.Namespace:
    ap = argparse.ArgumentParser(
        prog="sneaker-ultra-pro",
        description="Background removal hibrido SAM2+BiRefNet+VITMatte para sneakers.",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=__doc__,
    )
    ap.add_argument("input_dir", nargs="?", default=str(DEFAULT_INPUT),
                    help="Carpeta con imagenes (default: GG Super Star White Black)")
    ap.add_argument("--output", default=None,
                    help="Carpeta de salida (default: <input>/transparent)")
    ap.add_argument("--masks", default=None,
                    help="Carpeta para guardar mascaras grayscale (opcional)")
    ap.add_argument("--debug", action="store_true",
                    help="Guarda intermedios (enhanced/sam2/birefnet/fused/matte/...) en <output>/debug")
    ap.add_argument("--force", action="store_true",
                    help="Reprocesar aunque exista output")

    # Toggles
    ap.add_argument("--no-enhance", action="store_true",
                    help="Saltar todo el stage de enhancement (CLAHE+unsharp+ESRGAN)")
    ap.add_argument("--no-clahe", action="store_true", help="Saltar CLAHE")
    ap.add_argument("--no-unsharp", action="store_true", help="Saltar unsharp mask")
    ap.add_argument("--no-upscale", action="store_true", help="Saltar Real-ESRGAN")
    ap.add_argument("--no-sam2", action="store_true", help="Saltar SAM2 (usar solo BiRefNet)")
    ap.add_argument("--no-birefnet", action="store_true", help="Saltar BiRefNet refinement")
    ap.add_argument("--no-vitmatte", action="store_true", help="Saltar VITMatte (usar fused base)")
    ap.add_argument("--no-uncertainty", action="store_true", help="Saltar uncertainty refinement")
    ap.add_argument("--no-decontaminate", action="store_true", help="Saltar anti-halo")

    # Super-resolution avanzada
    ap.add_argument("--swinir", action="store_true",
                    help="Activa SwinIR (segundo paso SR sobre Real-ESRGAN, mas detalle, +20-40s/img)")
    ap.add_argument("--sam2-multiscale", action="store_true",
                    help="Multi-scale SAM2 (predice full + 0.5x, consensus). +30-60s/img")
    ap.add_argument("--birefnet-alpha-matting", action="store_true",
                    help="Activa alpha_matting interno de rembg (mejor calidad pero requiere 2GB+ RAM)")

    # Modelos
    ap.add_argument("--sam2-variant", default="large",
                    choices=["tiny", "small", "base", "large"],
                    help="Variante SAM2.1 (default large)")
    ap.add_argument("--sam2-checkpoint", default=None,
                    help="Path al .pt de SAM2 (default: models/sam2.1_hiera_<variant>.pt)")
    ap.add_argument("--birefnet-model", default="birefnet-general",
                    choices=["birefnet-general", "birefnet-general-lite",
                             "isnet-general-use", "u2net"],
                    help="Modelo BiRefNet/rembg")
    ap.add_argument("--vitmatte-model", default="hustvl/vitmatte-base-composition-1k",
                    help="VITMatte model id (HF)")
    ap.add_argument("--upscale-model", default="realesrgan-x4plus-anime",
                    help="Modelo Real-ESRGAN (default realesrgan-x4plus-anime para sneakers)")

    # Hiperparametros
    ap.add_argument("--tile-size", type=int, default=1024)
    ap.add_argument("--overlap", type=int, default=256)
    ap.add_argument("--vitmatte-passes", type=int, default=2,
                    help="Pasadas de VITMatte (default 2)")
    ap.add_argument("--trimap-min", type=int, default=6)
    ap.add_argument("--trimap-max", type=int, default=28)
    ap.add_argument("--alpha-low", type=int, default=60, help="S-curve low threshold base")
    ap.add_argument("--alpha-high", type=int, default=200, help="S-curve high threshold base")
    ap.add_argument("--guided-radius", type=int, default=2)
    ap.add_argument("--guided-passes", type=int, default=2)
    ap.add_argument("--halo-radius", type=int, default=5)
    ap.add_argument("--fp16", action="store_true",
                    help="Activar FP16 en GPU (mas rapido, mismas calidad en VITMatte/SAM2)")
    ap.add_argument("--no-fp16", action="store_true", help="Forzar FP32")

    # Presets
    ap.add_argument("--fast", action="store_true",
                    help="Preset rapido para CPU/iGPU: SAM2 small, VITMatte 1 pass, "
                         "sin uncertainty refinement (4-8x mas rapido, ~95%% calidad)")
    ap.add_argument("--quality", action="store_true",
                    help="Preset maxima calidad: SAM2 large, VITMatte 2 pass, "
                         "uncertainty ON (default - explicito)")

    return ap.parse_args()


def apply_preset(cfg: UltraConfig, args: argparse.Namespace) -> None:
    """Aplica presets sobre el config base."""
    if args.fast:
        # SAM2 small es ~3x mas rapido que large en CPU, calidad muy similar
        cfg.sam2_variant = "small"
        cfg.vitmatte_passes = 1
        cfg.uncertainty_enabled = False
        cfg.guided_passes = 1
        cfg.vitmatte_tile_size = 768   # tiles mas chicos -> menos RAM, mas rapido
    if args.quality:
        cfg.sam2_variant = "large"
        cfg.vitmatte_passes = 2
        cfg.uncertainty_enabled = True
        cfg.guided_passes = 2
        cfg.sam2_multiscale = True
        cfg.swinir_enabled = True
        # Con SAM2 large + multiscale la mascara SAM2 es precisa →
        # podemos usar edge_aware para que SAM2 sume detalle
        cfg.fusion_strategy = "edge_aware"


def build_config(args: argparse.Namespace) -> UltraConfig:
    cfg = UltraConfig()
    cfg.input_dir = Path(args.input_dir).resolve()
    cfg.output_dir = Path(args.output).resolve() if args.output \
                     else cfg.input_dir / "transparent"
    cfg.masks_dir = Path(args.masks).resolve() if args.masks else None
    cfg.debug_dir = (cfg.output_dir / "debug") if args.debug else None
    cfg.skip_existing = not args.force

    # Toggles
    cfg.enhance_enabled = not args.no_enhance
    cfg.clahe_enabled = not args.no_clahe
    cfg.unsharp_enabled = not args.no_unsharp
    cfg.upscale_enabled = not args.no_upscale
    cfg.sam2_enabled = not args.no_sam2
    cfg.birefnet_enabled = not args.no_birefnet
    cfg.vitmatte_enabled = not args.no_vitmatte
    cfg.uncertainty_enabled = not args.no_uncertainty
    cfg.decontaminate_halo = not args.no_decontaminate

    cfg.swinir_enabled = args.swinir
    cfg.sam2_multiscale = args.sam2_multiscale
    if args.birefnet_alpha_matting:
        cfg.birefnet_alpha_matting = True

    # Modelos
    cfg.sam2_variant = args.sam2_variant
    if args.sam2_checkpoint:
        cfg.sam2_checkpoint = Path(args.sam2_checkpoint).resolve()
    cfg.birefnet_model = args.birefnet_model
    cfg.vitmatte_model_id = args.vitmatte_model
    cfg.upscale_model = args.upscale_model

    # Hiperparametros
    cfg.vitmatte_tile_size = args.tile_size
    cfg.vitmatte_overlap = args.overlap
    cfg.vitmatte_passes = args.vitmatte_passes
    cfg.trimap_min_band = args.trimap_min
    cfg.trimap_max_band = args.trimap_max
    cfg.alpha_boost_low = args.alpha_low
    cfg.alpha_boost_high = args.alpha_high
    cfg.guided_radius = args.guided_radius
    cfg.guided_passes = args.guided_passes
    cfg.halo_inner_radius = args.halo_radius

    if args.no_fp16:
        cfg.use_fp16 = False
    elif args.fp16:
        cfg.use_fp16 = True

    # Si estamos en CPU, FP16 no aplica
    if cfg.device == "cpu":
        cfg.use_fp16 = False

    # Aplicar presets (after config base, before return)
    apply_preset(cfg, args)
    return cfg


def main() -> int:
    args = parse_args()
    logger = setup_logger("ultra-pro")
    cfg = build_config(args)

    if not cfg.input_dir.is_dir():
        logger.error(f"no existe la carpeta: {cfg.input_dir}")
        return 1

    results = process_folder(cfg, logger=logger)
    return 0 if results.get("ok") and not results.get("errors") else 1


if __name__ == "__main__":
    sys.exit(main())
