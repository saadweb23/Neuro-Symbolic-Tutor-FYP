@echo off
cd /d "%~dp0frontend\app"
call npm run dev -- --port 5173 --host 0.0.0.0
