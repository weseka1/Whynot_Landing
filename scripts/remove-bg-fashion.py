"""
remove-bg-fashion.py — pipeline IA para cortar el fondo blanco de las 7
fotos de MODA Y ROPA FUTURISTA con la mejor calidad disponible.

Estrategia:
  1) Modelo: BiRefNet-General-Lite (state-of-the-art reducido). En CPU
     con ONNX Runtime, el SOTA full pide ~2GB y muere en la 2da imagen
     con "bad allocation". La variante lite usa swin-tiny y cabe bien.
  2) Aislamiento por imagen: el ONNX Runtime acumula buffers entre
     inferencias y la 2da llamada en el mismo proceso explota. La unica
     fix bulletproof es hacer SUBPROCESS por imagen — cada proceso se
     muere y libera RAM por completo. ~1.5s extra por img de overhead.
  3) Resize al modelo a max 1400px lado largo (conserva detalle de los
     hilos rojos finos sin que la inferencia tome demasiada RAM).
  4) Post-process (PIL):
       a. GaussianBlur(0.6) sobre alpha → suaviza pixelacion del edge
       b. Autocontrast del alpha → bordes mas crujientes
       c. bbox crop → descarta filas/columnas totalmente transparentes
  5) Output PNG en public/assets/futuristic-fashion/.

Uso:
  Modo batch:  py -3.11 scripts/remove-bg-fashion.py
  Modo single: py -3.11 scripts/remove-bg-fashion.py --single <src> <out>
"""
import gc
import subprocess
import sys
from pathlib import Path
from rembg import remove, new_session
from PIL import Image, ImageFilter, ImageOps

ROOT = Path(__file__).resolve().parent.parent
SRC_DIR = ROOT / "MODA Y ROPA FUTURISTA"
OUT_DIR = ROOT / "public" / "assets" / "futuristic-fashion"
OUT_DIR.mkdir(parents=True, exist_ok=True)

MAX_SIDE = 1400

# Mapeo manual revisado a ojo (2 mujeres + 5 hombres).
MAPPING = {
    "WhatsApp Image 2026-05-16 at 9.12.41 PM (1).jpeg": "man-01.png",
    "WhatsApp Image 2026-05-16 at 9.12.41 PM (2).jpeg": "woman-01.png",
    "WhatsApp Image 2026-05-16 at 9.12.41 PM.jpeg":     "man-02.png",
    "WhatsApp Image 2026-05-16 at 9.12.42 PM (1).jpeg": "man-03.png",
    "WhatsApp Image 2026-05-16 at 9.12.42 PM (2).jpeg": "man-04.png",
    "WhatsApp Image 2026-05-16 at 9.12.42 PM (3).jpeg": "woman-02.png",
    "WhatsApp Image 2026-05-16 at 9.12.42 PM.jpeg":     "man-05.png",
}

MODEL_PREFS = ["birefnet-general-lite", "u2net_human_seg", "isnet-general-use"]


def pick_model():
    for name in MODEL_PREFS:
        try:
            sess = new_session(name)
            print(f"[model] usando {name}", flush=True)
            return sess
        except Exception as exc:  # pragma: no cover
            print(f"[model] {name} no disponible: {exc}", flush=True)
    raise RuntimeError("ningun modelo de rembg pudo inicializarse")


def process_single(src_path: Path, out_path: Path) -> None:
    """Procesa UNA imagen. Pensado para correr en un subprocess aislado."""
    session = pick_model()

    img = Image.open(src_path).convert("RGBA")
    if max(img.size) > MAX_SIDE:
        scale = MAX_SIDE / max(img.size)
        new_size = (int(img.size[0] * scale), int(img.size[1] * scale))
        img = img.resize(new_size, Image.LANCZOS)

    # BiRefNet con post_process_mask: limpia speckles + rellena agujeros.
    cut = remove(img, session=session, post_process_mask=True)

    # Alpha-only post-process (no toca RGB):
    #   GaussianBlur(0.6) → suaviza stair-step del edge
    #   Autocontrast(cutoff 0.5%) → polariza los pixels gris-medio → edge
    #   mas crujiente sin perder los hilos finos (que tienen alpha medio).
    r, g, b, a = cut.split()
    a = a.filter(ImageFilter.GaussianBlur(radius=0.6))
    a = ImageOps.autocontrast(a, cutoff=(0.5, 0.5))
    cut = Image.merge("RGBA", (r, g, b, a))

    bbox = cut.getbbox()
    if bbox:
        cut = cut.crop(bbox)

    cut.save(out_path, "PNG", optimize=True)
    kb = out_path.stat().st_size // 1024
    print(f"  -> {out_path.name}  ({kb} KB)", flush=True)


def main_batch() -> None:
    """Por cada imagen, lanza un subprocess separado del mismo script con
    --single. ONNX Runtime acumula RAM entre inferencias en el mismo
    proceso; reciclar el proceso es la unica fix robusta sin instalar
    onnxruntime-gpu o cambiar a otro inference engine."""
    self_path = Path(__file__).resolve()
    for src_name, out_name in MAPPING.items():
        src = SRC_DIR / src_name
        out = OUT_DIR / out_name
        if not src.exists():
            print(f"[skip] missing source: {src_name}")
            continue
        print(f"[proc] {src_name}", flush=True)
        rc = subprocess.call(
            [sys.executable, str(self_path), "--single", str(src), str(out)]
        )
        if rc != 0:
            print(f"[fail] exit code {rc} para {src_name}", flush=True)


if __name__ == "__main__":
    if len(sys.argv) >= 4 and sys.argv[1] == "--single":
        process_single(Path(sys.argv[2]), Path(sys.argv[3]))
    else:
        main_batch()
    gc.collect()
