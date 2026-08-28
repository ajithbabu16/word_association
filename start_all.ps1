$ErrorActionPreference = "Stop"

Write-Host "Starting QuriousBit Games Ecosystem..." -ForegroundColor Cyan

# 1. Start Codewords Python Backend
Write-Host "Starting Codewords backend..." -ForegroundColor Yellow
$codewordsDir = Join-Path $PSScriptRoot "codewords"
Start-Process -FilePath "python" -ArgumentList "combined_service.py" -WorkingDirectory $codewordsDir -WindowStyle Minimized

# 2. Start Word Association React App
Write-Host "Starting Word Association React App..." -ForegroundColor Yellow
$debugAppDir = Join-Path $PSScriptRoot "debug_app"
Start-Process -FilePath "cmd.exe" -ArgumentList "/c npm run dev" -WorkingDirectory $debugAppDir -WindowStyle Minimized

# 3. Start Launcher Server
Write-Host "Starting Unified Launcher on localhost:3000..." -ForegroundColor Yellow
Start-Process -FilePath "python" -ArgumentList "-m http.server 3000" -WorkingDirectory $PSScriptRoot -WindowStyle Minimized

Write-Host "Waiting 3 seconds for servers to initialize..." -ForegroundColor DarkGray
Start-Sleep -Seconds 3

# 4. Open the Launcher
Write-Host "Opening Unified Launcher..." -ForegroundColor Green
Start-Process -FilePath "http://localhost:3000"

Write-Host "All systems go! Close the minimized windows when you want to stop the servers." -ForegroundColor Cyan
