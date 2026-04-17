# Python-only Runtime (No Docker)

هذا المسار يشغل المشروع بدون Docker نهائيًا.

الخدمات التي تعمل من Python مباشرة:

1. Rasa Actions على `127.0.0.1:5055`
2. Rasa API على `127.0.0.1:5005`
3. FastAPI Webhook على `0.0.0.0:8000`

## المطلوب قبل التشغيل

انسخ ملف البيئة:

```powershell
Copy-Item .env.nodocker.example .env.nodocker
notepad .env.nodocker
```

املأ القيم الحقيقية. لا تستخدم أسماء Docker مثل:

```text
postgres
redis
rasa
rasa-actions
```

استخدم عناوين الأنظمة الحقيقية:

```env
DB_HOST=real-company-postgres-host
REDIS_HOST=real-company-redis-host
ACTION_SERVER_URL=http://127.0.0.1:5055/webhook
RASA_URL=http://127.0.0.1:5005
```

## تشغيل بدون Docker

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\run-nodocker.ps1 -EnvFile .env.nodocker -SkipTrain
```

أو عبر Makefile:

```powershell
make nodocker-up
```

## الفحص

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\check-nodocker.ps1 -EnvFile .env.nodocker
```

أو:

```powershell
make nodocker-check
```

## الإيقاف

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\stop-nodocker.ps1
```

أو:

```powershell
make nodocker-down
```

## السجلات

```powershell
Get-Content -Wait logs\actions.out.log
Get-Content -Wait logs\rasa.out.log
Get-Content -Wait logs\webhook.out.log
```

## اختبار API

```powershell
Invoke-WebRequest http://127.0.0.1:8000/health -UseBasicParsing | Select-Object -ExpandProperty Content
```

```powershell
Invoke-RestMethod `
  -Uri http://127.0.0.1:8000/chat `
  -Method Post `
  -ContentType "application/json" `
  -Body '{"sender_id":"test_nodocker","message":"مرحبا","channel":"website","site_host":"bot.alazab.com","site_path":"/"}' |
  ConvertTo-Json -Depth 6
```

## الإنتاج

ضع Reverse Proxy أمام `127.0.0.1:8000` مثل Nginx أو IIS.

المسارات العامة المهمة:

```text
/chat
/chat/upload
/chat/audio
/webhook/meta
/webhook/telegram
/health
/widget
```

PostgreSQL وRedis في هذا التصميم خدمات خارجية فعلية وليست حاويات محلية.
