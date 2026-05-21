@echo off
REM ============================================================
REM  install.bat — Instalador de sneaker-ultra-pro (Windows)
REM
REM  Hardware soportado:
REM    - CPU + Vulkan (default)           -> AMD / Intel / NVIDIA
REM    - CPU + DirectML (recomendado AMD) -> acelera ONNX (BiRefNet)
REM                                          usando la iGPU AMD/Intel
REM    - CUDA 12.1                        -> solo NVIDIA discrete
REM
REM  Uso:
REM    install.bat                  (CPU + Vulkan, base)
REM    install.bat /directml        (acelera BiRefNet en iGPU AMD/Intel)
REM    install.bat /cuda            (CUDA 12.1, solo NVIDIA)
REM    install.bat /sam2            (incluye SAM2 + checkpoint small)
REM    install.bat /directml /sam2  (combinables)
REM    install.bat /skipmodels      (solo deps Python)
REM ============================================================
setlocal EnableDelayedExpansion
cd /d "%~dp0"

set "PY=py -3.11"
set "WITH_CUDA=0"
set "WITH_DIRECTML=0"
set "WITH_SAM2=0"
set "SKIP_MODELS=0"
set "SAM2_VARIANT=small"

:parse
if "%~1"=="" goto run
if /I "%~1"=="/cuda" set "WITH_CUDA=1"
if /I "%~1"=="/directml" set "WITH_DIRECTML=1"
if /I "%~1"=="/amd" set "WITH_DIRECTML=1"
if /I "%~1"=="/sam2" set "WITH_SAM2=1"
if /I "%~1"=="/sam2-large" (
    set "WITH_SAM2=1"
    set "SAM2_VARIANT=large"
)
if /I "%~1"=="/sam2-base" (
    set "WITH_SAM2=1"
    set "SAM2_VARIANT=base"
)
if /I "%~1"=="/sam2-small" (
    set "WITH_SAM2=1"
    set "SAM2_VARIANT=small"
)
if /I "%~1"=="/sam2-tiny" (
    set "WITH_SAM2=1"
    set "SAM2_VARIANT=tiny"
)
if /I "%~1"=="/skipmodels" set "SKIP_MODELS=1"
shift
goto parse

:run
echo.
echo ==^> 1/5  Verificando Python 3.11
%PY% --version
if errorlevel 1 (
    echo [ERR] No se encontro Python 3.11. Descargar: https://www.python.org/downloads/
    exit /b 1
)

echo.
echo ==^> 2/5  Actualizando pip
%PY% -m pip install --upgrade pip

echo.
echo ==^> 3/5  Instalando dependencias
%PY% -m pip install -r requirements.txt
if errorlevel 1 (
    echo [ERR] Instalacion de dependencias fallo
    exit /b 1
)

if "%WITH_CUDA%"=="1" (
    echo.
    echo ==^> +  Reinstalando torch + onnxruntime con CUDA 12.1
    %PY% -m pip install --upgrade --force-reinstall torch torchvision --index-url https://download.pytorch.org/whl/cu121
    %PY% -m pip install --upgrade onnxruntime-gpu
)

if "%WITH_DIRECTML%"=="1" (
    echo.
    echo ==^> +  Instalando onnxruntime-directml ^(acelera BiRefNet en iGPU AMD/Intel^)
    %PY% -m pip uninstall -y onnxruntime onnxruntime-gpu 2>nul
    %PY% -m pip install --upgrade onnxruntime-directml
    echo [info] BiRefNet via rembg detectara DirectML automaticamente
    echo [info] torch sigue en CPU ^(no hay torch-directml estable para transformers^)
)

if "%WITH_SAM2%"=="1" (
    echo.
    echo ==^> +  SAM2 ^(Meta^) — variante: %SAM2_VARIANT%
    %PY% -m pip install "git+https://github.com/facebookresearch/sam2.git"
)

echo.
echo ==^> 4/5  Verificando Real-ESRGAN ^(Vulkan — funciona en iGPU AMD/Intel^)
set "REALSGAN=%~dp0..\..\tools\realesrgan\realesrgan-ncnn-vulkan.exe"
if exist "%REALSGAN%" (
    echo [ok]  Real-ESRGAN: %REALSGAN%
) else (
    echo [WARN] Real-ESRGAN no encontrado.
    echo        Descargar: https://github.com/xinntao/Real-ESRGAN/releases/latest
    echo        Extraer en: tools\realesrgan\
)

if "%SKIP_MODELS%"=="0" (
    echo.
    echo ==^> 5/5  Descargando pesos
    if "%WITH_SAM2%"=="1" (
        %PY% download_weights.py --sam2-variant %SAM2_VARIANT%
    ) else (
        %PY% download_weights.py --no-sam2
    )
) else (
    echo.
    echo ==^> 5/5  Modelos: omitido ^(/skipmodels^)
)

echo.
echo =========================================================
echo  Instalacion lista.
echo.
echo  Probar rapido ^(recomendado en CPU/iGPU^):
echo                         run.bat /fast
echo  Calidad maxima:        run.bat
echo  Con debug:             run.bat /debug
echo  Carpeta custom:        run.bat "C:\ruta\fotos"
echo  Ayuda:                 %PY% main.py --help
echo =========================================================
endlocal
