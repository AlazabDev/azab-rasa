#!/usr/bin/env bash
# ============================================================
#  deploy.sh — سكربت النشر الاحترافي لـ Alazab Group Chatbot
#  الاستخدام: ./deploy.sh [--skip-train] [--skip-validate]
# ============================================================
set -euo pipefail

SKIP_TRAIN=false
SKIP_VALIDATE=false

for arg in "$@"; do
  case $arg in
    --skip-train)    SKIP_TRAIN=true ;;
    --skip-validate) SKIP_VALIDATE=true ;;
  esac
done

# إذا كان TRAIN_ON_DEPLOY=false في .env → تخطى التدريب تلقائياً
[[ "${TRAIN_ON_DEPLOY:-true}" == "false" ]] && SKIP_TRAIN=true

# ── ألوان ────────────────────────────────────────────────────
RED='\033[0;31m' GREEN='\033[0;32m' YELLOW='\033[1;33m' BLUE='\033[0;34m' NC='\033[0m'

echo -e "${BLUE}"
echo "  ╔═══════════════════════════════════════╗"
echo "  ║   🤖 Alazab Group Chatbot — Deploy   ║"
echo "  ╚═══════════════════════════════════════╝"
echo -e "${NC}"

# ── 1. التحقق من وجود .env ──────────────────────────────────
if [[ ! -f ".env" ]]; then
  echo -e "${RED}❌ ملف .env غير موجود!${NC}"
  echo "   أضف ملف .env من مصدر الأسرار الآمن ثم أعد التشغيل"
  exit 1
fi

# تحميل المتغيرات وتخطي التعليقات والأسطر الفارغة
set -a
# shellcheck disable=SC2046
export $(grep -v '^#' .env | grep -v '^$' | xargs) 2>/dev/null || true
set +a

echo -e "${GREEN}✅ تم تحميل .env${NC}"

# ── 2. التحقق من المتغيرات الحرجة ────────────────────────────
MISSING=()
[[ -z "${RASA_PRO_LICENSE:-}" ]] && MISSING+=("RASA_PRO_LICENSE")
[[ -z "${OPENAI_API_KEY:-}"   ]] && MISSING+=("OPENAI_API_KEY")
[[ -z "${DB_PASSWORD:-}"      ]] && MISSING+=("DB_PASSWORD")
[[ -z "${REDIS_PASSWORD:-}"   ]] && MISSING+=("REDIS_PASSWORD")

if [[ ${#MISSING[@]} -gt 0 ]]; then
  echo -e "${RED}❌ متغيرات مطلوبة غير محددة في .env:${NC}"
  printf '   - %s\n' "${MISSING[@]}"
  exit 1
fi

echo -e "${GREEN}✅ جميع المتغيرات الحرجة موجودة${NC}"

# ── 3. التحقق من وجود SSL ─────────────────────────────────────
if [[ ! -f "ssl/fullchain.pem" || ! -f "ssl/privkey.pem" ]]; then
  echo -e "${YELLOW}⚠️  شهادات SSL غير موجودة في ssl/${NC}"
  echo "   للتطوير: mkdir -p ssl && openssl req -x509 -nodes -newkey rsa:2048 \\"
  echo "     -keyout ssl/privkey.pem -out ssl/fullchain.pem -days 365 -subj '/CN=localhost'"
  echo ""
  read -rp "   هل تريد المتابعة بدون SSL؟ [y/N] " confirm
  [[ "$confirm" != "y" && "$confirm" != "Y" ]] && exit 1
fi

# ── 4. تدريب نموذج Rasa ─────────────────────────────────────
if [[ "$SKIP_TRAIN" == "false" ]]; then
  echo ""
  echo -e "${BLUE}🤖 تدريب نموذج Rasa Pro...${NC}"
  if rasa train --force 2>&1; then
    echo -e "${GREEN}✅ اكتمل التدريب${NC}"
  else
    echo -e "${RED}❌ فشل التدريب — تحقق من ملفات data/ و domain/${NC}"
    exit 1
  fi
else
  echo -e "${YELLOW}⏭️  تم تخطي التدريب (--skip-train)${NC}"
fi

# ── 5. التحقق من صحة الـ config ─────────────────────────────
if [[ "$SKIP_VALIDATE" == "false" ]]; then
  echo ""
  echo -e "${BLUE}🔍 التحقق من صحة ملفات المشروع...${NC}"
  rasa data validate || echo -e "${YELLOW}⚠️  بعض التحذيرات — راجع الناتج أعلاه${NC}"
fi

# ── 6. إيقاف الحاويات القديمة ───────────────────────────────
echo ""
echo -e "${BLUE}🛑 إيقاف الحاويات القديمة...${NC}"
docker compose down --remove-orphans

# ── 7. بناء الصور وتشغيل الحاويات ───────────────────────────
echo ""
echo -e "${BLUE}🐳 بناء وتشغيل الحاويات...${NC}"
docker compose up -d --build

# ── 8. انتظار جاهزية الخدمات ────────────────────────────────
echo ""
echo -e "${BLUE}⏳ انتظار جاهزية الخدمات...${NC}"
WAIT_SECS=60
for i in $(seq 1 $WAIT_SECS); do
  printf "\r   %d/%d ثانية..." "$i" "$WAIT_SECS"
  sleep 1
done
echo ""

# ── 9. فحص صحة الخدمات ──────────────────────────────────────
echo ""
echo -e "${BLUE}🩺 فحص صحة الخدمات:${NC}"

check_service() {
  local name=$1 url=$2
  if curl -sf "$url" -o /dev/null 2>/dev/null; then
    echo -e "  ${GREEN}✅ $name → $url${NC}"
    return 0
  else
    echo -e "  ${YELLOW}⚠️  $name → غير جاهز بعد (تحقق من: docker compose logs $name)${NC}"
    return 1
  fi
}

check_service "Webhook API"  "http://localhost:8000/health"
check_service "Rasa Server"  "http://localhost:5005/"
check_service "Brands API"   "http://localhost:8000/brands"

# ── 10. عرض حالة الحاويات ───────────────────────────────────
echo ""
echo -e "${BLUE}📊 حالة الحاويات:${NC}"
docker compose ps

echo ""
echo -e "${GREEN}"
echo "  ╔═══════════════════════════════════════════╗"
echo "  ║          🎉 اكتمل النشر بنجاح!           ║"
echo "  ╠═══════════════════════════════════════════╣"
echo "  ║  🌐 API Docs:  http://localhost:8000/docs ║"
echo "  ║  🤖 Rasa:      http://localhost:5005      ║"
echo "  ║  🎨 Widget:    http://localhost/widget    ║"
echo "  ╚═══════════════════════════════════════════╝"
echo -e "${NC}"
echo "  📋 لمتابعة السجلات:"
echo "     docker compose logs -f rasa"
echo "     docker compose logs -f webhook"
