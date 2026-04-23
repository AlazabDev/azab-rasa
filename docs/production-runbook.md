# Production Runbook - No Docker

This is the production path for the Alazab Rasa/AzaBot stack without Docker.

## 1. Services

- Rasa Actions: `127.0.0.1:5055`
- Rasa API: `127.0.0.1:5005`
- FastAPI Webhook + React frontend: `127.0.0.1:8000`
- Public traffic terminates at Nginx and proxies to `127.0.0.1:8000`
- PostgreSQL and Redis must be real external services, not Docker service names

## 2. Required Environment

Use the existing `.env` on the server and keep real secret values out of Git.

Required production variables:

- `RASA_PRO_LICENSE`
- `OPENAI_API_KEY`
- `ADMIN_API_KEY`
- `DB_HOST`
- `DB_PORT`
- `DB_NAME`
- `DB_USER`
- `DB_PASSWORD`
- `REDIS_HOST`
- `REDIS_PORT`
- `REDIS_PASSWORD`
- `ACTION_SERVER_URL=http://127.0.0.1:5055/webhook`
- `RASA_URL=http://127.0.0.1:5005`
- `UBERFIX_API_KEY`

Do not use these Docker service names in production:

```text
postgres
redis
rasa
rasa-actions
```

## 3. Deploy

From the project root on the server:

```bash
git pull --ff-only origin main
bash scripts/deploy-server-nodocker.sh --branch main --configure-nginx --domain bot.alazab.com
```

If the schema already exists and you intentionally want to skip DB installation:

```bash
bash scripts/deploy-server-nodocker.sh --branch main --skip-db --configure-nginx --domain bot.alazab.com
```

## 4. Database Only

Linux server:

```bash
bash scripts/install-uberfix-db.sh --env-file .env
```

Windows/local test:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\install-uberfix-db.ps1 -EnvFile .env
```

The database script creates or updates:

- `api_consumers`
- `api_gateway_logs`
- `audit_logs`
- `bot_sessions`
- `branches`
- `maintenance_categories`
- `maintenance_requests`
- `maintenance_request_notes`
- `maintenance_technicians`
- `outbound_messages`

## 5. Verify

Server health:

```bash
curl -fsS http://127.0.0.1:5005/
curl -fsS http://127.0.0.1:8000/health
curl -fsS http://127.0.0.1:8000/
```

UberFix bot-gateway services:

```bash
curl -fsS -X POST http://127.0.0.1:8000/uberfix/bot-gateway \
  -H "Content-Type: application/json" \
  -H "x-api-key: $UBERFIX_API_KEY" \
  -d '{"action":"list_services","payload":{}}'
```

Create a maintenance request:

```bash
curl -fsS -X POST http://127.0.0.1:8000/uberfix/bot-gateway \
  -H "Content-Type: application/json" \
  -H "x-api-key: $UBERFIX_API_KEY" \
  -d '{
    "action": "create_request",
    "payload": {
      "client_name": "Production Test",
      "client_phone": "01000000000",
      "location": "test",
      "service_type": "electrical",
      "description": "production smoke test",
      "priority": "medium"
    },
    "session_id": "prod_smoke_test",
    "metadata": {"source": "azabot", "locale": "ar"}
  }'
```

Check status:

```bash
curl -fsS -X POST http://127.0.0.1:8000/uberfix/bot-gateway \
  -H "Content-Type: application/json" \
  -H "x-api-key: $UBERFIX_API_KEY" \
  -d '{"action":"check_status","payload":{"search_term":"MR-26-01046","search_type":"request_number"}}'
```

## 6. Logs

```bash
sudo systemctl status alazab-rasa-actions --no-pager
sudo systemctl status alazab-rasa-rasa --no-pager
sudo systemctl status alazab-rasa-webhook --no-pager
sudo journalctl -u alazab-rasa-webhook -f
sudo journalctl -u alazab-rasa-rasa -f
sudo journalctl -u alazab-rasa-actions -f
```

Gateway logs in PostgreSQL:

```sql
SELECT action, status_code, success, duration_ms, created_at
FROM api_gateway_logs
ORDER BY created_at DESC
LIMIT 50;
```

## 7. Security Checks

Run these from the project root before pushing a release:

```bash
python -m py_compile webhook/server.py actions/brand_actions/uberfix.py
pnpm --dir azabot lint
pnpm --dir azabot test
pnpm --dir azabot build
snyk test --all-projects --detection-depth=3 --skip-unresolved
```

Use `--detection-depth=3` so Snyk scans the real project manifests and does not scan generated virtualenv internals.
