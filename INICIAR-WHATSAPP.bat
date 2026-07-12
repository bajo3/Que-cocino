@echo off
title WhatsApp Memory Assistant - Listener
cd /d "%~dp0"
echo ============================================================
echo   Iniciando el listener de WhatsApp...
echo   Cuando aparezca, abri en el navegador:  http://localhost:3001/qr
echo   y escanea el QR con tu telefono.
echo   NO cierres esta ventana mientras lo usas.
echo ============================================================
echo.
node apps\listener\dist\index.js
echo.
echo ============================================================
echo   El listener se detuvo. Revisa los mensajes de arriba.
echo ============================================================
pause
