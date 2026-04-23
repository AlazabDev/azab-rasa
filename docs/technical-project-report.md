# التقرير التقني للمشروع

## نظرة عامة

المشروع يعمل كمنظومة chatbot إنتاجية بدون Docker. يتكون من واجهة React، خادم FastAPI، Rasa Pro، Actions server، PostgreSQL، Redis، وتكاملات قنوات خارجية.

## المكونات الرئيسية

- Frontend: `azabot-prod`.
- Backend/API: `webhook/server.py`.
- Rasa domain/data/actions: `domain`, `data`, `actions`.
- Database schema: `database/uberfix_bot_gateway_schema.sql`.
- Deployment scripts: `scripts/deploy-server-nodocker.sh`.
- Runtime scripts local: `scripts/run-nodocker.ps1`, `scripts/check-nodocker.ps1`, `scripts/stop-nodocker.ps1`.
- Documentation: `docs`.

## بنية التشغيل

```text
User Browser
  -> React Frontend
  -> FastAPI Webhook
  -> Rasa REST API
  -> Rasa Actions
  -> FastAPI UberFix Bot Gateway
  -> PostgreSQL
```

Redis يستخدم كخدمة خارجية لتشغيل Rasa/Tracker حسب إعدادات البيئة. PostgreSQL يستخدم لتخزين طلبات UberFix والسجلات.

## Backend

FastAPI مسؤول عن:

- خدمة واجهة React المبنية من `azabot-prod/dist`.
- استقبال رسائل الدردشة.
- رفع الملفات.
- استقبال الصوت وتحويله لنص.
- تحويل الرد النصي لصوت.
- Webhooks لقنوات Meta وTelegram.
- Admin API داخلي.
- UberFix Bot Gateway.

## UberFix Bot Gateway

تم إنشاء endpoint محلي:

```text
POST /uberfix/bot-gateway
```

وظائفه:

- مصادقة الطلب عن طريق `x-api-key` أو `Authorization: Bearer`.
- التحقق من `api_consumers` عند وجود المفتاح في قاعدة البيانات.
- دعم مفتاح البيئة `UBERFIX_API_KEY` كمسار داخلي.
- Rate limit لكل مستهلك API.
- تسجيل كل طلب في `api_gateway_logs`.
- تسجيل العمليات الحساسة في `audit_logs`.
- تنفيذ أوامر الطلبات والصيانة على PostgreSQL.

## قاعدة البيانات

الجداول الأساسية:

- `api_consumers`: مفاتيح API للمواقع أو القنوات.
- `api_gateway_logs`: سجل طلبات Bot Gateway.
- `audit_logs`: سجل تدقيق العمليات.
- `bot_sessions`: سياق المحادثة والعميل.
- `branches`: الفروع.
- `maintenance_categories`: فئات الصيانة.
- `maintenance_requests`: طلبات الصيانة.
- `maintenance_request_notes`: ملاحظات الطلبات.
- `maintenance_technicians`: الفنيون.
- `outbound_messages`: رسائل صادرة لاحقة.

## قابلية التوسع

التصميم مناسب لتعدد المواقع أو المحلات أو الفروع لأن:

- كل طلب له `UUID` مستقل.
- كل مستهلك API يمكن عزله داخل `api_consumers`.
- يوجد rate limit لكل مستهلك.
- يمكن ربط الطلبات بقنوات مختلفة من خلال `channel` و`metadata`.
- يمكن إضافة branches وtechnicians بدون تغيير في واجهة البوت.

## الأمان

- `.env` خارج Git.
- مفاتيح API لا توضع في الواجهة.
- Bot Gateway يتحقق من المفتاح قبل تنفيذ أي عملية.
- العمليات تسجل في audit logs.
- الواجهة لا تكتب مباشرة في قاعدة البيانات.
- uploads تم استبعادها من Git.
- Snyk فحص ملفات المشروع الحقيقية بدون ثغرات.

## النشر

مسار الإنتاج الرسمي بدون Docker:

```bash
git pull --ff-only origin main
bash scripts/deploy-server-nodocker.sh --branch main --configure-nginx --domain bot.alazab.com
```

السكريبت يقوم بـ:

- تحميل `.env`.
- التحقق من المتغيرات المطلوبة.
- تثبيت Python dependencies.
- تثبيت/تحديث جداول UberFix.
- بناء الواجهة.
- تدريب Rasa.
- إنشاء وتشغيل خدمات systemd.
- إعداد Nginx عند طلب ذلك.
- فحص صحة Rasa وWebhook والواجهة.

## الفحوصات التي تمت

- Python compile للباك إند والأكشنز.
- Shell syntax لسكريبتات Linux.
- PowerShell syntax لسكريبتات Windows.
- Frontend lint.
- Frontend tests.
- Frontend production build.
- Snyk pip.
- Snyk pnpm.
- Snyk all-projects بعمق مناسب للمشروع.

## حالة محلية حالية

الخدمات المحلية Rasa/Webhook/Docs/Chat/Redis كانت تعمل في فحص `check-nodocker.ps1`. الفشل المحلي الوحيد كان PostgreSQL على `127.0.0.1:5432` لأنه غير شغال محلياً. على السيرفر يجب أن تشير متغيرات `DB_*` إلى PostgreSQL إنتاجي فعلي.

## ملفات مهمة

- `webhook/server.py`: FastAPI والبوابة المحلية.
- `actions/brand_actions/uberfix.py`: أكشنز UberFix في Rasa.
- `database/uberfix_bot_gateway_schema.sql`: schema الإنتاج.
- `scripts/deploy-server-nodocker.sh`: نشر الإنتاج.
- `scripts/install-uberfix-db.sh`: تثبيت الجداول على Linux.
- `scripts/install-uberfix-db.ps1`: تثبيت الجداول على Windows.
- `docs/production-runbook.md`: أوامر النشر والتحقق.
- `docs/bot-workflow-report.md`: شرح آلية عمل البوت.
