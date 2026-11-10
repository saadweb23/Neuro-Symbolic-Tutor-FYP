@echo off
rem NeuroTutor, locally: builds the website (first run only), starts the server and opens http://localhost:8000
cd /d "%~dp0"
if not exist frontend\app\dist\index.html (
  echo Building the website - first run only, about a minute...
  pushd frontend\app
  if not exist node_modules call npm install
  call npm run build
  popd
)
if not defined USE_QUESTION_BANK set USE_QUESTION_BANK=true
echo Starting NeuroTutor. Loading the models takes 30-40 seconds, then your browser opens.
start "" cmd /c "timeout /t 40 /nobreak >nul & start http://localhost:8000"
cd backend
python -m uvicorn main:app --host 127.0.0.1 --port 8000
pause
