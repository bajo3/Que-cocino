@echo off
cd /d "%~dp0"
echo Iniciando listener, worker y dashboard con reinicio automatico...
corepack pnpm assistant
pause
