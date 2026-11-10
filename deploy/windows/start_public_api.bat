@echo off
rem Double-click helper: asks for the Vercel site URL, then starts the public API (see start_public_api.ps1).
set /p ORIGIN=Vercel site URL (https://....vercel.app): 
powershell -ExecutionPolicy Bypass -File "%~dp0start_public_api.ps1" -AllowedOrigin "%ORIGIN%"
pause
