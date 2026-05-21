"""sneaker-ultra-pro — pipeline hibrido de background removal premium para sneakers.

Flujo:
    ORIGINAL RGB
      -> pre-enhancement IA auxiliar (CLAHE adaptativo + unsharp + Real-ESRGAN x4)
      -> SAM2 segmentation (primario, auto-prompt + multi-mask + score)
      -> BiRefNet refinement (refina contornos + cordones + microdetalles)
      -> trimap adaptativo + VITMatte tiled (multi-pass)
      -> uncertainty refinement (edge confidence map + re-matting local)
      -> guided filter + S-curve + morfologia + joint bilateral
      -> anti-halo color decontamination
      -> COMPOSITE: mascara final aplicada sobre la IMAGEN ORIGINAL
      -> PNG RGBA premultiplicado, resolucion original, sin perdida

La imagen mejorada por IA NUNCA reemplaza la imagen final: solo se usa
para que los modelos detecten mejor. La textura y los colores de salida son
exactamente los de la imagen original.
"""

from .config import UltraConfig
from .pipeline import process_folder, process_one

__all__ = ["UltraConfig", "process_folder", "process_one"]
