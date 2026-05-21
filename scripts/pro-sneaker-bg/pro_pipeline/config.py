"""Configuracion centralizada del pipeline."""
from __future__ import annotations

from dataclasses import dataclass, field
from pathlib import Path

import torch


def _detect_device() -> str:
    if torch.cuda.is_available():
        return "cuda"
    if hasattr(torch.backends, "mps") and torch.backends.mps.is_available():
        return "mps"
    return "cpu"


@dataclass
class PipelineConfig:
    # IO
    input_dir: Path = Path(".")
    output_dir: Path = Path("./transparent")
    masks_dir: Path | None = None          # opcional: guardar mascaras L
    debug_dir: Path | None = None          # opcional: guardar intermedios
    supported_exts: tuple = (".jpg", ".jpeg", ".png", ".webp", ".bmp")

    # Dispositivo
    device: str = field(default_factory=_detect_device)
    use_fp16: bool = False                 # True solo en CUDA con buena VRAM

    # Etapa 1: upscale (Real-ESRGAN ncnn-vulkan, AMD/NVIDIA compat)
    upscale_enabled: bool = True
    upscale_model: str = "realesrgan-x4plus-anime"   # mejor para sneakers
    upscale_factor: int = 4
    realesrgan_bin: Path | None = None     # autodetect si None

    # Etapa 2: preproc / deteccion fondo claro
    detect_low_contrast_bg: bool = True
    clahe_clip_limit: float = 2.0          # CLAHE en L del LAB
    clahe_tile_size: int = 8

    # Etapa 3: segmentacion primaria (BiRefNet via rembg)
    primary_model: str = "birefnet-general"   # alta calidad. Alt: "isnet-general-use"
    primary_alpha_matting: bool = True
    primary_fg_threshold: int = 200
    primary_bg_threshold: int = 5
    primary_erode_size: int = 1

    # Etapa 4: SAM2 refinamiento (OPCIONAL)
    sam2_enabled: bool = False             # toggle por flag CLI
    sam2_checkpoint: Path | None = None    # autodetect
    sam2_config: str = "configs/sam2.1/sam2.1_hiera_l.yaml"

    # Etapa 5: trimap adaptativo
    trimap_min_band: int = 8               # px banda unknown minima
    trimap_max_band: int = 24              # px banda unknown maxima (zonas complejas)
    trimap_edge_window: int = 32           # px ventana para medir complejidad

    # Etapa 6: VITMatte
    vitmatte_model_id: str = "hustvl/vitmatte-base-composition-1k"
    vitmatte_tile_size: int = 1024
    vitmatte_overlap: int = 256

    # Etapa 7: alpha boost (S-curve)
    alpha_boost_low: int = 60
    alpha_boost_high: int = 200

    # Etapa 8: guided filter (edge-aware)
    guided_radius: int = 2
    guided_eps: float = 1e-4

    # Etapa 9: anti-halo color decontamination
    decontaminate_halo: bool = True
    halo_radius: int = 4                   # px hacia adentro para muestrear FG limpio

    # Etapa 10: morphological cleanup
    morph_remove_specks_below_px: int = 64 # islas chicas → 0 (excepto cordones)
    morph_fill_holes_below_px: int = 16    # huecos chicos en FG → 255

    # Performance
    max_workers: int = 1                   # > 1 solo en GPU rica
    skip_existing: bool = True

    def realesrgan_path(self) -> Path:
        if self.realesrgan_bin and self.realesrgan_bin.exists():
            return self.realesrgan_bin
        root = Path(__file__).resolve().parents[3]
        candidate = root / "tools" / "realesrgan" / "realesrgan-ncnn-vulkan.exe"
        return candidate
