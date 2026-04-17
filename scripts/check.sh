#!/usr/bin/env bash
# ============================================================
#  scripts/check.sh — التحقق من حالة جميع الخدمات
#  Usage: ./scripts/check.sh
# ============================================================
RED='\033[0;31m' GREEN='\033[0;32m' YELLOW='\033[1;33m'
BLUE='\033[0;34m' NC='\033[0m'

echo -e "${BLUE}"
echo "  ══════════════════════════════════════════"
echo "  🔍 Alazab Chatbot — Health Check"
echo "  ══════════════════════════════════════════"
echo -e "${NC}"

ALL_OK=true

check() {
  local name="$1" url="$2" expect="${3:-200}"
  local code
  code=$(curl -s -o /dev/null -w "%{http_code}" --max-time 5 "$url" 2>/dev/null || echo "000")
  if [[ "$code" == "$expect" ]]; then
    echo -e "  ${GREEN}✅ $name${NC} → $url (HTTP $code)"
  else
    echo -e "  ${RED}❌ $name${NC} → $url (HTTP $code — متوقع $expect)"
    ALL_OK=false
  fi
}

echo -e "${BLUE}📡 فحص الخدمات المحلية:${NC}"
check "Rasa Server"    "http://localhost:5005/"
check "Actions Server" "http://localhost:5055/health"
check "Webhook API"    "http://localhost:8000/health"
check "API Docs"       "http://localhost:8000/docs"

echo ""
echo -e "${BLUE}🌐 فحص القنوات الخارجية:${NC}"

# تحميل .env
[[ -f ".env" ]] && source <(grep -v '^#' .env | grep -v '^$')

# Telegram
if [[ -n "${TELEGRAM_BOT_TOKEN:-}" ]]; then
  code=$(curl -s -o /dev/null -w "%{http_code}" \
    "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/getMe" 2>/dev/null || echo "000")
  [[ "$code" == "200" ]] \
    && echo -e "  ${GREEN}✅ Telegram Bot${NC} → متصل (HTTP 200)" \
    || echo -e "  ${RED}❌ Telegram Bot${NC} → HTTP $code"
else
  echo -e "  ${YELLOW}⏭️  Telegram${NC} — TELEGRAM_BOT_TOKEN غير محدد"
fi

# Redis Cloud
if [[ -n "${REDIS_HOST:-}" ]]; then
  redis_ok=$(redis-cli -h "${REDIS_HOST}" -p "${REDIS_PORT:-6379}" \
    -a "${REDIS_PASSWORD:-}" --no-auth-warning ping 2>/dev/null || echo "FAIL")
  [[ "$redis_ok" == "PONG" ]] \
    && echo -e "  ${GREEN}✅ Redis Cloud${NC} → متصل (PONG)" \
    || echo -e "  ${RED}❌ Redis Cloud${NC} → فشل الاتصال"
else
  echo -e "  ${YELLOW}⏭️  Redis${NC} — REDIS_HOST غير محدد"
fi

# PostgreSQL
if command -v psql &>/dev/null && [[ -n "${DB_PASSWORD:-}" ]]; then
  pg_ok=$(PGPASSWORD="${DB_PASSWORD}" psql -h localhost -U "${DB_USER:-alazab_user}" \
    -d "${DB_NAME:-alazab_chatbot}" -c "SELECT 1" -t 2>/dev/null | tr -d ' ' || echo "FAIL")
  [[ "$pg_ok" == "1" ]] \
    && echo -e "  ${GREEN}✅ PostgreSQL${NC} → متصل" \
    || echo -e "  ${RED}❌ PostgreSQL${NC} → فشل الاتصال"
else
  echo -e "  ${YELLOW}⏭️  PostgreSQL${NC} — psql غير متاح أو DB_PASSWORD فارغ"
fi

echo ""
echo -e "${BLUE}📊 إحصائيات الرسائل:${NC}"
curl -s http://localhost:8000/admin/stats 2>/dev/null \
  | python3 -c "
import sys, json
try:
  d = json.load(sys.stdin)
  print(f\"  الرسائل الكلية: {d.get('total',0)}\")
  for ch, cnt in d.get('message_counts',{}).items():
    print(f\"  {ch}: {cnt}\")
  print(f\"  وقت التشغيل: {d.get('uptime_seconds',0)//60} دقيقة\")
except:
  print('  لا توجد إحصائيات بعد')
" 2>/dev/null || echo "  لا توجد إحصائيات"

echo ""
if $ALL_OK; then
  echo -e "${GREEN}  ✅ كل الخدمات الأساسية تعمل بشكل طبيعي${NC}"
else
  echo -e "${RED}  ⚠️  بعض الخدمات لا تعمل — راجع السجلات أعلاه${NC}"
fi
echo ""
