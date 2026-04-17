#!/usr/bin/env bash
# ============================================================
#  run.sh — تشغيل Alazab Chatbot (Python only)
#  Server: 158.101.231.62 | chat.alazab.com
#  Usage: ./run.sh [--skip-train] [--actions-only] [--rasa-only]
# ============================================================
set -euo pipefail

RED='\033[0;31m' GREEN='\033[0;32m' YELLOW='\033[1;33m'
BLUE='\033[0;34m' CYAN='\033[0;36m' NC='\033[0m'

SKIP_TRAIN=false; ACTIONS_ONLY=false; RASA_ONLY=false

for arg in "$@"; do
  case $arg in
    --skip-train)   SKIP_TRAIN=true ;;
    --actions-only) ACTIONS_ONLY=true ;;
    --rasa-only)    RASA_ONLY=true ;;
  esac
done

echo -e "${BLUE}"
echo "  ╔══════════════════════════════════════════╗"
echo "  ║   🤖 Alazab Group Chatbot — Starting    ║"
echo "  ║   Server: 158.101.231.62                 ║"
echo "  ╚══════════════════════════════════════════╝"
echo -e "${NC}"

# ── تحميل .env ────────────────────────────────────────────────
if [[ ! -f ".env" ]]; then
  echo -e "${RED}❌ ملف .env غير موجود!${NC}"; exit 1
fi
set -a
export $(grep -v '^#' .env | grep -v '^$' | grep -v '^\s*$' | xargs -d '\n') 2>/dev/null || true
set +a
echo -e "${GREEN}✅ تم تحميل .env${NC}"

# ── التحقق من المتغيرات الحرجة ───────────────────────────────
MISSING=()
[[ -z "${RASA_PRO_LICENSE:-}" ]] && MISSING+=("RASA_PRO_LICENSE")
[[ -z "${OPENAI_API_KEY:-}"   ]] && MISSING+=("OPENAI_API_KEY")
[[ -z "${REDIS_PASSWORD:-}"   ]] && MISSING+=("REDIS_PASSWORD")

if [[ ${#MISSING[@]} -gt 0 ]]; then
  echo -e "${RED}❌ متغيرات مفقودة: ${MISSING[*]}${NC}"; exit 1
fi
echo -e "${GREEN}✅ المتغيرات الحرجة موجودة${NC}"

# ── venv ──────────────────────────────────────────────────────
if [[ ! -d "venv" ]]; then
  echo -e "${YELLOW}⚙️  إنشاء بيئة Python...${NC}"
  python3 -m venv venv
  source venv/bin/activate
  python -m pip install -q --upgrade pip
  pip install -q -e ".[dev]"
  echo -e "${GREEN}✅ تم تثبيت المتطلبات${NC}"
else
  source venv/bin/activate
fi

# ── مواءمة الإعدادات للتشغيل المحلي بدون Docker ────────────────
if [[ "${ACTION_SERVER_URL:-}" == "http://rasa-actions:5055/webhook" || -z "${ACTION_SERVER_URL:-}" ]]; then
  export ACTION_SERVER_URL="http://localhost:5055/webhook"
fi
if [[ "${RASA_URL:-}" == "http://rasa:5005" || -z "${RASA_URL:-}" ]]; then
  export RASA_URL="http://localhost:5005"
fi
if [[ "${DB_HOST:-}" == "postgres" || -z "${DB_HOST:-}" ]]; then
  export DB_HOST="localhost"
fi
if [[ "${REDIS_HOST:-}" == "redis" || -z "${REDIS_HOST:-}" ]]; then
  export REDIS_HOST="localhost"
fi
if [[ -z "${DB_PORT:-}" ]]; then
  export DB_PORT="5432"
fi
if [[ -z "${REDIS_PORT:-}" ]]; then
  export REDIS_PORT="6379"
fi
if [[ -z "${REDIS_USE_SSL:-}" ]]; then
  export REDIS_USE_SSL="false"
fi

# ── التدريب ───────────────────────────────────────────────────
if [[ "$SKIP_TRAIN" == "false" && "$ACTIONS_ONLY" == "false" && "$RASA_ONLY" == "false" ]]; then
  echo -e "\n${BLUE}🧠 تدريب النموذج...${NC}"
  rasa train --force
  echo -e "${GREEN}✅ اكتمل التدريب${NC}\n"
fi

# ── تشغيل الخدمات ─────────────────────────────────────────────
echo -e "${BLUE}🚀 تشغيل الخدمات...${NC}"

if [[ "$RASA_ONLY" == "false" ]]; then
  rasa run actions --port 5055 2>&1 | sed 's/^/[actions] /' &
  ACTIONS_PID=$!
  echo -e "  ${GREEN}✅ Actions Server${NC} → localhost:5055 (PID: $ACTIONS_PID)"
  sleep 3
fi

if [[ "$ACTIONS_ONLY" == "false" ]]; then
  rasa run \
    --enable-api \
    --cors "*" \
    --port 5005 \
    2>&1 | sed 's/^/[rasa] /' &
  RASA_PID=$!
  echo -e "  ${GREEN}✅ Rasa Server${NC}   → localhost:5005  (PID: $RASA_PID)"
  sleep 5

  uvicorn webhook.server:app \
    --host 0.0.0.0 \
    --port 8000 \
    --workers 2 \
    2>&1 | sed 's/^/[webhook] /' &
  WEBHOOK_PID=$!
  echo -e "  ${GREEN}✅ Webhook API${NC}   → localhost:8000  (PID: $WEBHOOK_PID)"
fi

echo ""
echo -e "${GREEN}"
echo "  ╔══════════════════════════════════════════════╗"
echo "  ║         ✅ جميع الخدمات تعمل!              ║"
echo "  ╠══════════════════════════════════════════════╣"
echo "  ║  🤖 Rasa:    http://localhost:5005           ║"
echo "  ║  ⚙️  Actions: http://localhost:5055           ║"
echo "  ║  🌐 API:     http://localhost:8000           ║"
echo "  ║  📖 Docs:    http://localhost:8000/docs      ║"
echo "  ╚══════════════════════════════════════════════╝"
echo -e "${NC}"
echo "  اضغط Ctrl+C لإيقاف جميع الخدمات"

# PID file للإدارة
echo "${ACTIONS_PID:-} ${RASA_PID:-} ${WEBHOOK_PID:-}" > /tmp/alazab_pids

trap '
  echo -e "\n${RED}🛑 إيقاف الخدمات...${NC}"
  kill ${ACTIONS_PID:-} ${RASA_PID:-} ${WEBHOOK_PID:-} 2>/dev/null || true
  rm -f /tmp/alazab_pids
  echo -e "${RED}✅ تم الإيقاف${NC}"
' EXIT INT TERM

wait
