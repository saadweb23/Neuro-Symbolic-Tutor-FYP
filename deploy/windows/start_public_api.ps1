<#
 Publishes NeuroTutor (website + API in ONE process) to the internet through a free Cloudflare quick tunnel.

   powershell -ExecutionPolicy Bypass -File deploy\windows\start_public_api.ps1

 One-time setup:
   * the project's Python environment:   pip install -r requirements.txt
   * Node.js (already needed for the frontend) and cloudflared:   winget install --id Cloudflare.cloudflared
 What it does: builds the website if needed, starts the API on localhost (it also serves the website), and
 opens a tunnel. Copy the printed  https://<random>.trycloudflare.com  link: that is the public site.
 Database: press Enter at the prompt to use this PC's own database (backend\tutor_state.db, existing students
 are kept), or paste a Neon connection string (input hidden) to use the cloud database instead.
 The site is reachable only while this window stays open. Stop everything with Ctrl+C.
#>
param([int]$Port = 8000)
$ErrorActionPreference = 'Stop'
$repo     = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
$backend  = Join-Path $repo 'backend'
$frontend = Join-Path $repo 'frontend\app'

if (-not (Get-Command cloudflared -ErrorAction SilentlyContinue)) {
  throw 'cloudflared is not installed. Run:  winget install --id Cloudflare.cloudflared   (then open a NEW terminal)'
}

# 1. website build (served by the API itself, so one public URL covers site + API)
if (-not (Test-Path (Join-Path $frontend 'dist\index.html'))) {
  Write-Host 'Building the website (first run only, about a minute)...' -ForegroundColor Cyan
  Push-Location $frontend
  try {
    if (-not (Test-Path 'node_modules')) { npm install }
    npm run build
    if ($LASTEXITCODE -ne 0) { throw 'The website build failed.' }
  } finally { Pop-Location }
}

# 2. database choice
$secure = Read-Host 'Neon connection string (postgresql://...) - or just press Enter to use this PC''s local database' -AsSecureString
$bstr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
$dbUrl = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($bstr)
[Runtime.InteropServices.Marshal]::ZeroFreeBSTR($bstr)
if ($dbUrl) {
  if ($dbUrl -notmatch '^postgres(ql)?://') { throw 'That does not look like a PostgreSQL connection string.' }
  $env:DATABASE_URL = $dbUrl
  Write-Host 'Using the cloud database (Neon).' -ForegroundColor Green
} else {
  Remove-Item Env:DATABASE_URL -ErrorAction SilentlyContinue
  Write-Host 'Using the local database (backend\tutor_state.db).' -ForegroundColor Green
}
$env:NEURO_ENV = 'production'
$env:USE_QUESTION_BANK = 'true'
$env:PYTHONWARNINGS = 'ignore'

# 3. API + website on localhost only; the tunnel is the only way in from outside
Write-Host 'Starting NeuroTutor (loading the models takes 30-40 s)...' -ForegroundColor Cyan
$api = Start-Process -FilePath 'python' -ArgumentList @('-m', 'uvicorn', 'main:app', '--host', '127.0.0.1', '--port', "$Port") `
        -WorkingDirectory $backend -PassThru -NoNewWindow
try {
  $ready = $false
  for ($i = 0; $i -lt 150 -and -not $ready; $i++) {
    Start-Sleep -Seconds 2
    if ($api.HasExited) { throw 'The server exited. Read the messages above (missing packages? run: pip install -r requirements.txt).' }
    try { $ready = (Invoke-RestMethod "http://127.0.0.1:$Port/health" -TimeoutSec 3).status -eq 'ok' } catch { }
  }
  if (-not $ready) { throw 'The server did not become ready in time.' }
  Write-Host "Ready locally: http://127.0.0.1:$Port" -ForegroundColor Green
  Write-Host 'Opening the public tunnel. Your link appears below: https://<random>.trycloudflare.com' -ForegroundColor Cyan
  cloudflared tunnel --url "http://127.0.0.1:$Port" --no-autoupdate
}
finally {
  if ($api -and -not $api.HasExited) { Stop-Process -Id $api.Id -Force }
  Remove-Item Env:DATABASE_URL -ErrorAction SilentlyContinue
  Write-Host 'Stopped.' -ForegroundColor Yellow
}
