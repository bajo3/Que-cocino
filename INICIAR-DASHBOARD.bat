@echo off
title WhatsApp Memory Assistant - Dashboard
cd /d "%~dp0"
echo ============================================================
echo   Iniciando el DASHBOARD web...
echo   Cuando diga "Ready", abri:  http://localhost:3003
echo   Usuario y clave: ver DASHBOARD_USER / DASHBOARD_PASSWORD en .env
echo   NO cierres esta ventana mientras lo usas.
echo ============================================================
echo.
call pnpm --filter dashboard start
echo.
pause
