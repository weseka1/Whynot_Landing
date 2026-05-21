# pro-sneaker-bg

Pipeline profesional de **extraccion de fondo** para fotografia de sneakers
de ecommerce premium. Optimizado para calidad maxima de recorte: bordes
finos, cordones, suelas blancas sobre fondos blancos, sombras suaves,
materiales reflectivos.

## Tecnologias

| Etapa | Tecnologia | Rol |
|------:|------------|-----|
| 1 | OpenCV LAB+CLAHE | Boost contraste local si detecta fondo claro |
| 2 | **Real-ESRGAN** ncnn-vulkan | Upscale x4 (AMD/Intel/NVIDIA via Vulkan) |
| 3 | **BiRefNet** (rembg) | Segmentacion primaria con alpha matting |
| 4 | **SAM2** (Meta) — opcional | Refinamiento de mascara con prompts auto |
| 5 | Fusion ponderada | Combina mascaras BiRefNet + SAM2 sin perder detalle |
| 6 | Trimap adaptativo | Banda 'unknown' ancha en zonas complejas, fina en planas |
| 7 | **VITMatte-base** tiled | Alpha matting state-of-the-art (HF transformers) |
| 8 | LANCZOS downscale | Super-sampling preserva bordes nitidos |
| 9 | S-curve + Guided filter | Boost alpha + edge-aware refinement |
| 10 | Morfologia + Bilateral | Cleanup islas/huecos + anti-aliasing |
| 11 | Color decontamination | Anti-halo (elimina contaminacion blanca en bordes) |
| 12 | Premultiplied composite | PNG RGBA limpio sobre cualquier fondo |

## Estructura

```
scripts/pro-sneaker-bg/
├── README.md                     ← este archivo
├── requirements.txt              ← deps Python
├── install.ps1                   ← instalador Windows
├── download_models.py            ← descarga BiRefNet + VITMatte + SAM2
├── remove_bg_pro.py              ← CLI principal
└── pro_pipeline/
    ├── __init__.py
    ├── config.py                 ← PipelineConfig dataclass
    ├── io_utils.py               ← IO + logging
    ├── preprocess.py             ← CLAHE local
    ├── upscale.py                ← Real-ESRGAN wrapper
    ├── segmentation.py           ← BiRefNet + SAM2 + fusion + fallbacks
    ├── matting.py                ← VITMatte tiled + trimap adaptativo
    ├── postprocess.py            ← boost, guided, morfologia, decontaminacion
    └── runner.py                 ← orquestador 10 etapas
```

## Instalacion

### 1. Python 3.11 (recomendado)

Si todavia no esta:
```powershell
winget install Python.Python.3.11
```

### 2. Instalar todo automaticamente

```powershell
cd "scripts\pro-sneaker-bg"
powershell -ExecutionPolicy Bypass -File install.ps1
```

Flags opcionales:
- `-WithSam2`     → instala SAM2 desde el repo oficial de Meta + descarga checkpoint large
- `-WithCuda`     → reinstala torch + onnxruntime-gpu con CUDA 12.1 (solo NVIDIA)
- `-SkipModels`   → no descarga modelos (solo deps Python)

### 3. Real-ESRGAN (Vulkan)

Si no tenes el binario, descargalo de
[Real-ESRGAN releases](https://github.com/xinntao/Real-ESRGAN/releases/latest)
y extrae en `tools/realesrgan/` del repo (debe quedar
`tools/realesrgan/realesrgan-ncnn-vulkan.exe`).

> Funciona en **AMD**, **Intel** e **NVIDIA** via Vulkan. No requiere CUDA.

## Uso

### Caso default (procesa GG Super Star White Black)

```powershell
py -3.11 remove_bg_pro.py
```

### Carpeta custom

```powershell
py -3.11 remove_bg_pro.py "C:\ruta\a\fotos"
py -3.11 remove_bg_pro.py "C:\ruta\a\fotos" --output "C:\ruta\salida"
```

### Activar SAM2 (requiere `-WithSam2` en install.ps1)

```powershell
py -3.11 remove_bg_pro.py --sam2
```

### Debug (guarda intermedios)

```powershell
py -3.11 remove_bg_pro.py --debug
```

Esto guarda en `<output>/debug/` por cada imagen:
- `*_01_segbase.png`   ← mascara BiRefNet+SAM2 fusionada
- `*_02_trimap.png`    ← trimap adaptativo
- `*_03_vitmatte.png`  ← alpha despues de VITMatte
- `*_04_alpha_final.png` ← alpha final (post boost+guided+morf)

### Tunear parametros (cuando los defaults no alcanzan)

```powershell
# borde mas perdonador en zonas complejas
py -3.11 remove_bg_pro.py --trimap-max 32

# elimina mas semi-transparencias (utilo si quedan halos suaves)
py -3.11 remove_bg_pro.py --alpha-low 80 --alpha-high 220

# guided filter mas suave (bordes mas naturales)
py -3.11 remove_bg_pro.py --guided-radius 4

# decontaminacion mas agresiva (anti-halo blanco fuerte)
py -3.11 remove_bg_pro.py --halo-radius 8
```

Ver todos los flags:
```powershell
py -3.11 remove_bg_pro.py --help
```

## Performance esperada (CPU AMD + Vulkan)

| Resolucion entrada | Tiempo por imagen |
|--------------------|-------------------|
| 720×540  | ~25-40 s |
| 1080×810 | ~45-70 s |
| 2048×1536 (4K) | ~90-150 s |

Con CUDA 12.1 + NVIDIA RTX clase 3060+:
| Resolucion | Tiempo |
|------------|--------|
| 1080×810 | ~10-15 s |
| 2048×1536 | ~25-40 s |

## Filosofia de calidad

- **NO halos blancos**: anti-halo color decontamination en bordes semi-transparentes
- **NO bordes serruchados**: VITMatte refinement + guided filter + bilateral
- **NO corta partes**: trimap adaptativo + S-curve conservadora con thresholds perdonadores
- **Cordones intactos**: VITMatte preserva transluces, morfologia respeta islas medianas
- **Sombras suaves preservadas**: matting continuo (no umbral binario)
- **Color base limpio**: decontaminacion reemplaza RGB contaminado con FG vecino

## Troubleshooting

**`ImportError: cv2.ximgproc`**
- Instala `opencv-contrib-python` (no `opencv-python` solo).
  `pip install opencv-contrib-python`

**`No module named 'sam2'`**
- SAM2 es opcional. Sin `--sam2` el pipeline funciona perfecto.
- Si lo queres: `pip install git+https://github.com/facebookresearch/sam2.git`

**Real-ESRGAN falla / no aparece**
- El pipeline detecta automaticamente y hace **pass-through** (procesa
  sin upscale). Pero la calidad cae mucho. Conviene tener el binario.

**Sneakers blancas sobre fondo blanco salen recortadas**
- Subir `--trimap-max 32` y bajar `--alpha-low 40 --alpha-high 180`.
- Verificar que `--no-clahe` NO este activo (CLAHE ayuda mucho aca).

**Quedan halos en los bordes**
- Subir `--halo-radius 8` (muestrea FG mas hacia adentro).
- Subir `--alpha-low 80` (mas semi-trans → 0).

**Cordones desaparecen**
- Bajar `--trimap-min 4` y subir `--guided-radius 4`.
- Verificar que `morph_remove_specks_below_px` en `config.py` no este alto.

## Comparativa con scripts anteriores

| script   | base seg | matting | refinement | post |
|----------|----------|---------|------------|------|
| v8       | isnet    | -       | -          | basic |
| v10      | isnet    | VITMatte tile | - | basic |
| v13      | isnet    | VITMatte tile | - | S-curve + guided |
| **pro**  | **BiRefNet + SAM2 fusion** | **VITMatte tile adaptativo** | **edge-aware + bilateral** | **S-curve + guided + morf + decontaminacion** |
