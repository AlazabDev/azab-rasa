$ErrorActionPreference = "Continue"
$pidFile = ".runtime\nodocker-pids.json"
if (-not (Test-Path $pidFile)) {
    Write-Host "No PID file found: $pidFile" -ForegroundColor Yellow
    exit 0
}

$pids = Get-Content -Raw -Path $pidFile | ConvertFrom-Json
foreach ($name in @("webhook", "rasa", "actions")) {
    $pidValue = $pids.$name
    if ($pidValue) {
        $proc = Get-Process -Id $pidValue -ErrorAction SilentlyContinue
        if ($proc) {
            Write-Host "Stopping $name ($pidValue)..." -ForegroundColor Cyan
            Stop-Process -Id $pidValue -Force -ErrorAction SilentlyContinue
        } else {
            Write-Host "$name ($pidValue) is not running" -ForegroundColor Yellow
        }
    }
}

Remove-Item $pidFile -Force -ErrorAction SilentlyContinue
Write-Host "Python-only runtime stopped." -ForegroundColor Green
