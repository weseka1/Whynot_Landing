# process-shoe-video — Pipeline de background removal con IA

Convierte un video con fondo blanco horneado en un video transparente
(WebM con alpha + PNG sequence para Safari) usando IA real (rembg).

## Requisitos

- Node.js 18+ (ya en el proyecto)
- Python 3.11 recomendado (3.14 puede no tener wheels de onnxruntime)
- `ffmpeg-static` (devDep del proyecto, ya instalado)
- `rembg` + `onnxruntime` + `Pillow` + `opencv-python` (Python)

## Setup inicial (una vez)

```powershell
# Verificar Node deps
npm install

# Instalar Python deps (3.11)
py -3.11 -m pip install rembg onnxruntime pillow opencv-python

# Verificar todo
npm run bg:setup
```

## Procesar un video

```powershell
npm run bg:process -- public/assets/hero/golden-goose.mp4
```

Output:
- `public/assets/hero/golden-goose-alpha.webm` (VP9 con alpha real)
- `public/assets/hero/golden-goose-frames/frame_NNNN.png` (sequence ~30
  frames con alpha, fallback para Safari)

## Cómo funciona

1. **Extract**: `ffmpeg` extrae todos los frames del MP4 a `tmp/frames/`
2. **Remove BG**: `remove-bg.py` itera con `rembg` usando el modelo
   `birefnet-general` (o `u2net` fallback). Por frame:
   - `rembg.remove(img, alpha_matting=True)` → cutout RGBA
   - Refina el alpha con OpenCV: erode 1px (quita fringes blancos) +
     Gaussian blur 0.7 (feather suave)
3. **Reassemble**: `ffmpeg` reensambla los frames RGBA como WebM con
   codec VP9 y pixel format `yuva420p` (preserva alpha).
4. **PNG seq**: copia 30 frames decimados a `public/assets/hero/<name>-frames/`
   para fallback Safari.

## Modelos disponibles

- `birefnet-general` (default, ~80MB) — mejor calidad, BiRefNet
- `u2net` (~50MB) — buena calidad, U2Net clásico
- `u2net_human_seg` — solo humanos, no usar para zapatillas
- `isnet-general-use` — alternativa moderna, similar a birefnet

Cambiar modelo: `npm run bg:process -- input.mp4 --model u2net`

## Troubleshooting

**`pip install rembg` falla con Python 3.14**:
- onnxruntime aún no tiene wheels para 3.14. Usar 3.11:
- `py -3.11 -m pip install rembg onnxruntime pillow opencv-python`

**Modelo se queda descargando o falla**:
- La primera vez rembg descarga el modelo desde HuggingFace. Puede
  tardar (red lenta). Espera y reintentá.
- Modelos se cachean en `~/.u2net/` (o `%USERPROFILE%\.u2net\`)

**Frames con bordes feos**:
- Probar otro modelo (`--model isnet-general-use`)
- Aumentar erode_size en `remove-bg.py` línea correspondiente
