@echo off
REM ============================================================
REM  install.bat — Instalador de sneaker-ultra-pro (Windows)
REM
REM  Uso:
REM    install.bat                  (instalacion estandar CPU/Vulkan)
REM    install.bat /cuda            (CUDA 12.1 para NVIDIA)
REM    install.bat /sam2            (incluye SAM2 + checkpoint large)
REM    install.bat /cuda /sam2      (todo)
REM    install.bat /skipmodels      (solo deps Python)
REM ============================================================
setlocal EnableDelayedExpansion
cd /d "%~dp0"

set "PY=py -3.11"
set "WITH_CUDA=0"
set "WITH_SAM2=0"
set "SKIP_MODELS=0"

:parse
if "%~1"=="" goto run
if /I "%~1"=="/cuda" set "WITH_CUDA=1"
if /I "%~1"=="/sam2" set "WITH_SAM2=1"
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

if "%WITH_SAM2%"=="1" (
    echo.
    echo ==^> +  SAM2 ^(Meta^)
    %PY% -m pip install "git+https://github.com/facebookresearch/sam2.git"
)

echo.
echo ==^> 4/5  Verificando Real-ESRGAN ^(Vulkan^)
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
    echo ==^> 5/5  Descargando pesos ^(SAM2, BiRefNet, VITMatte^)
    if "%WITH_SAM2%"=="1" (
        %PY% download_weights.py
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
echo  Probar:                run.bat
echo  Con debug:             run.bat /debug
echo  Carpeta custom:        run.bat "C:\ruta\fotos"
echo  Ayuda:                 %PY% main.py --help
echo =========================================================
endlocal
