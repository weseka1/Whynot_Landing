# install.ps1 — Instalador del pipeline pro-sneaker-bg (Windows)
# Uso:  powershell -ExecutionPolicy Bypass -File install.ps1
#       powershell -ExecutionPolicy Bypass -File install.ps1 -WithSam2
#       powershell -ExecutionPolicy Bypass -File install.ps1 -WithCuda

param(
    [switch]$WithSam2,
    [switch]$WithCuda,
    [switch]$SkipModels,
    [string]$Python = "py -3.11"
)

$ErrorActionPreference = "Stop"
$here = Split-Path -Parent $MyInvocation.MyCommand.Definition
Set-Location $here

function Section($t) {
    Write-Host ""
    Write-Host "==> $t" -ForegroundColor Cyan
}

Section "1/4  Verificando Python 3.11"
$pyCmd = $Python.Split(" ")
& $pyCmd[0] $pyCmd[1..($pyCmd.Length-1)] --version
if ($LASTEXITCODE -ne 0) {
    Write-Host "[ERR] No se encontro Python 3.11. Instalalo desde https://www.python.org/downloads/" -ForegroundColor Red
    exit 1
}

Section "2/4  Instalando dependencias Python"
& $pyCmd[0] $pyCmd[1..($pyCmd.Length-1)] -m pip install --upgrade pip
& $pyCmd[0] $pyCmd[1..($pyCmd.Length-1)] -m pip install -r requirements.txt

if ($WithCuda) {
    Write-Host "[INFO] reinstalando torch con CUDA 12.1..." -ForegroundColor Yellow
    & $pyCmd[0] $pyCmd[1..($pyCmd.Length-1)] -m pip install --upgrade --force-reinstall torch torchvision --index-url https://download.pytorch.org/whl/cu121
    & $pyCmd[0] $pyCmd[1..($pyCmd.Length-1)] -m pip install --upgrade onnxruntime-gpu
}

if ($WithSam2) {
    Section "  +  SAM2 (Meta)"
    & $pyCmd[0] $pyCmd[1..($pyCmd.Length-1)] -m pip install "git+https://github.com/facebookresearch/sam2.git"
}

Section "3/4  Verificando Real-ESRGAN (Vulkan)"
$realRoot = Resolve-Path "$here\..\..\tools\realesrgan" -ErrorAction SilentlyContinue
if ($realRoot -and (Test-Path "$realRoot\realesrgan-ncnn-vulkan.exe")) {
    Write-Host "[ok]  Real-ESRGAN ya esta instalado en $realRoot" -ForegroundColor Green
} else {
    Write-Host "[WARN] Real-ESRGAN no encontrado." -ForegroundColor Yellow
    Write-Host "       descarga el zip desde:" -ForegroundColor Yellow
    Write-Host "       https://github.com/xinntao/Real-ESRGAN/releases/latest" -ForegroundColor Yellow
    Write-Host "       y extrae el contenido en tools\realesrgan\ del repo." -ForegroundColor Yellow
}

if (-not $SkipModels) {
    Section "4/4  Descargando modelos (BiRefNet, VITMatte, SAM2)"
    $sam2Flag = if ($WithSam2) { "" } else { "--no-sam2" }
    & $pyCmd[0] $pyCmd[1..($pyCmd.Length-1)] download_models.py $sam2Flag
} else {
    Section "4/4  Modelos: omitido (--SkipModels)"
}

Write-Host ""
Write-Host "==> Instalacion lista." -ForegroundColor Green
Write-Host ""
Write-Host "    Probar:"
Write-Host "      $Python remove_bg_pro.py" -ForegroundColor White
Write-Host '      (procesa la carpeta default White Black de GG Super Star)' -ForegroundColor Gray
Write-Host ""
Write-Host "    Con SAM2:"
Write-Host "      $Python remove_bg_pro.py --sam2" -ForegroundColor White
Write-Host ""
Write-Host "    Con debug (guarda intermedios):"
Write-Host "      $Python remove_bg_pro.py --debug" -ForegroundColor White
