param(
    [string]$EnvFile = ".env",
    [string]$ComposeFile = "docker-compose.prod.yaml"
)

$ErrorActionPreference = "Stop"
$failed = $false

function Fail($message) {
    Write-Host "[FAIL] $message" -ForegroundColor Red
    $script:failed = $true
}

function Pass($message) {
    Write-Host "[OK]   $message" -ForegroundColor Green
}

function Warn($message) {
    Write-Host "[WARN] $message" -ForegroundColor Yellow
}

function Read-EnvFile($path) {
    $map = @{}
    Get-Content -Path $path | ForEach-Object {
        $line = $_.Trim()
        if (-not $line -or $line.StartsWith("#")) { return }
        $idx = $line.IndexOf("=")
        if ($idx -le 0) { return }
        $key = $line.Substring(0, $idx).Trim()
        $value = $line.Substring($idx + 1).Trim().Trim('"').Trim("'")
        $map[$key] = $value
    }
    return $map
}

Write-Host "Production preflight" -ForegroundColor Cyan
Write-Host "Env: $EnvFile"
Write-Host "Compose: $ComposeFile"
Write-Host ""

if (-not (Test-Path $EnvFile)) {
    Fail "$EnvFile is missing. Provide the real environment file before running production checks."
} else {
    Pass "$EnvFile exists"
}

if (-not (Test-Path $ComposeFile)) {
    Fail "$ComposeFile is missing"
} else {
    Pass "$ComposeFile exists"
}

if (Test-Path $EnvFile) {
    $envMap = Read-EnvFile $EnvFile
    $required = @(
        "RASA_PRO_LICENSE",
        "OPENAI_API_KEY",
        "ADMIN_API_KEY",
        "DB_NAME",
        "DB_USER",
        "DB_PASSWORD",
        "REDIS_PASSWORD",
        "PUBLIC_BASE_URL",
        "ALLOWED_ORIGINS",
        "RASA_URL",
        "ACTION_SERVER_URL",
        "JWT_SECRET",
        "ENCRYPTION_KEY"
    )

    foreach ($key in $required) {
        if (-not $envMap.ContainsKey($key) -or [string]::IsNullOrWhiteSpace($envMap[$key])) {
            Fail "$key is missing or empty"
            continue
        }
        if ($envMap[$key] -match "replace-with|change-this") {
            Fail "$key still contains placeholder value"
            continue
        }
        Pass "$key is set"
    }

    $origins = @($envMap["ALLOWED_ORIGINS"] -split ",")
    $expectedOrigins = @(
        "https://bot.alazab.com",
        "https://www.bot.alazab.com"
    )
    foreach ($origin in $expectedOrigins) {
        if ($origins -contains $origin) { Pass "CORS includes $origin" } else { Fail "CORS missing $origin" }
    }
}

if (Test-Path "ssl/fullchain.pem") { Pass "ssl/fullchain.pem exists" } else { Fail "ssl/fullchain.pem missing" }
if (Test-Path "ssl/privkey.pem") { Pass "ssl/privkey.pem exists" } else { Fail "ssl/privkey.pem missing" }

$dockerAvailable = $false
try {
    docker version *> $null
    if ($LASTEXITCODE -eq 0) { $dockerAvailable = $true }
} catch {}

if ($dockerAvailable) {
    Pass "Docker is available"
    $env:APP_ENV_FILE = $EnvFile
    docker compose --env-file $EnvFile -f $ComposeFile config *> $null
    Remove-Item Env:\APP_ENV_FILE -ErrorAction SilentlyContinue
    if ($LASTEXITCODE -eq 0) { Pass "docker compose production config is valid" } else { Fail "docker compose production config failed" }
} else {
    Warn "Docker is not available. Skipping compose config validation."
}

if ($failed) {
    Write-Host ""
    Write-Host "Production preflight failed." -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "Production preflight passed." -ForegroundColor Green

