# Production Runbook

This runbook prepares the Alazab Rasa stack for production deployment.

## 1. Prepare Secrets

Copy the template and fill production-only rotated secrets:

```powershell
Copy-Item .env.production.example .env.production
notepad .env.production
```

Do not reuse development secrets for production. Required values include:

- `RASA_PRO_LICENSE`
- `OPENAI_API_KEY`
- `ADMIN_API_KEY`
- `DB_PASSWORD`
- `REDIS_PASSWORD`
- `JWT_SECRET`
- `ENCRYPTION_KEY`

## 2. Prepare SSL

Place real certificate files here:

- `ssl/fullchain.pem`
- `ssl/privkey.pem`

The certificate must cover:

- `bot.alazab.com`
- `www.bot.alazab.com`

The public brand paths are:

- `bot.alazab.com/brand-identity`
- `bot.alazab.com/laban-alasfour`
- `bot.alazab.com/luxury-finishing`
- `bot.alazab.com/uberfix`

## 3. Run Preflight

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\production-preflight.ps1
```

Fix every `[FAIL]` before deployment.

## 4. Deploy

```powershell
docker compose --env-file .env.production -f docker-compose.prod.yaml up -d --build
```

## 5. Verify

```powershell
docker compose --env-file .env.production -f docker-compose.prod.yaml ps
Invoke-WebRequest https://bot.alazab.com/health -UseBasicParsing
```

## 6. Test Sites

Use the manual checklist:

- `docs/site-test-plan.md`

Use the local API smoke test before DNS cutover:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\smoke-test-sites.ps1 -BaseUrl http://127.0.0.1:8000
```

## 7. Register Telegram Webhook

After DNS and SSL are valid:

```powershell
bash scripts/register-telegram.sh
```

The expected webhook path is:

```text
https://bot.alazab.com/webhook/telegram
```

## 8. Logs

```powershell
docker compose --env-file .env.production -f docker-compose.prod.yaml logs -f webhook
docker compose --env-file .env.production -f docker-compose.prod.yaml logs -f rasa
docker compose --env-file .env.production -f docker-compose.prod.yaml logs -f rasa-actions
docker compose --env-file .env.production -f docker-compose.prod.yaml logs -f nginx
```
