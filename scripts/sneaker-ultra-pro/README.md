# sneaker-ultra-pro

Pipeline **hibrido de extraccion de fondo profesional** para fotografia de
sneakers premium. Combina segmentacion IA, alpha matting cinematografico,
edge refinement, anti-halo y reconstruccion de bordes. La salida final
**aplica la mascara refinada sobre la IMAGEN ORIGINAL** — la IA no reemplaza
nunca la textura ni los colores.

## Filosofia

> La IA mejora **temporalmente** la imagen para detectar mejor.
> La IA NO altera la salida.
> El resultado final es: **mascara IA + imagen ORIGINAL**.

Cero look plastico, cero colores falsos, cero halo, cero perdida de textura.

## Flujo (7 etapas)

```
   ORIGINAL RGB ─────────────────────────────────────────────────┐
                                                                  │
                                                                  │ (intacta)
   ┌────────────────────────────────────────────────────────┐    │
   │ 1. PRE-ENHANCEMENT IA AUXILIAR                          │    │
   │    - detect contrast class                              │    │
   │    - CLAHE adaptativo (LAB-L)                           │    │
   │    - adaptive local contrast (white-on-white)           │    │
   │    - unsharp mask inteligente                           │    │
   │    - Real-ESRGAN x4 (Vulkan)                            │    │
   └────────────────────────────────────────────────────────┘    │
                            │ rgb_enhanced_4x                     │
                            ▼                                     │
   ┌────────────────────────────────────────────────────────┐    │
   │ 2. SAM2 SEGMENTATION (Meta)                             │    │
   │    - auto-prompt (bbox central -> grid points)          │    │
   │    - multi-mask con score                               │    │
   │    - 2-pass refinement                                  │    │
   └────────────────────────────────────────────────────────┘    │
                            │ sam2_binary                         │
                            ▼                                     │
   ┌────────────────────────────────────────────────────────┐    │
   │ 3. BIREFNET REFINEMENT + FUSION EDGE-AWARE              │    │
   │    - BiRefNet alpha continua (cordones, costuras)       │    │
   │    - fusion SAM2 + BiRefNet (no pierde detalle)         │    │
   └────────────────────────────────────────────────────────┘    │
                            │ alpha_base                          │
                            ▼                                     │
   ┌────────────────────────────────────────────────────────┐    │
   │ 4. ALPHA MATTING PROFESIONAL                            │    │
   │    - trimap adaptativo (banda ancha en zonas complejas) │    │
   │    - VITMatte-base tiled (multi-pass)                   │    │
   │    - closed-form fallback                               │    │
   └────────────────────────────────────────────────────────┘    │
                            │ alpha_matte                         │
                            ▼                                     │
   ┌────────────────────────────────────────────────────────┐    │
   │ 5. UNCERTAINTY REFINEMENT                               │    │
   │    - edge confidence map (coherencia alpha vs RGB)      │    │
   │    - re-matting local en zonas inciertas                │    │
   └────────────────────────────────────────────────────────┘    │
                            │ alpha_refined                       │
                            ▼                                     │
   ┌────────────────────────────────────────────────────────┐    │
   │ 6. LIMPIEZA PROFESIONAL                                 │    │
   │    - downscale 4x -> 1x (LANCZOS)                       │    │
   │    - S-curve con thresholds adaptativos                 │    │
   │    - guided filter multi-pass                           │    │
   │    - morfologia (preserva cordones)                     │    │
   │    - joint bilateral                                    │    │
   │    - anti-halo color decontamination                    │    │
   └────────────────────────────────────────────────────────┘    │
                            │ alpha_final                         │
                            ▼                                     ▼
   ┌──────────────────────────────────────────────────────────────┐
   │ 7. COMPOSICION FINAL                                          │
   │      mascara_final  ×  ORIGINAL RGB  ->  PNG RGBA premul     │
   │      (resolucion original, sin compresion lossy)              │
   └──────────────────────────────────────────────────────────────┘
```

## Estructura

```
sneaker-ultra-pro/
├── README.md
├── requirements.txt
├── install.bat
├── run.bat
├── main.py                    ← CLI entry point
├── download_weights.py        ← descarga SAM2 + BiRefNet + VITMatte
└── ultra_pipeline/
    ├── __init__.py
    ├── config.py              ← UltraConfig (dataclass)
    ├── io.py                  ← IO + logging
    ├── enhancer.py            ← etapa 1 (CLAHE + unsharp + ESRGAN)
    ├── segmenter.py           ← etapa 2 (SAM2 auto-prompt)
    ├── refiner.py             ← etapa 3 (BiRefNet + fusion edge-aware)
    ├── matter.py              ← etapa 4 (trimap + VITMatte multi-pass)
    ├── uncertainty.py         ← etapa 5 (confidence map + re-matting)
    ├── cleaner.py             ← etapa 6 (S-curve + guided + morf + anti-halo)
    ├── composer.py            ← etapa 7 (compose sobre original)
    └── pipeline.py            ← orquestador
```

## Instalacion

### 1. Python 3.11

```cmd
winget install Python.Python.3.11
```

### 2. Instalar todo

```cmd
cd scripts\sneaker-ultra-pro
install.bat               REM  CPU + Vulkan (AMD/Intel/NVIDIA)
install.bat /cuda         REM  CUDA 12.1 (solo NVIDIA)
install.bat /sam2         REM  + SAM2 + checkpoint large
install.bat /cuda /sam2   REM  combinables
```

### 3. Real-ESRGAN (opcional pero recomendado)

Descargar de [Real-ESRGAN releases](https://github.com/xinntao/Real-ESRGAN/releases/latest)
y extraer en `tools\realesrgan\` del repo (debe quedar
`tools\realesrgan\realesrgan-ncnn-vulkan.exe`).

Si no existe, el pipeline hace pass-through (procesa sin upscale).

## Uso

### Default (procesa GG Super Star White Black)

```cmd
run.bat
```

### Carpeta custom

```cmd
run.bat "C:\ruta\fotos"
```

### Con debug (guarda intermedios)

```cmd
run.bat /debug
```

Esto guarda en `<output>/debug/` por cada imagen:
- `*_01_enhanced.png`  ← rgb tras CLAHE+unsharp+ESRGAN
- `*_02_sam2.png`      ← mascara SAM2 binaria
- `*_03_birefnet.png`  ← alpha BiRefNet
- `*_04_fused.png`     ← fusion SAM2+BiRefNet
- `*_05_matte.png`     ← alpha tras VITMatte
- `*_06_uncertain.png` ← alpha tras uncertainty refine
- `*_07_alpha_1x.png`  ← alpha downscaled a resolucion original
- `*_08_alpha_clean.png` ← alpha final tras limpieza

### Flags utiles

```cmd
run.bat /force                  REM reprocesar aunque existan outputs
run.bat /nosam                  REM saltar SAM2 (mas rapido)
run.bat /nofp16                 REM forzar FP32 (mas preciso, mas lento)
run.bat /cpu                    REM forzar CPU
```

### Hiperparametros (cuando los defaults no alcanzan)

```cmd
py -3.11 main.py --trimap-max 32                  REM bordes complejos
py -3.11 main.py --alpha-low 40 --alpha-high 220  REM perdonador con semi-trans
py -3.11 main.py --guided-radius 4 --guided-passes 3
py -3.11 main.py --halo-radius 8                  REM anti-halo agresivo
py -3.11 main.py --vitmatte-passes 3              REM 3 pasadas de matting
```

Lista completa:
```cmd
py -3.11 main.py --help
```

## Que problemas resuelve

| Problema                            | Como lo resuelve                                                          |
|-------------------------------------|---------------------------------------------------------------------------|
| Sneakers blancas sobre fondo blanco | `adaptive_local_contrast` + CLAHE adaptativo + SAM2 con prompt central    |
| Cordones finos / transluces         | VITMatte tiled multi-pass + trimap adaptativo                             |
| Suelas gastadas / texturas finas    | BiRefNet alpha continua + fusion edge-aware                               |
| Halos blancos en bordes             | `decontaminate_halo` (reemplaza RGB contaminado por FG vecino)            |
| Bordes serruchados                  | Guided filter multi-pass + joint bilateral edge-aware                     |
| Compresion JPG / artifacts          | Unsharp mask con threshold (no amplifica grano)                           |
| Bajo contraste / gris sobre gris    | `detect_contrast_class` -> CLAHE adaptativo automatico                    |
| Zonas inciertas tras matting        | `uncertainty_refinement` (edge confidence + re-matting local)             |
| Look plastico IA                    | La IA NO reemplaza la salida: mascara aplicada sobre RGB ORIGINAL         |

## Fallbacks automaticos

El pipeline degrada con elegancia:

1. **SAM2 no instalado / checkpoint faltante** → cae a BiRefNet-only
2. **BiRefNet falla (rembg/onnxruntime)** → usa SAM2 binario directo
3. **Ambos fallan** → GrabCut como ultimo recurso
4. **Real-ESRGAN no encontrado** → pass-through (sin upscale, mas degraded)
5. **VITMatte falla** → closed-form matting (pymatting, CPU)
6. **CUDA no disponible** → CPU automatico
7. **Imagen no upscaleable** → mantiene resolucion original

## Performance esperada

| Hardware                  | 1080x810 | 2048x1536 |
|---------------------------|----------|-----------|
| CPU AMD + Vulkan          | 60-90 s  | 120-200 s |
| NVIDIA RTX 3060+ CUDA     | 12-20 s  | 30-50 s   |
| NVIDIA RTX 4090 CUDA FP16 | 5-9 s    | 15-25 s   |

> SAM2 + BiRefNet + VITMatte multi-pass es el cuello de botella. El default
> prioriza **calidad** sobre velocidad. Para acelerar usa `/nosam` (saca
> SAM2) o `--vitmatte-passes 1`.

## Formato de salida

- **PNG RGBA** con alpha de 8-bit
- **Premultiplicado** (color × alpha) — composite over cualquier fondo sin halo
- **Resolucion original** (sin reescalar)
- **Sin compresion lossy** (PNG lossless)
- **Texture, color y materiales: identicos a la imagen original**
