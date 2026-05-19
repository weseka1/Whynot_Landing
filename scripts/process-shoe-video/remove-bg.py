"""
remove-bg.py — worker que toma frames PNG, les saca el fondo con rembg
y refina los bordes con OpenCV.

Uso:
  py -3.11 remove-bg.py \
    --input  ./tmp/frames \
    --output ./tmp/frames-alpha \
    --model  birefnet-general

Pensado para ser llamado desde index.mjs (Node orquestador).
"""

from rembg import remove, new_session
from PIL import Image
import cv2
import numpy as np
import argparse
import glob
import os
import sys
import time


def process_frame(in_path: str, out_path: str, session) -> None:
    """Carga in_path, le saca el fondo con rembg + alpha_matting, refina
    el alpha con OpenCV y guarda PNG con transparencia en out_path."""
    img = Image.open(in_path).convert("RGB")

    # alpha_matting hace un trimap interno y produce edges mucho mejores
    # que el remove() basico — fundamental para zapatillas con cordones,
    # costuras y bordes finos.
    cutout = remove(
        img,
        session=session,
        alpha_matting=True,
        alpha_matting_foreground_threshold=240,
        alpha_matting_background_threshold=20,
        alpha_matting_erode_size=2,
    )

    arr = np.array(cutout)  # RGBA
    alpha = arr[:, :, 3]

    # Erode 1px: elimina anillos blancos del color spill alrededor del
    # producto (ese halo gris-blanco que dejaba el chroma key).
    alpha = cv2.erode(alpha, np.ones((2, 2), np.uint8), iterations=1)

    # Gaussian blur sutil: feather suave en el borde (anti-aliasing).
    alpha = cv2.GaussianBlur(alpha, (3, 3), 0.7)

    # Despill: zonas semi-transparentes con tinte blanco residual.
    # Donde el alpha es bajo, atenuamos un toque la luminancia para que
    # no se vea pegote claro en el edge contra fondos oscuros.
    rgb = arr[:, :, :3].astype(np.float32)
    weight = (alpha.astype(np.float32) / 255.0)[:, :, None]
    rgb = rgb * weight
    arr[:, :, :3] = np.clip(rgb, 0, 255).astype(np.uint8)
    arr[:, :, 3] = alpha

    Image.fromarray(arr, mode="RGBA").save(out_path, optimize=True)


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--input",  required=True, help="dir con frames RGB de entrada")
    ap.add_argument("--output", required=True, help="dir de salida para frames RGBA")
    ap.add_argument(
        "--model",
        default="birefnet-general",
        help="modelo rembg (default: birefnet-general; alt: u2net, isnet-general-use)",
    )
    args = ap.parse_args()

    os.makedirs(args.output, exist_ok=True)
    inputs = sorted(glob.glob(os.path.join(args.input, "*.png")))
    if not inputs:
        print(f"[ERR] no encontre PNGs en {args.input}", file=sys.stderr)
        return 1

    print(f"[INFO] procesando {len(inputs)} frames con modelo {args.model}")
    print(f"[INFO] descargando modelo si hace falta (primera vez ~80MB)...")

    try:
        session = new_session(args.model)
    except Exception as e:
        print(f"[ERR] no pude cargar el modelo {args.model}: {e}", file=sys.stderr)
        print(f"[INFO] retry con u2net (mas chico)...", file=sys.stderr)
        session = new_session("u2net")

    print(f"[OK] modelo listo, procesando...")

    t0 = time.time()
    for i, in_path in enumerate(inputs):
        name = os.path.basename(in_path)
        out_path = os.path.join(args.output, name.replace("in_", "out_"))
        try:
            process_frame(in_path, out_path, session)
        except Exception as e:
            print(f"[ERR] frame {name}: {e}", file=sys.stderr)
            return 1

        # Progreso cada 10% o cada 5 frames
        n = i + 1
        if n % max(1, len(inputs) // 20) == 0 or n == len(inputs):
            dt = time.time() - t0
            rate = n / dt
            eta = (len(inputs) - n) / rate
            print(f"  [{n}/{len(inputs)}] ({n*100//len(inputs)}%)  {rate:.1f} fps  ETA {eta:.0f}s")

    print(f"[OK] terminado en {time.time() - t0:.1f}s — {len(inputs)} frames")
    return 0


if __name__ == "__main__":
    sys.exit(main())
