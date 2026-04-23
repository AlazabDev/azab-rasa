param(
    [string]$EnvFile = ".env",
    [int]$StartSeq = 0
)
$ErrorActionPreference = "Stop"
$Root = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
Set-Location $Root

function Load-Env($Path) {
    if (-not (Test-Path $Path)) { throw "Missing env file: $Path" }
    Get-Content $Path | ForEach-Object {
        $line = $_.Trim()
        if (-not $line -or $line.StartsWith("#") -or -not $line.Contains("=")) { return }
        $idx = $line.IndexOf("=")
        $key = $line.Substring(0, $idx).Trim()
        $value = $line.Substring($idx + 1).Trim().Trim('"').Trim("'")
        [Environment]::SetEnvironmentVariable($key, $value, "Process")
    }
}

Load-Env $EnvFile
foreach ($name in @("DB_HOST", "DB_PORT", "DB_NAME", "DB_USER", "DB_PASSWORD")) {
    if ([string]::IsNullOrWhiteSpace([Environment]::GetEnvironmentVariable($name, "Process"))) {
        throw "Missing env var: $name"
    }
}

$env:PGPASSWORD = $env:DB_PASSWORD
Write-Host "[db] Checking PostgreSQL connection $env:DB_HOST`:$env:DB_PORT/$env:DB_NAME as $env:DB_USER"
psql -h $env:DB_HOST -p $env:DB_PORT -U $env:DB_USER -d $env:DB_NAME -v ON_ERROR_STOP=1 -c "select current_database(), current_user;"
if ($LASTEXITCODE -ne 0) { throw "PostgreSQL connection failed" }

Write-Host "[db] Installing schema"
psql -h $env:DB_HOST -p $env:DB_PORT -U $env:DB_USER -d $env:DB_NAME -v ON_ERROR_STOP=1 -f "database/uberfix_bot_gateway_schema.sql"
if ($LASTEXITCODE -ne 0) { throw "Schema installation failed" }

if ($StartSeq -gt 0) {
    Write-Host "[db] Setting request sequence to $StartSeq"
    psql -h $env:DB_HOST -p $env:DB_PORT -U $env:DB_USER -d $env:DB_NAME -v ON_ERROR_STOP=1 -c "select setval('maintenance_request_number_seq', $StartSeq, false);"
}

if (-not [string]::IsNullOrWhiteSpace($env:UBERFIX_API_KEY)) {
    Write-Host "[db] Seeding api consumer azabot without printing key"
    psql -h $env:DB_HOST -p $env:DB_PORT -U $env:DB_USER -d $env:DB_NAME -v ON_ERROR_STOP=1 -v api_key="$env:UBERFIX_API_KEY" -c "insert into api_consumers (name, channel, api_key, api_key_hash, api_key_last4, is_active, rate_limit_per_minute, allowed_origins) values ('azabot', 'api', :'api_key', encode(digest(:'api_key', 'sha256'), 'hex'), right(:'api_key', 4), true, 60, ARRAY['https://bot.alazab.com','https://chat.alazab.com']) on conflict (name) do update set api_key = excluded.api_key, api_key_hash = excluded.api_key_hash, api_key_last4 = excluded.api_key_last4, is_active = true, updated_at = now();"
}

Write-Host "[db] Verifying tables"
psql -h $env:DB_HOST -p $env:DB_PORT -U $env:DB_USER -d $env:DB_NAME -v ON_ERROR_STOP=1 -c "select table_name from information_schema.tables where table_schema='public' and table_name in ('api_consumers','api_gateway_logs','audit_logs','bot_sessions','branches','maintenance_categories','maintenance_requests','maintenance_request_notes','maintenance_technicians','outbound_messages') order by table_name;"
Write-Host "[db] Done"
