"""
process-whynot-logo.py — corta el fondo gris radial del logo WHY NOT
dorado generado por ChatGPT y lo guarda como PNG con alpha en
public/assets/marquee/.

Pipeline:
  1) BiRefNet-General-Lite (foreground extraction, mejor para fondos
     no-blancos como el gris radial de este logo)
  2) post_process_mask=True (close + fill holes)
  3) GaussianBlur(0.6) + autocontrast(0.5%) sobre alpha
  4) bbox crop para descartar transparencia perimetral

Uso: py -3.11 scripts/process-whynot-logo.py <input.png> <output.png>
"""
import sys
from pathlib import Path
from rembg import remove, new_session
from PIL import Image, ImageFilter, ImageOps

MAX_SIDE = 1600


def main(src: Path, out: Path) -> None:
    session = new_session("birefnet-general-lite")
    print(f"[model] birefnet-general-lite")

    img = Image.open(src).convert("RGBA")
    if max(img.size) > MAX_SIDE:
        scale = MAX_SIDE / max(img.size)
        new_size = (int(img.size[0] * scale), int(img.size[1] * scale))
        img = img.resize(new_size, Image.LANCZOS)

    cut = remove(img, session=session, post_process_mask=True)

    r, g, b, a = cut.split()
    a = a.filter(ImageFilter.GaussianBlur(radius=0.6))
    a = ImageOps.autocontrast(a, cutoff=(0.5, 0.5))
    cut = Image.merge("RGBA", (r, g, b, a))

    bbox = cut.getbbox()
    if bbox:
        cut = cut.crop(bbox)

    out.parent.mkdir(parents=True, exist_ok=True)
    cut.save(out, "PNG", optimize=True)
    kb = out.stat().st_size // 1024
    print(f"  -> {out.name}  ({kb} KB)")


if __name__ == "__main__":
    if len(sys.argv) != 3:
        print("usage: py -3.11 scripts/process-whynot-logo.py <src> <out>")
        sys.exit(1)
    main(Path(sys.argv[1]), Path(sys.argv[2]))
