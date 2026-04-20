# ============================================================
#  Makefile — Alazab Group Chatbot
#  يدعم التشغيل المحلي و Docker Compose للإنتاج
# ============================================================
.PHONY: help setup install train validate run run-train stop test test-preflight test-smoke test-stack test-stack-down clean ssl-dev ssl-prod register-telegram up down logs logs-webhook status deploy widget nodocker-setup nodocker-up nodocker-down nodocker-check nodocker-logs prod-preflight prod-config prod-up prod-down prod-logs prod-status

COLOR_GREEN  = \033[32m
COLOR_YELLOW = \033[33m
COLOR_BLUE   = \033[34m
COLOR_RED    = \033[31m
COLOR_RESET  = \033[0m

help: ## عرض المساعدة
	@echo ""
	@echo "$(COLOR_BLUE)🤖 Alazab Group Chatbot — أوامر متاحة:$(COLOR_RESET)"
	@echo ""
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | \
		awk 'BEGIN {FS = ":.*?## "}; {printf "  $(COLOR_GREEN)%-18s$(COLOR_RESET) %s\n", $$1, $$2}'
	@echo ""

setup: ## إعداد البيئة الأولية
	@if [ ! -f .env ]; then \
		echo "$(COLOR_RED)❌ ملف .env غير موجود — أضفه من مصدر الأسرار الآمن$(COLOR_RESET)"; \
		exit 1; \
	fi
	@python3 -m venv venv 2>/dev/null || true
	@echo "$(COLOR_GREEN)✅ جاهز — شغّل: source venv/bin/activate$(COLOR_RESET)"

install: ## تثبيت المتطلبات في venv
	@. venv/bin/activate && python -m pip install --upgrade pip && pip install -e ".[dev]"
	@echo "$(COLOR_GREEN)✅ تم التثبيت$(COLOR_RESET)"

train: ## تدريب نموذج Rasa
	@echo "$(COLOR_BLUE)🧠 تدريب النموذج...$(COLOR_RESET)"
	@. venv/bin/activate && export $$(cat .env | grep -v '^#' | xargs) && rasa train --force
	@echo "$(COLOR_GREEN)✅ اكتمل التدريب$(COLOR_RESET)"

validate: ## التحقق من صحة ملفات المشروع
	@. venv/bin/activate && rasa data validate

run: ## تشغيل الخدمات (بدون تدريب)
	@./run.sh --skip-train

run-train: ## تشغيل الخدمات مع تدريب جديد
	@./run.sh

up: ## تشغيل Docker Compose
	@docker compose up -d --build

down: ## إيقاف Docker Compose
	@docker compose down --remove-orphans

logs: ## سجلات Rasa
	@docker compose logs -f rasa

logs-webhook: ## سجلات Webhook
	@docker compose logs -f webhook

status: ## حالة الخدمات
	@docker compose ps

deploy: ## نشر إنتاجي كامل
	@./deploy.sh

stop: ## إيقاف جميع الخدمات
	@pkill -f "rasa run" 2>/dev/null || true
	@pkill -f "rasa run actions" 2>/dev/null || true
	@pkill -f "uvicorn webhook" 2>/dev/null || true
	@echo "$(COLOR_RED)🛑 تم إيقاف الخدمات$(COLOR_RESET)"

test: ## تشغيل اختبارات E2E
	@. venv/bin/activate && rasa test e2e tests/e2e_test_cases/

test-preflight: ## فحص جاهزية بيئة الاختبار بدون تشغيل الخدمات
	@powershell -ExecutionPolicy Bypass -File ./scripts/test-preflight.ps1 -EnvFile .env -ComposeFile docker-compose.yaml

test-stack: ## تشغيل Stack الاختبار عبر Docker Compose
	@docker compose --env-file .env -f docker-compose.yaml up -d --build

test-smoke: ## اختبار API/Widget بعد تشغيل Stack الاختبار
	@powershell -ExecutionPolicy Bypass -File ./scripts/test-preflight.ps1 -EnvFile .env -ComposeFile docker-compose.yaml -RunSmoke

test-stack-down: ## إيقاف Stack الاختبار
	@docker compose --env-file .env -f docker-compose.yaml down --remove-orphans

clean: ## حذف النماذج والملفات المؤقتة
	@rm -rf models/ results/ .rasa/
	@find . -name "__pycache__" -exec rm -rf {} + 2>/dev/null; true
	@echo "$(COLOR_GREEN)✅ تم التنظيف$(COLOR_RESET)"

widget: ## فتح صفحة معاينة الـ Widget
	@echo "$(COLOR_BLUE)🌐 افتح الملف: chatbot-widget/index.html$(COLOR_RESET)"

ssl-dev: ## إنشاء شهادة SSL للتطوير
	@./scripts/setup-ssl.sh --dev

ssl-prod: ## إنشاء شهادة SSL للإنتاج
	@./scripts/setup-ssl.sh --domain webhook.alazab.com

register-telegram: ## تسجيل Telegram webhook
	@./scripts/register-telegram.sh

prod-preflight: ## فحص جاهزية الإنتاج قبل النشر
	@powershell -ExecutionPolicy Bypass -File ./scripts/production-preflight.ps1

prod-config: ## التحقق من docker-compose.prod.yaml
	@docker compose --env-file .env -f docker-compose.prod.yaml config

prod-up: ## تشغيل الإنتاج عبر docker-compose.prod.yaml
	@docker compose --env-file .env -f docker-compose.prod.yaml up -d --build

prod-down: ## إيقاف الإنتاج
	@docker compose --env-file .env -f docker-compose.prod.yaml down --remove-orphans

prod-logs: ## سجلات الإنتاج
	@docker compose --env-file .env -f docker-compose.prod.yaml logs -f

prod-status: ## حالة خدمات الإنتاج
	@docker compose --env-file .env -f docker-compose.prod.yaml ps


nodocker-setup: ## إنشاء .env.nodocker من القالب
	@if [ ! -f .env.nodocker ]; then cp .env.nodocker.example .env.nodocker; echo "تم إنشاء .env.nodocker — املأ بيانات قواعد الإنتاج"; else echo ".env.nodocker موجود"; fi

nodocker-up: ## تشغيل المشروع Python-only بدون Docker
	@powershell -ExecutionPolicy Bypass -File ./scripts/run-nodocker.ps1 -EnvFile .env.nodocker -SkipTrain

nodocker-down: ## إيقاف تشغيل Python-only
	@powershell -ExecutionPolicy Bypass -File ./scripts/stop-nodocker.ps1

nodocker-check: ## فحص تشغيل Python-only
	@powershell -ExecutionPolicy Bypass -File ./scripts/check-nodocker.ps1 -EnvFile .env.nodocker

nodocker-logs: ## عرض سجلات تشغيل Python-only
	@powershell -Command "Get-Content -Wait logs/webhook.out.log"
