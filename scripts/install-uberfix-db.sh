#!/usr/bin/env bash
# Install UberFix/Bot Gateway tables directly into PostgreSQL.
# Usage:
#   bash scripts/install-uberfix-db.sh [--env-file .env] [--start-seq 1046]
set -Eeuo pipefail

ENV_FILE=".env"
START_SEQ=""

while [[ $# -gt 0 ]]; do
  case "$1" in
    --env-file) ENV_FILE="${2:?Missing env file}"; shift 2 ;;
    --start-seq) START_SEQ="${2:?Missing sequence value}"; shift 2 ;;
    -h|--help)
      echo "Usage: bash scripts/install-uberfix-db.sh [--env-file .env] [--start-seq 1046]"
      exit 0
      ;;
    *) echo "Unknown option: $1" >&2; exit 2 ;;
  esac
done

ROOT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

log() { printf '\033[1;34m[db]\033[0m %s\n' "$*"; }
fail() { printf '\033[1;31m[db]\033[0m %s\n' "$*" >&2; exit 1; }

[[ -f "$ENV_FILE" ]] || fail "Missing env file: $ENV_FILE"
command -v psql >/dev/null 2>&1 || fail "psql is not installed"

while IFS= read -r raw_line || [[ -n "$raw_line" ]]; do
  raw_line="${raw_line%$'\r'}"
  [[ -z "${raw_line//[[:space:]]/}" || "$raw_line" =~ ^[[:space:]]*# ]] && continue
  [[ "$raw_line" == *"="* ]] || continue
  key="${raw_line%%=*}"
  value="${raw_line#*=}"
  key="$(printf '%s' "$key" | xargs)"
  [[ "$key" =~ ^[A-Za-z_][A-Za-z0-9_]*$ ]] || continue
  value="${value#"${value%%[![:space:]]*}"}"
  value="${value%"${value##*[![:space:]]}"}"
  if [[ "$value" == \"*\" && "$value" == *\" ]]; then
    value="${value:1:${#value}-2}"
  elif [[ "$value" == \'*\' && "$value" == *\' ]]; then
    value="${value:1:${#value}-2}"
  fi
  export "$key=$value"
done < "$ENV_FILE"

: "${DB_HOST:?DB_HOST missing}"
: "${DB_PORT:?DB_PORT missing}"
: "${DB_NAME:?DB_NAME missing}"
: "${DB_USER:?DB_USER missing}"
: "${DB_PASSWORD:?DB_PASSWORD missing}"

export PGPASSWORD="$DB_PASSWORD"

log "Checking PostgreSQL connection ${DB_HOST}:${DB_PORT}/${DB_NAME} as ${DB_USER}"
psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -v ON_ERROR_STOP=1 -c "select current_database(), current_user;"

log "Installing schema"
psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -v ON_ERROR_STOP=1 -f "database/uberfix_bot_gateway_schema.sql"

if [[ -n "$START_SEQ" ]]; then
  log "Setting request number sequence to ${START_SEQ}"
  psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -v ON_ERROR_STOP=1 -c "select setval('maintenance_request_number_seq', ${START_SEQ}, false);"
fi

if [[ -n "${UBERFIX_API_KEY:-}" ]]; then
  log "Seeding api consumer azabot without printing key"
  psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -v ON_ERROR_STOP=1 \
    -v api_key="$UBERFIX_API_KEY" \
    -c "insert into api_consumers (name, channel, api_key, api_key_hash, api_key_last4, is_active, rate_limit_per_minute, allowed_origins) values ('azabot', 'api', :'api_key', encode(digest(:'api_key', 'sha256'), 'hex'), right(:'api_key', 4), true, 60, ARRAY['https://bot.alazab.com','https://chat.alazab.com']) on conflict (name) do update set api_key = excluded.api_key, api_key_hash = excluded.api_key_hash, api_key_last4 = excluded.api_key_last4, is_active = true, updated_at = now();"
fi

log "Verifying tables"
psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -v ON_ERROR_STOP=1 -c "select table_name from information_schema.tables where table_schema='public' and table_name in ('api_consumers','api_gateway_logs','audit_logs','bot_sessions','branches','maintenance_categories','maintenance_requests','maintenance_request_notes','maintenance_technicians','outbound_messages') order by table_name;"

log "Done"
