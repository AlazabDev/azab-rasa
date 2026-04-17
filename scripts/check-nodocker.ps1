param(
    [string]$EnvFile = ".env.nodocker"
)

$ErrorActionPreference = "Continue"
$failed = $false

function Check-Http($Name, $Url) {
    try {
        $res = Invoke-WebRequest -Uri $Url -UseBasicParsing -TimeoutSec 8
        if ($res.StatusCode -ge 200 -and $res.StatusCode -lt 300) {
            Write-Host "[OK]   $Name -> $Url" -ForegroundColor Green
        } else {
            Write-Host "[FAIL] $Name -> HTTP $($res.StatusCode)" -ForegroundColor Red
            $script:failed = $true
        }
    } catch {
        Write-Host "[FAIL] $Name -> $($_.Exception.Message)" -ForegroundColor Red
        $script:failed = $true
    }
}

function Load-Env($Path) {
    if (-not (Test-Path $Path)) { return }
    Get-Content -Path $Path | ForEach-Object {
        $line = $_.Trim()
        if (-not $line -or $line.StartsWith("#")) { return }
        $idx = $line.IndexOf("=")
        if ($idx -le 0) { return }
        [Environment]::SetEnvironmentVariable($line.Substring(0, $idx).Trim(), $line.Substring($idx + 1).Trim().Trim('"').Trim("'"), "Process")
    }
}

Load-Env $EnvFile

Write-Host "Python-only health check" -ForegroundColor Cyan
Check-Http "Rasa" "http://127.0.0.1:5005/"
Check-Http "Webhook" "http://127.0.0.1:8000/health"
Check-Http "Webhook docs" "http://127.0.0.1:8000/docs"

try {
    $chat = Invoke-RestMethod -Uri "http://127.0.0.1:8000/chat" -Method Post -ContentType "application/json" -Body '{"sender_id":"nodocker_check","message":"مرحبا","channel":"website","site_host":"alazab.com"}' -TimeoutSec 20
    if ($chat.responses) {
        Write-Host "[OK]   Chat endpoint returned responses" -ForegroundColor Green
    } else {
        Write-Host "[FAIL] Chat endpoint returned empty responses" -ForegroundColor Red
        $failed = $true
    }
} catch {
    Write-Host "[FAIL] Chat endpoint -> $($_.Exception.Message)" -ForegroundColor Red
    $failed = $true
}

if ($env:DB_HOST) {
    $dbOk = Test-NetConnection -ComputerName $env:DB_HOST -Port ([int]$env:DB_PORT) -InformationLevel Quiet
    if ($dbOk) { Write-Host "[OK]   PostgreSQL TCP reachable: $($env:DB_HOST):$($env:DB_PORT)" -ForegroundColor Green }
    else { Write-Host "[FAIL] PostgreSQL TCP unreachable: $($env:DB_HOST):$($env:DB_PORT)" -ForegroundColor Red; $failed = $true }
}

if ($env:REDIS_HOST) {
    $redisOk = Test-NetConnection -ComputerName $env:REDIS_HOST -Port ([int]$env:REDIS_PORT) -InformationLevel Quiet
    if ($redisOk) { Write-Host "[OK]   Redis TCP reachable: $($env:REDIS_HOST):$($env:REDIS_PORT)" -ForegroundColor Green }
    else { Write-Host "[FAIL] Redis TCP unreachable: $($env:REDIS_HOST):$($env:REDIS_PORT)" -ForegroundColor Red; $failed = $true }
}

if ($failed) { exit 1 }
Write-Host "All Python-only checks passed." -ForegroundColor Green
