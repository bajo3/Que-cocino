@echo off
title WhatsApp Memory Assistant - Worker (IA)
cd /d "%~dp0"
echo ============================================================
echo   Iniciando el WORKER (procesa mensajes con IA)...
echo   NO cierres esta ventana mientras lo usas.
echo ============================================================
echo.
node apps\worker\dist\index.js
echo.
echo ============================================================
echo   El worker se detuvo. Revisa los mensajes de arriba.
echo ============================================================
pause
