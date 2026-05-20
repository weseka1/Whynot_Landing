"""
remove-bg-folder.py — procesa una carpeta de imagenes (JPG/PNG/JPEG/WEBP)
y deja en una subcarpeta `transparent/` los PNG con alpha real.

Modelo: birefnet-general (mejor calidad, lento — ~30s-2min por frame en CPU).
Refinamiento extra de bordes con OpenCV para zapatillas (despill + feather).

Uso:
  py -3.11 remove-bg-folder.py "C:/path/to/folder" [--model birefnet-general]

Output:
  C:/path/to/folder/transparent/<nombre>.png  (con alpha real)
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


SUPPORTED_EXTS = (".jpg", ".jpeg", ".png", ".webp", ".bmp")


def process_frame(in_path: str, out_path: str, session) -> None:
    img = Image.open(in_path).convert("RGB")

    # alpha_matting con parametros tirados a calidad maxima — el trimap
    # interno es mas conservador con los bordes finos del producto.
    cutout = remove(
        img,
        session=session,
        alpha_matting=True,
        alpha_matting_foreground_threshold=240,
        alpha_matting_background_threshold=15,
        alpha_matting_erode_size=2,
    )

    arr = np.array(cutout)  # RGBA
    alpha = arr[:, :, 3]

    # 1) Erode 1px: elimina anillos blancos del color spill alrededor del
    #    producto (anti-aliasing residual del fondo blanco).
    alpha = cv2.erode(alpha, np.ones((2, 2), np.uint8), iterations=1)

    # 2) Gaussian blur sutil: feather suave (edge anti-aliasing).
    alpha = cv2.GaussianBlur(alpha, (3, 3), 0.7)

    # 3) Despill: atenuar luminancia en zonas semi-transparentes (donde el
    #    blanco residual del fondo todavia tiñe los pixeles del borde del
    #    producto).
    rgb = arr[:, :, :3].astype(np.float32)
    weight = (alpha.astype(np.float32) / 255.0)[:, :, None]
    rgb = rgb * weight
    arr[:, :, :3] = np.clip(rgb, 0, 255).astype(np.uint8)
    arr[:, :, 3] = alpha

    Image.fromarray(arr, mode="RGBA").save(out_path, optimize=True)


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("input_dir", help="carpeta con las imagenes")
    ap.add_argument("--output", default=None, help="dir output (default: <input>/transparent/)")
    ap.add_argument(
        "--model",
        default="birefnet-general",
        help="modelo rembg (default: birefnet-general). Alts: u2net, isnet-general-use",
    )
    args = ap.parse_args()

    input_dir = os.path.abspath(args.input_dir)
    if not os.path.isdir(input_dir):
        print(f"[ERR] no existe la carpeta: {input_dir}", file=sys.stderr)
        return 1

    output_dir = args.output or os.path.join(input_dir, "transparent")
    os.makedirs(output_dir, exist_ok=True)

    # Recoger todas las imagenes soportadas
    inputs = []
    for ext in SUPPORTED_EXTS:
        inputs.extend(glob.glob(os.path.join(input_dir, f"*{ext}")))
        inputs.extend(glob.glob(os.path.join(input_dir, f"*{ext.upper()}")))
    inputs = sorted(set(inputs))

    if not inputs:
        print(f"[ERR] no hay imagenes en {input_dir}", file=sys.stderr)
        return 1

    print(f"[INFO] entrada : {input_dir}")
    print(f"[INFO] salida  : {output_dir}")
    print(f"[INFO] modelo  : {args.model}")
    print(f"[INFO] imagenes: {len(inputs)}")
    print()
    print("[INFO] cargando modelo (primera vez ~80MB-1GB descarga)...")

    try:
        session = new_session(args.model)
    except Exception as e:
        print(f"[ERR] no pude cargar {args.model}: {e}", file=sys.stderr)
        return 1

    print(f"[OK] modelo listo. Procesando...")
    print()

    t0 = time.time()
    for i, in_path in enumerate(inputs):
        name = os.path.basename(in_path)
        out_name = os.path.splitext(name)[0] + ".png"
        out_path = os.path.join(output_dir, out_name)
        t_frame = time.time()
        try:
            process_frame(in_path, out_path, session)
        except Exception as e:
            print(f"[ERR] {name}: {e}", file=sys.stderr)
            continue
        dt_frame = time.time() - t_frame
        n = i + 1
        elapsed = time.time() - t0
        eta = elapsed * (len(inputs) - n) / n
        print(f"  [{n}/{len(inputs)}] {name:30s}  {dt_frame:5.1f}s/frame   ETA {eta:5.0f}s")

    print()
    print(f"[OK] terminado en {time.time() - t0:.0f}s — {len(inputs)} frames")
    print(f"[OUT] {output_dir}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
