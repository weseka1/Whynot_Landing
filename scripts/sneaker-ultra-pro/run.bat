@echo off
REM ============================================================
REM  run.bat — Ejecutor de sneaker-ultra-pro
REM
REM  Uso:
REM    run.bat                          (input default + opts default)
REM    run.bat "C:\ruta\carpeta"        (carpeta custom)
REM    run.bat /debug                   (guarda intermedios)
REM    run.bat /force                   (reprocesar todo)
REM    run.bat /nosam                   (sin SAM2, solo BiRefNet)
REM    run.bat /nofp16                  (FP32 en GPU)
REM    run.bat /cpu                     (forzar CPU)
REM    run.bat "C:\ruta" /debug /force  (combinables)
REM ============================================================
setlocal EnableDelayedExpansion
cd /d "%~dp0"

set "PY=py -3.11"
set "INPUT="
set "EXTRA="

:parse
if "%~1"=="" goto run
set "ARG=%~1"
if /I "!ARG!"=="/debug" (
    set "EXTRA=!EXTRA! --debug"
    shift
    goto parse
)
if /I "!ARG!"=="/force" (
    set "EXTRA=!EXTRA! --force"
    shift
    goto parse
)
if /I "!ARG!"=="/nosam" (
    set "EXTRA=!EXTRA! --no-sam2"
    shift
    goto parse
)
if /I "!ARG!"=="/nofp16" (
    set "EXTRA=!EXTRA! --no-fp16"
    shift
    goto parse
)
if /I "!ARG!"=="/cpu" (
    set "EXTRA=!EXTRA! --no-fp16"
    set "CUDA_VISIBLE_DEVICES="
    shift
    goto parse
)
if not defined INPUT (
    set "INPUT=!ARG!"
    shift
    goto parse
)
set "EXTRA=!EXTRA! !ARG!"
shift
goto parse

:run
if defined INPUT (
    %PY% main.py "!INPUT!" !EXTRA!
) else (
    %PY% main.py !EXTRA!
)

endlocal
