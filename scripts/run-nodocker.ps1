param(
    [string]$EnvFile = ".env.nodocker",
    [switch]$SkipInstall,
    [switch]$SkipTrain,
    [int]$WebhookWorkers = 1
)

$ErrorActionPreference = "Stop"
$Root = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
Set-Location $Root

function Load-Env($Path) {
    if (-not (Test-Path $Path)) {
        throw "Environment file not found: $Path. Copy .env.nodocker.example to .env.nodocker and fill real values."
    }

    Get-Content -Path $Path | ForEach-Object {
        $line = $_.Trim()
        if (-not $line -or $line.StartsWith("#")) { return }
        $idx = $line.IndexOf("=")
        if ($idx -le 0) { return }
        $key = $line.Substring(0, $idx).Trim()
        $value = $line.Substring($idx + 1).Trim().Trim('"').Trim("'")
        [Environment]::SetEnvironmentVariable($key, $value, "Process")
    }
}

function Require-Env($Name) {
    $value = [Environment]::GetEnvironmentVariable($Name, "Process")
    if ([string]::IsNullOrWhiteSpace($value) -or $value -match "replace-with") {
        throw "Required env var is missing or placeholder: $Name"
    }
}

Load-Env $EnvFile

$required = @(
    "RASA_PRO_LICENSE",
    "OPENAI_API_KEY",
    "DB_HOST",
    "DB_PORT",
    "DB_NAME",
    "DB_USER",
    "DB_PASSWORD",
    "REDIS_HOST",
    "REDIS_PORT",
    "REDIS_PASSWORD",
    "ACTION_SERVER_URL",
    "RASA_URL"
)
$required | ForEach-Object { Require-Env $_ }

if ($env:DB_HOST -eq "postgres" -or $env:REDIS_HOST -eq "redis") {
    throw "DB_HOST/REDIS_HOST still use Docker service names. Set real hosts in $EnvFile."
}

$VenvPython = Join-Path $Root ".venv\Scripts\python.exe"
$VenvRasa = Join-Path $Root ".venv\Scripts\rasa.exe"
if (-not (Test-Path $VenvPython)) {
    Write-Host "Creating Python virtual environment..." -ForegroundColor Cyan
    py -3.11 -m venv .venv
}

if (-not $SkipInstall) {
    Write-Host "Installing Python dependencies..." -ForegroundColor Cyan
    & $VenvPython -m pip install --upgrade pip
    & $VenvPython -m pip install -e ".[dev]"
}

if (-not (Test-Path $VenvRasa)) {
    throw "Rasa executable not found at $VenvRasa. Run without -SkipInstall first."
}

if (-not $SkipTrain) {
    Write-Host "Training Rasa model..." -ForegroundColor Cyan
    & $VenvRasa train --force
}

New-Item -ItemType Directory -Path ".runtime", "logs" -Force | Out-Null

Write-Host "Starting Actions server on 127.0.0.1:5055..." -ForegroundColor Cyan
$actions = Start-Process -FilePath $VenvRasa `
    -ArgumentList @("run", "actions", "--port", "5055") `
    -RedirectStandardOutput "logs\actions.out.log" `
    -RedirectStandardError "logs\actions.err.log" `
    -PassThru -WindowStyle Hidden
Start-Sleep -Seconds 5

Write-Host "Starting Rasa server on 127.0.0.1:5005..." -ForegroundColor Cyan
$rasa = Start-Process -FilePath $VenvRasa `
    -ArgumentList @("run", "--enable-api", "--cors", $env:ALLOWED_ORIGINS, "--port", "5005") `
    -RedirectStandardOutput "logs\rasa.out.log" `
    -RedirectStandardError "logs\rasa.err.log" `
    -PassThru -WindowStyle Hidden
Start-Sleep -Seconds 10

Write-Host "Starting Webhook API on 0.0.0.0:8000..." -ForegroundColor Cyan
$webhookArgs = @("-m", "uvicorn", "webhook.server:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "$WebhookWorkers")
$webhook = Start-Process -FilePath $VenvPython `
    -ArgumentList $webhookArgs `
    -RedirectStandardOutput "logs\webhook.out.log" `
    -RedirectStandardError "logs\webhook.err.log" `
    -PassThru -WindowStyle Hidden

$pids = [ordered]@{
    started_at = (Get-Date).ToString("o")
    env_file = $EnvFile
    actions = $actions.Id
    rasa = $rasa.Id
    webhook = $webhook.Id
}
$pids | ConvertTo-Json | Set-Content -Path ".runtime\nodocker-pids.json"

Write-Host ""
Write-Host "Python-only runtime started." -ForegroundColor Green
Write-Host "Actions: http://127.0.0.1:5055"
Write-Host "Rasa:    http://127.0.0.1:5005"
Write-Host "Webhook: http://127.0.0.1:8000"
Write-Host "Docs:    http://127.0.0.1:8000/docs"
Write-Host "PIDs:    .runtime\nodocker-pids.json"
Write-Host "Logs:    logs\*.log"
