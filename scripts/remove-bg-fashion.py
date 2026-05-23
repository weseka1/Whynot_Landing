"""
remove-bg-fashion.py — corta el fondo blanco de las 7 imagenes de
MODA Y ROPA FUTURISTA usando rembg (isnet-general-use) y las guarda
con nombres limpios en public/assets/futuristic-fashion/.

Uso: py -3.11 scripts/remove-bg-fashion.py
"""
from pathlib import Path
from rembg import remove, new_session
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
SRC_DIR = ROOT / "MODA Y ROPA FUTURISTA"
OUT_DIR = ROOT / "public" / "assets" / "futuristic-fashion"
OUT_DIR.mkdir(parents=True, exist_ok=True)

# mapeo manual (revisado a ojo): genero + indice
MAPPING = {
    "WhatsApp Image 2026-05-16 at 9.12.41 PM (1).jpeg": "man-01.png",
    "WhatsApp Image 2026-05-16 at 9.12.41 PM (2).jpeg": "woman-01.png",
    "WhatsApp Image 2026-05-16 at 9.12.41 PM.jpeg":     "man-02.png",
    "WhatsApp Image 2026-05-16 at 9.12.42 PM (1).jpeg": "man-03.png",
    "WhatsApp Image 2026-05-16 at 9.12.42 PM (2).jpeg": "man-04.png",
    "WhatsApp Image 2026-05-16 at 9.12.42 PM (3).jpeg": "woman-02.png",
    "WhatsApp Image 2026-05-16 at 9.12.42 PM.jpeg":     "man-05.png",
}


def main() -> None:
    session = new_session("isnet-general-use")
    for src_name, out_name in MAPPING.items():
        src = SRC_DIR / src_name
        out = OUT_DIR / out_name
        if not src.exists():
            print(f"[skip] missing source: {src_name}")
            continue
        img = Image.open(src).convert("RGBA")
        cut = remove(img, session=session, post_process_mask=True)
        # Recortar al bounding box no-transparente para que la imagen
        # quede ajustada (sin franjas anchas de blanco/transparencia).
        bbox = cut.getbbox()
        if bbox:
            cut = cut.crop(bbox)
        cut.save(out, "PNG", optimize=True)
        kb = out.stat().st_size // 1024
        print(f"{src_name}  ->  {out_name}  ({kb} KB)")


if __name__ == "__main__":
    main()
