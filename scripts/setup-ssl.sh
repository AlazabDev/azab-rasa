#!/usr/bin/env bash
# ============================================================
#  scripts/setup-ssl.sh — إعداد شهادات SSL
#  الاستخدام:
#    للتطوير:  ./scripts/setup-ssl.sh --dev
#    للإنتاج:  ./scripts/setup-ssl.sh --domain rasa.alazab.com
# ============================================================
set -euo pipefail

RED='\033[0;31m' GREEN='\033[0;32m' YELLOW='\033[1;33m' NC='\033[0m'

mkdir -p ssl

if [[ "${1:-}" == "--dev" ]]; then
  echo -e "${YELLOW}⚙️  إنشاء شهادة self-signed للتطوير...${NC}"
  openssl req -x509 -nodes -newkey rsa:2048 \
    -keyout ssl/privkey.pem \
    -out ssl/fullchain.pem \
    -days 365 \
    -subj '/CN=localhost' \
    -quiet
  echo -e "${GREEN}✅ شهادة self-signed جاهزة في ssl/${NC}"
  echo "   تحذير: لا تستخدمها في الإنتاج!"

elif [[ "${1:-}" == "--domain" && -n "${2:-}" ]]; then
  DOMAIN="$2"
  echo -e "${YELLOW}🔐 طلب شهادة Let's Encrypt لـ ${DOMAIN}...${NC}"
  if ! command -v certbot &>/dev/null; then
    echo -e "${RED}❌ certbot غير مثبت — ثبّته: apt install certbot${NC}"
    exit 1
  fi
  certbot certonly --standalone -d "$DOMAIN" --non-interactive --agree-tos \
    -m "devops@alazab.com"
  cp "/etc/letsencrypt/live/${DOMAIN}/fullchain.pem" ssl/fullchain.pem
  cp "/etc/letsencrypt/live/${DOMAIN}/privkey.pem"   ssl/privkey.pem
  chmod 600 ssl/privkey.pem
  echo -e "${GREEN}✅ شهادة Let's Encrypt جاهزة في ssl/${NC}"

else
  echo "الاستخدام:"
  echo "  ./scripts/setup-ssl.sh --dev"
  echo "  ./scripts/setup-ssl.sh --domain rasa.alazab.com"
  exit 1
fi
