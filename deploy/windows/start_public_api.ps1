<#
 Starts the NeuroTutor API on THIS PC against the Neon PostgreSQL database and exposes it to the internet
 through a free Cloudflare quick tunnel (no account needed). The website on Vercel talks to the printed URL.

   powershell -ExecutionPolicy Bypass -File deploy\windows\start_public_api.ps1 -AllowedOrigin https://<project>.vercel.app

 Requirements (once):
   * the project's Python environment:   pip install -r requirements.txt
   * cloudflared:                         winget install --id Cloudflare.cloudflared
 You are asked for the Neon connection string (input is hidden, never written to disk or shell history).
 Get it from console.neon.tech > project "neurotutor" > Connection details > Connection pooling ON > copy.
 Stop everything with Ctrl+C. The site is reachable only while this window is open.
#>
param(
  [Parameter(Mandatory = $true)][string]$AllowedOrigin,   # the Vercel site that may call the API
  [int]$Port = 8000
)
$ErrorActionPreference = 'Stop'
$repo = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
$backend = Join-Path $repo 'backend'

$secure = Read-Host 'Neon connection string (postgresql://...)' -AsSecureString
$bstr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
$dbUrl = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($bstr)
[Runtime.InteropServices.Marshal]::ZeroFreeBSTR($bstr)
if ($dbUrl -notmatch '^postgres(ql)?://') { throw 'That does not look like a PostgreSQL connection string.' }

if (-not (Get-Command cloudflared -ErrorAction SilentlyContinue)) {
  throw 'cloudflared is not installed. Run:  winget install --id Cloudflare.cloudflared   (then open a new terminal)'
}

# Production settings for this process only. The API listens on localhost; only the tunnel can reach it.
$env:DATABASE_URL       = $dbUrl
$env:NEURO_ENV          = 'production'
$env:CORS_ORIGINS       = $AllowedOrigin.TrimEnd('/')
$env:USE_QUESTION_BANK  = 'true'
$env:PYTHONWARNINGS     = 'ignore'

Write-Host "Starting the API (loading the models takes 30-40 s)..." -ForegroundColor Cyan
$api = Start-Process -FilePath 'python' -ArgumentList @('-m', 'uvicorn', 'main:app', '--host', '127.0.0.1', '--port', "$Port") `
        -WorkingDirectory $backend -PassThru -NoNewWindow
try {
  $ready = $false
  for ($i = 0; $i -lt 120 -and -not $ready; $i++) {
    Start-Sleep -Seconds 2
    if ($api.HasExited) { throw 'The API process exited. Check the messages above (missing packages? run pip install -r requirements.txt).' }
    try { $ready = (Invoke-RestMethod "http://127.0.0.1:$Port/health" -TimeoutSec 3).status -eq 'ok' } catch { }
  }
  if (-not $ready) { throw 'The API did not become ready in time.' }
  $db = Invoke-RestMethod "http://127.0.0.1:$Port/health/db" -TimeoutSec 20
  Write-Host "API ready. Database: $($db.database)" -ForegroundColor Green
  Write-Host "Starting the tunnel. Copy the https://<random>.trycloudflare.com URL printed below and send it to your assistant." -ForegroundColor Cyan
  cloudflared tunnel --url "http://127.0.0.1:$Port" --no-autoupdate
}
finally {
  if ($api -and -not $api.HasExited) { Stop-Process -Id $api.Id -Force }
  Remove-Item Env:DATABASE_URL -ErrorAction SilentlyContinue
  Write-Host 'Stopped.' -ForegroundColor Yellow
}
