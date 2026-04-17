#!/usr/bin/env bash
# ============================================================
#  scripts/register-telegram.sh
#  يُسجِّل Telegram webhook تلقائياً بعد النشر
#  الاستخدام: ./scripts/register-telegram.sh
# ============================================================
set -euo pipefail

GREEN='\033[0;32m' RED='\033[0;31m' YELLOW='\033[1;33m' NC='\033[0m'

# تحميل .env
if [[ -f ".env" ]]; then
  export $(grep -v '^#' .env | grep -v '^$' | xargs) 2>/dev/null || true
fi

if [[ -z "${TELEGRAM_BOT_TOKEN:-}" ]]; then
  echo -e "${RED}❌ TELEGRAM_BOT_TOKEN غير محدد في .env${NC}"
  exit 1
fi

if [[ -z "${PUBLIC_BASE_URL:-}" ]]; then
  echo -e "${RED}❌ PUBLIC_BASE_URL غير محدد في .env${NC}"
  exit 1
fi

WEBHOOK_URL="${PUBLIC_BASE_URL}/webhook/telegram"

echo -e "${YELLOW}🤖 تسجيل Telegram webhook...${NC}"
echo "   Bot Token: ${TELEGRAM_BOT_TOKEN:0:10}..."
echo "   Webhook URL: ${WEBHOOK_URL}"

RESPONSE=$(curl -s -X POST \
  "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/setWebhook" \
  -H "Content-Type: application/json" \
  -d "{\"url\": \"${WEBHOOK_URL}\", \"allowed_updates\": [\"message\", \"edited_message\"]}")

OK=$(echo "$RESPONSE" | python3 -c "import sys,json; print(json.load(sys.stdin).get('ok','false'))" 2>/dev/null || echo "false")

if [[ "$OK" == "True" ]]; then
  echo -e "${GREEN}✅ تم تسجيل Telegram webhook بنجاح!${NC}"
  echo "   URL: ${WEBHOOK_URL}"
else
  echo -e "${RED}❌ فشل التسجيل:${NC}"
  echo "$RESPONSE"
  exit 1
fi

# عرض معلومات الـ webhook
echo ""
echo -e "${YELLOW}ℹ️  معلومات الـ webhook الحالية:${NC}"
curl -s "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/getWebhookInfo" | \
  python3 -c "
import sys, json
d = json.load(sys.stdin)
r = d.get('result', {})
print(f\"  URL: {r.get('url', 'N/A')}\")
print(f\"  Pending updates: {r.get('pending_update_count', 0)}\")
print(f\"  Last error: {r.get('last_error_message', 'None')}\")
"
