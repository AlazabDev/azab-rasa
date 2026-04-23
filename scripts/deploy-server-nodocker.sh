#!/usr/bin/env bash
# Production deploy script for Alazab Rasa/AzaBot without Docker.
# Usage:
#   bash scripts/deploy-server-nodocker.sh [--branch main] [--skip-pull] [--skip-train] [--skip-frontend] [--skip-db] [--skip-systemd]
#   bash scripts/deploy-server-nodocker.sh --configure-nginx --domain bot.alazab.com
set -Eeuo pipefail

APP_NAME="alazab-rasa"
BRANCH="main"
ENV_FILE=".env"
ENDPOINTS_FILE="endpoints.nodocker.yml"
PYTHON_BIN=""
WEBHOOK_WORKERS="${WEBHOOK_WORKERS:-2}"
SKIP_PULL=false
SKIP_TRAIN=false
SKIP_FRONTEND=false
SKIP_DB=false
SKIP_SYSTEMD=false
CONFIGURE_NGINX=false
DOMAIN=""

usage() {
  cat <<'USAGE'
Deploy Alazab Rasa/AzaBot on a Linux server without Docker.

Options:
  --branch NAME          Git branch to pull. Default: main
  --env-file FILE        Env file path relative to project root. Default: .env
  --endpoints-file FILE  Rasa endpoints file. Default: endpoints.nodocker.yml
  --python PATH          Python executable. Default: python3.11 then python3
  --webhook-workers N    Uvicorn workers. Default: 2
  --skip-pull            Do not run git fetch/pull
  --skip-train           Do not run rasa train
  --skip-frontend        Do not run pnpm install/build in azabot
  --skip-db              Do not install/update UberFix PostgreSQL schema
  --skip-systemd         Prepare/build only, do not write/restart services
  --configure-nginx      Write an nginx reverse proxy config for the domain
  --domain DOMAIN        Domain used with --configure-nginx
  -h, --help             Show help

Examples:
  bash scripts/deploy-server-nodocker.sh
  bash scripts/deploy-server-nodocker.sh --skip-train
  bash scripts/deploy-server-nodocker.sh --configure-nginx --domain bot.alazab.com
USAGE
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --branch) BRANCH="${2:?Missing branch}"; shift 2 ;;
    --env-file) ENV_FILE="${2:?Missing env file}"; shift 2 ;;
    --endpoints-file) ENDPOINTS_FILE="${2:?Missing endpoints file}"; shift 2 ;;
    --python) PYTHON_BIN="${2:?Missing python path}"; shift 2 ;;
    --webhook-workers) WEBHOOK_WORKERS="${2:?Missing worker count}"; shift 2 ;;
    --skip-pull) SKIP_PULL=true; shift ;;
    --skip-train) SKIP_TRAIN=true; shift ;;
    --skip-frontend) SKIP_FRONTEND=true; shift ;;
    --skip-db) SKIP_DB=true; shift ;;
    --skip-systemd) SKIP_SYSTEMD=true; shift ;;
    --configure-nginx) CONFIGURE_NGINX=true; shift ;;
    --domain) DOMAIN="${2:?Missing domain}"; shift 2 ;;
    -h|--help) usage; exit 0 ;;
    *) echo "Unknown option: $1" >&2; usage; exit 2 ;;
  esac
done

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
APP_DIR="$(cd -- "$SCRIPT_DIR/.." && pwd)"
cd "$APP_DIR"

log() { printf '\033[1;34m[deploy]\033[0m %s\n' "$*"; }
ok() { printf '\033[1;32m[ok]\033[0m %s\n' "$*"; }
warn() { printf '\033[1;33m[warn]\033[0m %s\n' "$*"; }
fail() { printf '\033[1;31m[fail]\033[0m %s\n' "$*" >&2; exit 1; }

if [[ "${EUID}" -eq 0 ]]; then
  SUDO=""
else
  SUDO="sudo"
fi

require_cmd() {
  command -v "$1" >/dev/null 2>&1 || fail "Missing command: $1"
}

load_env() {
  [[ -f "$ENV_FILE" ]] || fail "Missing $ENV_FILE. Add real production values before deploy."
  while IFS= read -r raw_line || [[ -n "$raw_line" ]]; do
    raw_line="${raw_line%$'\r'}"
    [[ -z "${raw_line//[[:space:]]/}" || "$raw_line" =~ ^[[:space:]]*# ]] && continue
    [[ "$raw_line" == *"="* ]] || continue
    local key="${raw_line%%=*}"
    local value="${raw_line#*=}"
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
}

require_env() {
  local name="$1"
  local value="${!name:-}"
  if [[ -z "$value" || "$value" == *"replace-with"* || "$value" == "changeme" ]]; then
    fail "Required env var is missing or placeholder: $name"
  fi
}

choose_python() {
  if [[ -n "$PYTHON_BIN" ]]; then
    command -v "$PYTHON_BIN" >/dev/null 2>&1 || [[ -x "$PYTHON_BIN" ]] || fail "Python not found: $PYTHON_BIN"
    return
  fi
  if command -v python3.11 >/dev/null 2>&1; then
    PYTHON_BIN="python3.11"
  elif command -v python3 >/dev/null 2>&1; then
    PYTHON_BIN="python3"
  else
    fail "Missing python3.11/python3"
  fi
}

run_cmd() {
  log "$*"
  "$@"
}

health_get() {
  local name="$1" url="$2" attempts="${3:-30}" delay="${4:-2}"
  for _ in $(seq 1 "$attempts"); do
    if curl -fsS "$url" >/dev/null 2>&1; then
      ok "$name ready: $url"
      return 0
    fi
    sleep "$delay"
  done
  fail "$name is not healthy: $url"
}

write_service() {
  local service_name="$1" content="$2" path="/etc/systemd/system/${service_name}.service"
  log "Writing systemd service: $service_name"
  printf '%s\n' "$content" | $SUDO tee "$path" >/dev/null
}

validate_env() {
  require_env RASA_PRO_LICENSE
  require_env OPENAI_API_KEY
  require_env DB_HOST
  require_env DB_PORT
  require_env DB_NAME
  require_env DB_USER
  require_env DB_PASSWORD
  require_env REDIS_HOST
  require_env REDIS_PORT
  require_env REDIS_PASSWORD
  require_env ACTION_SERVER_URL
  require_env RASA_URL
  require_env ADMIN_API_KEY

  if [[ "${DB_HOST:-}" == "postgres" || "${REDIS_HOST:-}" == "redis" ]]; then
    fail "DB_HOST/REDIS_HOST still use Docker service names. Set real production hosts in $ENV_FILE."
  fi

  [[ -f "$ENDPOINTS_FILE" ]] || fail "Missing endpoints file: $ENDPOINTS_FILE"
}

install_python_deps() {
  choose_python
  if [[ ! -x "$APP_DIR/.venv/bin/python" ]]; then
    run_cmd "$PYTHON_BIN" -m venv "$APP_DIR/.venv"
  fi
  run_cmd "$APP_DIR/.venv/bin/python" -m pip install --upgrade pip wheel setuptools
  run_cmd "$APP_DIR/.venv/bin/python" -m pip install -e "$APP_DIR"
}

install_database_schema() {
  $SKIP_DB && { warn "Skipping UberFix database schema install"; return; }
  require_cmd psql
  [[ -f "$APP_DIR/scripts/install-uberfix-db.sh" ]] || fail "Missing scripts/install-uberfix-db.sh"
  local args=(--env-file "$ENV_FILE")
  run_cmd bash "$APP_DIR/scripts/install-uberfix-db.sh" "${args[@]}"
}

install_frontend() {
  $SKIP_FRONTEND && { warn "Skipping frontend build"; return; }
  [[ -d "$APP_DIR/azabot" ]] || fail "Missing azabot frontend directory"
  require_cmd node
  if command -v corepack >/dev/null 2>&1; then
    run_cmd corepack enable
    run_cmd corepack prepare pnpm@10.33.0 --activate
  fi
  require_cmd pnpm
  run_cmd pnpm --dir "$APP_DIR/azabot" install --frozen-lockfile
  run_cmd pnpm --dir "$APP_DIR/azabot" lint
  run_cmd pnpm --dir "$APP_DIR/azabot" test
  run_cmd pnpm --dir "$APP_DIR/azabot" build
}

train_rasa() {
  $SKIP_TRAIN && { warn "Skipping Rasa train"; return; }
  run_cmd "$APP_DIR/.venv/bin/rasa" data validate || warn "Rasa validation returned warnings/errors; review output above."
  run_cmd "$APP_DIR/.venv/bin/rasa" train --force
}

write_systemd_services() {
  $SKIP_SYSTEMD && { warn "Skipping systemd setup"; return; }

  local common_env="EnvironmentFile=${APP_DIR}/${ENV_FILE}
Environment=PYTHONUTF8=1
Environment=PYTHONIOENCODING=utf-8
WorkingDirectory=${APP_DIR}
Restart=always
RestartSec=5
User=${SUDO_USER:-$(id -un)}
Group=$(id -gn "${SUDO_USER:-$(id -un)}")"

  write_service "${APP_NAME}-actions" "[Unit]
Description=Alazab Rasa Actions Server
After=network-online.target
Wants=network-online.target

[Service]
${common_env}
ExecStart=${APP_DIR}/.venv/bin/rasa run actions --port 5055

[Install]
WantedBy=multi-user.target"

  write_service "${APP_NAME}-rasa" "[Unit]
Description=Alazab Rasa Server
After=network-online.target ${APP_NAME}-actions.service
Wants=network-online.target
Requires=${APP_NAME}-actions.service

[Service]
${common_env}
Environment=ALLOWED_ORIGINS=${ALLOWED_ORIGINS:-*}
ExecStart=${APP_DIR}/.venv/bin/rasa run --enable-api --endpoints ${ENDPOINTS_FILE} --cors \${ALLOWED_ORIGINS} --port 5005

[Install]
WantedBy=multi-user.target"

  write_service "${APP_NAME}-webhook" "[Unit]
Description=Alazab FastAPI Webhook and Frontend Server
After=network-online.target ${APP_NAME}-rasa.service
Wants=network-online.target
Requires=${APP_NAME}-rasa.service

[Service]
${common_env}
Environment=WEBHOOK_WORKERS=${WEBHOOK_WORKERS}
ExecStart=${APP_DIR}/.venv/bin/python -m uvicorn webhook.server:app --host 0.0.0.0 --port 8000 --workers \${WEBHOOK_WORKERS}

[Install]
WantedBy=multi-user.target"

  run_cmd $SUDO systemctl daemon-reload
  run_cmd $SUDO systemctl enable "${APP_NAME}-actions" "${APP_NAME}-rasa" "${APP_NAME}-webhook"
  run_cmd $SUDO systemctl restart "${APP_NAME}-actions"
  sleep 5
  run_cmd $SUDO systemctl restart "${APP_NAME}-rasa"
  sleep 10
  run_cmd $SUDO systemctl restart "${APP_NAME}-webhook"
}

write_nginx_config() {
  $CONFIGURE_NGINX || return
  [[ -n "$DOMAIN" ]] || fail "--domain is required with --configure-nginx"
  require_cmd nginx

  local nginx_conf="server {
    listen 80;
    server_name ${DOMAIN};

    client_max_body_size 25m;

    location / {
        proxy_pass http://127.0.0.1:8000;
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection \"upgrade\";
        proxy_read_timeout 120s;
        proxy_send_timeout 120s;
    }
}"

  log "Writing nginx site for ${DOMAIN}"
  printf '%s\n' "$nginx_conf" | $SUDO tee "/etc/nginx/sites-available/${APP_NAME}.conf" >/dev/null
  $SUDO ln -sfn "/etc/nginx/sites-available/${APP_NAME}.conf" "/etc/nginx/sites-enabled/${APP_NAME}.conf"
  run_cmd $SUDO nginx -t
  run_cmd $SUDO systemctl reload nginx
  ok "Nginx configured for http://${DOMAIN}"
  warn "SSL is not issued by this script. Run certbot or your existing SSL process after DNS points to this server."
}

main() {
  log "Project: $APP_DIR"
  require_cmd git
  require_cmd curl
  load_env
  validate_env

  if ! $SKIP_PULL; then
    run_cmd git fetch origin "$BRANCH"
    run_cmd git checkout "$BRANCH"
    run_cmd git pull --ff-only origin "$BRANCH"
  else
    warn "Skipping git pull"
  fi

  mkdir -p "$APP_DIR/logs" "$APP_DIR/.runtime"
  install_python_deps
  install_database_schema
  install_frontend
  train_rasa
  write_systemd_services
  write_nginx_config

  if ! $SKIP_SYSTEMD; then
    health_get "Rasa" "http://127.0.0.1:5005/" 45 2
    health_get "Webhook" "http://127.0.0.1:8000/health" 45 2
    health_get "Frontend" "http://127.0.0.1:8000/" 20 2
    ok "Deploy completed"
    echo ""
    echo "Services:"
    echo "  sudo systemctl status ${APP_NAME}-actions --no-pager"
    echo "  sudo systemctl status ${APP_NAME}-rasa --no-pager"
    echo "  sudo systemctl status ${APP_NAME}-webhook --no-pager"
    echo "Logs:"
    echo "  sudo journalctl -u ${APP_NAME}-webhook -f"
  else
    ok "Build/preparation completed without systemd restart"
  fi
}

main "$@"
