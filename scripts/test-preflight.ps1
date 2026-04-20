param(
    [string]$EnvFile = ".env",
    [string]$ComposeFile = "docker-compose.yaml",
    [switch]$RunRasaValidate,
    [switch]$RunSmoke,
    [string]$SmokeBaseUrl = "http://127.0.0.1:8000"
)

$ErrorActionPreference = "Continue"
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
    if (-not (Test-Path $path)) { return $map }

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

function Test-Command($name) {
    return [bool](Get-Command $name -ErrorAction SilentlyContinue)
}

Write-Host "Alazab test preflight" -ForegroundColor Cyan
Write-Host "Env: $EnvFile"
Write-Host "Compose: $ComposeFile"
Write-Host ""

if (Test-Path $EnvFile) {
    Pass "$EnvFile exists"
} else {
    Fail "$EnvFile is missing"
}

if (Test-Path $ComposeFile) {
    Pass "$ComposeFile exists"
} else {
    Fail "$ComposeFile is missing"
}

$envMap = Read-EnvFile $EnvFile
$required = @(
    "RASA_PRO_LICENSE",
    "OPENAI_API_KEY",
    "DB_NAME",
    "DB_USER",
    "DB_PASSWORD",
    "REDIS_PASSWORD",
    "RASA_URL",
    "ACTION_SERVER_URL"
)

foreach ($key in $required) {
    if (-not $envMap.ContainsKey($key)) {
        Fail "$key is missing"
        continue
    }
    if ([string]::IsNullOrWhiteSpace($envMap[$key])) {
        Fail "$key is empty"
        continue
    }
    if ($envMap[$key] -match "replace-with|change-this") {
        Fail "$key still contains a placeholder"
        continue
    }
    Pass "$key is set"
}

if (Test-Command python) {
    $pythonVersion = python --version 2>&1
    Pass "Python available: $pythonVersion"

    python -m compileall actions webhook | Out-Host
    if ($LASTEXITCODE -eq 0) {
        Pass "Python syntax check passed"
    } else {
        Fail "Python syntax check failed"
    }
} else {
    Fail "python is not available"
}

if (Test-Command docker) {
    $services = docker compose --env-file $EnvFile -f $ComposeFile config --services 2>&1
    if ($LASTEXITCODE -eq 0) {
        Pass "Docker Compose config is valid"
        Write-Host "Services: $($services -join ', ')"
    } else {
        Fail "Docker Compose config failed"
        Write-Host $services
    }
} else {
    Warn "Docker CLI is not available. Skipping compose validation."
}

if ($RunRasaValidate) {
    if (Test-Command rasa) {
        foreach ($entry in $envMap.GetEnumerator()) {
            [Environment]::SetEnvironmentVariable($entry.Key, $entry.Value, "Process")
        }
        rasa data validate
        if ($LASTEXITCODE -eq 0) {
            Pass "Rasa data validation passed"
        } else {
            Fail "Rasa data validation failed"
        }
    } else {
        Warn "Rasa CLI is not available. Skipping rasa data validate."
    }
}

if ($RunSmoke) {
    $smokeScript = Join-Path $PSScriptRoot "smoke-test-sites.ps1"
    if (Test-Path $smokeScript) {
        & $smokeScript -BaseUrl $SmokeBaseUrl
        if ($LASTEXITCODE -eq 0) {
            Pass "Smoke tests passed"
        } else {
            Fail "Smoke tests failed"
        }
    } else {
        Fail "Smoke script is missing: $smokeScript"
    }
}

Write-Host ""
if ($failed) {
    Write-Host "Test preflight failed." -ForegroundColor Red
    exit 1
}

Write-Host "Test preflight passed." -ForegroundColor Green
