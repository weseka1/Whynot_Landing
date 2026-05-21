"""Helpers de IO y logging."""
from __future__ import annotations

import logging
import sys
from pathlib import Path

import numpy as np
from PIL import Image


def setup_logger(name: str = "pro-bg", level: int = logging.INFO) -> logging.Logger:
    logger = logging.getLogger(name)
    if logger.handlers:
        return logger
    logger.setLevel(level)
    # Forzar stdout UTF-8 en Windows (evita UnicodeEncodeError con cp1252).
    try:
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    except (AttributeError, ValueError):
        pass
    h = logging.StreamHandler(sys.stdout)
    h.setFormatter(logging.Formatter("[%(asctime)s] %(levelname)-5s  %(message)s",
                                     datefmt="%H:%M:%S"))
    logger.addHandler(h)
    logger.propagate = False
    return logger


def list_images(folder: Path, exts: tuple) -> list[Path]:
    out: list[Path] = []
    for ext in exts:
        out.extend(folder.glob(f"*{ext}"))
        out.extend(folder.glob(f"*{ext.upper()}"))
    return sorted(set(out))


def load_rgb(path: Path) -> np.ndarray:
    img = Image.open(path).convert("RGB")
    return np.array(img)


def save_rgba(rgb: np.ndarray, alpha: np.ndarray, path: Path) -> None:
    """Guarda PNG RGBA con color premultiplicado (sin halo en composite over)."""
    rgb_f = rgb.astype(np.float32)
    w = (alpha.astype(np.float32) / 255.0)[:, :, None]
    premul = (rgb_f * w).clip(0, 255).astype(np.uint8)
    rgba = np.dstack([premul, alpha])
    path.parent.mkdir(parents=True, exist_ok=True)
    Image.fromarray(rgba, mode="RGBA").save(path, optimize=True)


def save_mask(alpha: np.ndarray, path: Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    Image.fromarray(alpha.astype(np.uint8), mode="L").save(path, optimize=True)


def save_debug(arr: np.ndarray, path: Path, mode: str = "L") -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    Image.fromarray(arr.astype(np.uint8), mode=mode).save(path, optimize=True)
