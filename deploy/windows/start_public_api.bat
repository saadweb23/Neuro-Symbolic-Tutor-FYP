@echo off
rem Double-click: publishes NeuroTutor (site + API) through a free Cloudflare tunnel. See start_public_api.ps1.
powershell -ExecutionPolicy Bypass -File "%~dp0start_public_api.ps1"
pause
