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

$ports = @(8000, 5005, 5055)
foreach ($port in $ports) {
    $listeners = Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue
    foreach ($listener in $listeners) {
        $proc = Get-Process -Id $listener.OwningProcess -ErrorAction SilentlyContinue
        if ($proc) {
            Write-Host "Stopping stale listener on port $port ($($listener.OwningProcess), $($proc.ProcessName))..." -ForegroundColor Cyan
            Stop-Process -Id $listener.OwningProcess -Force -ErrorAction SilentlyContinue
        }
    }
}

Remove-Item $pidFile -Force -ErrorAction SilentlyContinue
Write-Host "Python-only runtime stopped." -ForegroundColor Green
