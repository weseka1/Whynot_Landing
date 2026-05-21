"""Upscale IA con Real-ESRGAN ncnn-vulkan (AMD / Intel / NVIDIA compat).

Si el binario no esta presente o falla, devolvemos la imagen original (pass-through).
"""
from __future__ import annotations

import shutil
import subprocess
from pathlib import Path

from PIL import Image


class RealESRGAN:
    def __init__(self, bin_path: Path, model: str, scale: int, logger=None):
        self.bin_path = bin_path
        self.model = model
        self.scale = scale
        self.logger = logger
        self.available = bin_path.exists() if bin_path else False
        if not self.available and logger:
            logger.warning(f"Real-ESRGAN no encontrado en {bin_path} — usando pass-through")

    def upscale_to_file(self, in_path: Path, out_path: Path) -> bool:
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
                    "-t", "32",      # tile size GPU
                    "-j", "1:1:1",
                ],
                check=True,
                stdout=subprocess.DEVNULL,
                stderr=subprocess.PIPE,
                timeout=300,
            )
            return True
        except (subprocess.CalledProcessError, subprocess.TimeoutExpired) as e:
            if self.logger:
                self.logger.warning(f"Real-ESRGAN fallo ({e}) — pass-through")
            shutil.copyfile(in_path, out_path)
            return False

    def upscale_pil(self, img: Image.Image, tmp_dir: Path) -> Image.Image:
        tmp_in = tmp_dir / "rge_in.png"
        tmp_out = tmp_dir / "rge_out.png"
        img.save(tmp_in)
        self.upscale_to_file(tmp_in, tmp_out)
        return Image.open(tmp_out).convert("RGB")
