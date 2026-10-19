# PowerShell startup script for DUK Slice Advisor
$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot

$Python312 = "C:\Users\Admin\AppData\Local\Programs\Python\Python312\python.exe"

if (Test-Path $Python312) {
    Write-Host "[1/3] Binding Poetry to official installed Python 3.12: $Python312" -ForegroundColor Cyan
    poetry env use $Python312
} else {
    Write-Host "[1/3] Using default Python environment..." -ForegroundColor Cyan
}

Write-Host "[2/3] Installing dependencies..." -ForegroundColor Cyan
poetry install

$runtimeDir = "$PSScriptRoot\data\runtime"
New-Item -ItemType Directory -Force -Path "$runtimeDir\tmp" | Out-Null
New-Item -ItemType Directory -Force -Path "$runtimeDir\crewai" | Out-Null

$env:CREWAI_STORAGE_DIR = "$runtimeDir\crewai"
$env:LOCALAPPDATA = "$runtimeDir"
$env:APPDATA = "$runtimeDir"
$env:TEMP = "$runtimeDir\tmp"
$env:TMP = "$runtimeDir\tmp"
$env:CREWAI_DISABLE_TELEMETRY = "true"
$env:CREWAI_DISABLE_TRACKING = "true"
$env:OTEL_SDK_DISABLED = "true"
$env:ANONYMIZED_TELEMETRY = "False"

Write-Host "[3/3] Starting DUK Slice Advisor API on http://localhost:8000..." -ForegroundColor Green
.\.venv\Scripts\python.exe -m uvicorn duk.main:app --host 0.0.0.0 --port 8000

