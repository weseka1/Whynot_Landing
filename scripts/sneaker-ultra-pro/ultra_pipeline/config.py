"""Configuracion centralizada del pipeline ultra-pro."""
from __future__ import annotations

from dataclasses import dataclass, field
from pathlib import Path


def _detect_device() -> str:
    try:
        import torch
        if torch.cuda.is_available():
            return "cuda"
        if hasattr(torch.backends, "mps") and torch.backends.mps.is_available():
            return "mps"
    except Exception:
        pass
    return "cpu"


DEFAULT_INPUT = (
    Path(__file__).resolve().parents[3]
    / "Yamilito el mejor del mundo"
    / "GOLDEN GOOSE"
    / "Super Star"
    / "White Black"
)


@dataclass
class UltraConfig:
    # ---------------- IO ----------------
    input_dir: Path = DEFAULT_INPUT
    output_dir: Path = DEFAULT_INPUT / "transparent"
    masks_dir: Path | None = None
    debug_dir: Path | None = None
    supported_exts: tuple = (".jpg", ".jpeg", ".png", ".webp", ".bmp")
    skip_existing: bool = True

    # ---------------- Device ----------------
    device: str = field(default_factory=_detect_device)
    use_fp16: bool = False  # True solo en CUDA con buena VRAM; auto-disabled en CPU

    # ---------------- Etapa 1: pre-enhancement IA (auxiliar) ----------------
    # OBJETIVO: mejorar el INPUT del segmentador. NUNCA se exporta.
    enhance_enabled: bool = True
    clahe_enabled: bool = True
    clahe_clip_limit: float = 2.5
    clahe_tile_size: int = 8
    unsharp_enabled: bool = True
    unsharp_amount: float = 0.6
    unsharp_radius: float = 1.2
    unsharp_threshold: int = 3
    upscale_enabled: bool = True
    upscale_model: str = "realesrgan-x4plus-anime"  # mejor para textiles/cuero
    upscale_factor: int = 4
    realesrgan_bin: Path | None = None
    # SwinIR opcional como cascada de SR (transformer-based, mas lento en CPU)
    swinir_enabled: bool = False
    # deteccion de fondo claro / bajo contraste (white-on-white)
    detect_low_contrast: bool = True
    low_contrast_brightness: int = 200
    low_contrast_std: float = 30.0
    # adaptive local contrast extra para low-contrast scenes
    adaptive_local_contrast: bool = True

    # ---------------- Etapa 2: SAM2 (segmentacion primaria) ----------------
    sam2_enabled: bool = True
    sam2_checkpoint: Path | None = None
    sam2_config: str = "configs/sam2.1/sam2.1_hiera_l.yaml"
    # Default 'small': mejor compromiso calidad/velocidad en CPU/iGPU.
    # En NVIDIA discrete con CUDA conviene 'large' (--quality o /sam2-large).
    sam2_variant: str = "small"                  # tiny|small|base|large
    sam2_multimask: bool = True
    sam2_use_grid_prompt: bool = True
    sam2_grid_points: int = 5                    # n positivos interiores
    sam2_neg_corner_pad: int = 12                # px desde corner para neg points
    sam2_multiscale: bool = False                # consensus 1x + 0.5x
    sam2_multiscale_two_pass: bool = True        # si False, multiscale=solo full

    # ---------------- Etapa 3: BiRefNet refinement ----------------
    birefnet_enabled: bool = True
    birefnet_model: str = "birefnet-general"     # via rembg
    # alpha_matting=False por default: el closed-form interno de rembg
    # pide ~1.86 GiB en imagenes 2K+ (OOM en CPU/iGPU). VITMatte multi-pass
    # ya hace alpha matting state-of-the-art, asi que es redundante.
    # Subir a True solo en NVIDIA discrete con RAM holgada.
    birefnet_alpha_matting: bool = False
    birefnet_fg_threshold: int = 200             # perdonador (no come suela blanca)
    birefnet_bg_threshold: int = 5
    birefnet_erode_size: int = 1

    # Fusion SAM2 + BiRefNet
    # 'trust_birefnet' (DEFAULT): BiRefNet manda. SAM2 solo puede quitar BG,
    # nunca agregar FG. Evita halos cuando SAM2 small es ruidoso.
    # 'edge_aware': SAM2 puede subir BiRefNet en ambiguous. Solo con SAM2
    # large + CUDA donde SAM2 es preciso.
    fusion_strategy: str = "trust_birefnet"
    fusion_birefnet_strong_threshold: int = 230
    fusion_sam_ambiguous_band: tuple = (30, 230)

    # ---------------- Etapa 4: trimap adaptativo + VITMatte ----------------
    trimap_min_band: int = 6
    trimap_max_band: int = 28
    trimap_edge_window: int = 32
    trimap_complexity_gamma: float = 1.2

    vitmatte_enabled: bool = True
    vitmatte_model_id: str = "hustvl/vitmatte-base-composition-1k"
    vitmatte_tile_size: int = 1024
    vitmatte_overlap: int = 256
    # vitmatte_passes 1 por default — el segundo pass es 2x el tiempo y aporta poco
    # en sneakers con bordes ya bien definidos. Subir a 2 con --quality.
    vitmatte_passes: int = 1                      # multi-pass (segundo pass usa alpha refinado)

    # Closed-form fallback (CPU-friendly, robusto)
    closedform_fallback: bool = True

    # ---------------- Etapa 5: uncertainty refinement ----------------
    uncertainty_enabled: bool = True
    uncertainty_threshold: float = 0.18           # cuanto borde semi-trans considerar "incierto"
    uncertainty_dilate_px: int = 6                # expansion alrededor de zonas inciertas

    # ---------------- Etapa 6: postproc / limpieza ----------------
    alpha_boost_enabled: bool = True
    alpha_boost_low: int = 60
    alpha_boost_high: int = 200
    # Intelligent thresholding: ajusta dinamicamente segun stats del alpha
    intelligent_thresholding: bool = True

    guided_radius: int = 2
    guided_eps: float = 1e-4
    guided_passes: int = 2                        # multi-pass guided

    morph_remove_specks_below_px: int = 80
    morph_fill_holes_below_px: int = 16
    morph_protect_islands_above_ratio: float = 0.003  # islas >= 0.3% del FG principal

    joint_bilateral_enabled: bool = True
    bilateral_sigma_space: float = 5.0
    bilateral_sigma_color: float = 25.0

    decontaminate_halo: bool = True
    halo_inner_radius: int = 5
    halo_protect_alpha: int = 250                 # alpha >= -> no decontaminar (FG firme)

    # ---------------- Composicion final ----------------
    # MUY IMPORTANTE: la mascara se aplica sobre la IMAGEN ORIGINAL.
    use_premultiplied: bool = True

    # ---------------- Logging / progress ----------------
    verbose: bool = True

    # ---------------- Helpers ----------------
    def realesrgan_path(self) -> Path:
        if self.realesrgan_bin and self.realesrgan_bin.exists():
            return self.realesrgan_bin
        root = Path(__file__).resolve().parents[3]
        return root / "tools" / "realesrgan" / "realesrgan-ncnn-vulkan.exe"

    def sam2_checkpoint_path(self) -> Path:
        if self.sam2_checkpoint and self.sam2_checkpoint.exists():
            return self.sam2_checkpoint
        names = {
            "tiny": "sam2.1_hiera_tiny.pt",
            "small": "sam2.1_hiera_small.pt",
            "base": "sam2.1_hiera_base_plus.pt",
            "large": "sam2.1_hiera_large.pt",
        }
        fname = names.get(self.sam2_variant, "sam2.1_hiera_large.pt")
        return Path(__file__).resolve().parents[1] / "models" / fname

    def sam2_config_for_variant(self) -> str:
        suffix = {
            "tiny": "sam2.1_hiera_t.yaml",
            "small": "sam2.1_hiera_s.yaml",
            "base": "sam2.1_hiera_b+.yaml",
            "large": "sam2.1_hiera_l.yaml",
        }.get(self.sam2_variant, "sam2.1_hiera_l.yaml")
        return f"configs/sam2.1/{suffix}"
