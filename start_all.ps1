$ErrorActionPreference = "Stop"

Write-Host "Starting QuriousBit Games Ecosystem..." -ForegroundColor Cyan

# 1. Start Codewords Python Backend
Write-Host "Starting Codewords backend..." -ForegroundColor Yellow
$codewordsDir = Join-Path $PSScriptRoot "codewords"
$p1 = Start-Process -FilePath "python" -ArgumentList "combined_service.py" -WorkingDirectory $codewordsDir -WindowStyle Minimized -PassThru

# 2. Start Word Association React App
Write-Host "Starting Word Association React App..." -ForegroundColor Yellow
$debugAppDir = Join-Path $PSScriptRoot "debug_app"
$p2 = Start-Process -FilePath "cmd.exe" -ArgumentList "/c npm run dev" -WorkingDirectory $debugAppDir -WindowStyle Minimized -PassThru

# 3. Start Launcher Server
Write-Host "Starting Unified Launcher on localhost:3000..." -ForegroundColor Yellow
$p3 = Start-Process -FilePath "python" -ArgumentList "-m http.server 3000" -WorkingDirectory $PSScriptRoot -WindowStyle Minimized -PassThru

Write-Host "Waiting 3 seconds for servers to initialize..." -ForegroundColor DarkGray
Start-Sleep -Seconds 3

# 4. Open the Launcher
Write-Host "Opening Unified Launcher..." -ForegroundColor Green
Start-Process -FilePath "http://localhost:3000"

Write-Host "All systems go! A popup window will appear. Click OK on it to stop the servers." -ForegroundColor Cyan
Add-Type -AssemblyName System.Windows.Forms
[System.Windows.Forms.MessageBox]::Show("Servers are running. Click OK to stop them all.", "QuriousBit Ecosystem", 0, 64) | Out-Null

Write-Host "Stopping servers..." -ForegroundColor Yellow
taskkill /PID $p1.Id /T /F 2>&1 | Out-Null
taskkill /PID $p2.Id /T /F 2>&1 | Out-Null
taskkill /PID $p3.Id /T /F 2>&1 | Out-Null
Write-Host "All servers stopped." -ForegroundColor Green
