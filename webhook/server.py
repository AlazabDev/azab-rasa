"""
webhook/server.py — Central Webhook Server v3.0
=================================================
مجموعة العزب | Alazab Group Chatbot

ويب هوك مركزي يوحّد جميع قنوات التواصل في نقطة دخول واحدة:

  ┌──────────────────────────────────────────────┐
  │           INCOMING CHANNELS                  │
  │  Website · WhatsApp · Messenger · Telegram   │
  └─────────────────┬────────────────────────────┘
                    │
             ┌──────▼──────┐
             │   CENTRAL   │
             │   WEBHOOK   │
             └──────┬──────┘
                    │
       ┌────────────▼────────────┐
       │       RASA PRO          │
       └────────────┬────────────┘
                    │
       ┌────────────▼────────────┐
       │    OUTGOING CHANNELS    │
       │  نفس قناة المستخدم     │
       └─────────────────────────┘

Endpoints:
  GET  /health              ← صحة جميع الخدمات + القنوات المفعلة
  GET  /brands              ← قائمة البراندات
  POST /chat                ← محادثة مباشرة (موقع / تطبيق)
  POST /lead                ← بيانات عميل من Rasa
  GET  /webhook/meta        ← التحقق من Meta
  POST /webhook/meta        ← رسائل WhatsApp + Messenger
  POST /webhook/telegram    ← رسائل Telegram
  GET  /admin/stats         ← إحصائيات الرسائل لكل قناة
"""

from __future__ import annotations

import hashlib
import hmac
import logging
import os
import re
import time
from collections import defaultdict
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Optional
from urllib.parse import urlparse

import httpx
from fastapi import (
    BackgroundTasks,
    Depends,
    FastAPI,
    File,
    Form,
    HTTPException,
    Query,
    Request,
    UploadFile,
)
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import PlainTextResponse
from fastapi.staticfiles import StaticFiles
from openai import AsyncOpenAI
from pydantic import BaseModel, field_validator

# ══════════════════════════════════════════════════════════════
#  Logging
# ══════════════════════════════════════════════════════════════
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger("alazab.webhook")

# ══════════════════════════════════════════════════════════════
#  App
# ══════════════════════════════════════════════════════════════
app = FastAPI(
    title="Alazab Group — Central Webhook",
    description="ويب هوك مركزي: WhatsApp · Messenger · Telegram · Website",
    version="3.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
)

BASE_DIR = Path(__file__).resolve().parent
STATIC_DIR = BASE_DIR / "static"
UPLOADS_DIR = STATIC_DIR / "uploads"
UPLOADS_DIR.mkdir(parents=True, exist_ok=True)

PUBLIC_BASE_URL = os.getenv("PUBLIC_BASE_URL", "https://chat.alazab.com").rstrip("/")
MAX_UPLOAD_BYTES = int(os.getenv("MAX_UPLOAD_BYTES", str(12 * 1024 * 1024)))
ALLOWED_FILE_EXTENSIONS = {
    ".pdf", ".doc", ".docx", ".xls", ".xlsx", ".ppt", ".pptx",
    ".jpg", ".jpeg", ".png", ".webp", ".gif", ".txt", ".csv", ".zip",
}
AUDIO_FILE_EXTENSIONS = {".mp3", ".wav", ".ogg", ".m4a", ".webm", ".aac", ".mp4"}
AUDIO_TRANSCRIPTION_MODEL = os.getenv("AUDIO_TRANSCRIPTION_MODEL", "gpt-4o-mini-transcribe")

SITE_BRAND_MAP = {
    "alazab.com": "alazab_construction",
    "www.alazab.com": "alazab_construction",
    "brand-identity.alazab.com": "brand_identity",
    "laban-alasfour.alazab.com": "laban_alasfour",
    "luxury-finishing.alazab.com": "luxury_finishing",
    "uberfix.alazab.com": "uberfix",
}

ALLOWED_ORIGINS = os.getenv(
    "ALLOWED_ORIGINS",
    (
        "https://alazab.com,"
        "https://www.alazab.com,"
        "https://brand-identity.alazab.com,"
        "https://laban-alasfour.alazab.com,"
        "https://luxury-finishing.alazab.com,"
        "https://uberfix.alazab.com,"
        "https://chat.alazab.com,"
        "http://localhost:3000"
    ),
).split(",")

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.mount("/uploads", StaticFiles(directory=str(UPLOADS_DIR)), name="uploads")

# ══════════════════════════════════════════════════════════════
#  Config
# ══════════════════════════════════════════════════════════════
RASA_URL       = os.getenv("RASA_URL",             "http://rasa:5005")

# Meta (WhatsApp + Messenger)
META_VERIFY    = os.getenv("FB_VERIFY_TOKEN",      "alazab_verify_2025")
META_SECRET    = os.getenv("FB_APP_SECRET",        "")
META_TOKEN     = os.getenv("FB_PAGE_ACCESS_TOKEN", "")
WA_URL         = os.getenv("WHATSAPP_API_URL",     "")
WA_TOKEN       = os.getenv("WHATSAPP_TOKEN",       "")

# Telegram
TG_TOKEN       = os.getenv("TELEGRAM_BOT_TOKEN",   "")
TG_API_BASE    = f"https://api.telegram.org/bot{TG_TOKEN}"

# Admin
ADMIN_API_KEY  = os.getenv("ADMIN_API_KEY",        "")

# Notifications
NOTIFY_PHONE   = os.getenv("NOTIFY_PHONE",         "")
NOTIFY_TG_CHAT = os.getenv("NOTIFY_TG_CHAT_ID",   "")
WEBHOOK_NOTIFY = os.getenv("WEBHOOK_NOTIFY_URL",   "")

# ══════════════════════════════════════════════════════════════
#  Stats
# ══════════════════════════════════════════════════════════════
_stats: dict[str, int] = defaultdict(int)
_start_time = time.time()


def _count(channel: str) -> None:
    _stats[channel] += 1


# ══════════════════════════════════════════════════════════════
#  Pydantic Models
# ══════════════════════════════════════════════════════════════
class ChatRequest(BaseModel):
    message:   str
    sender_id: str
    brand:     Optional[str] = None
    channel:   Optional[str] = "website"
    site_host: Optional[str] = None

    @field_validator("message")
    @classmethod
    def message_not_empty(cls, v: str) -> str:
        if not v.strip():
            raise ValueError("الرسالة لا يمكن أن تكون فارغة")
        return v.strip()


class LeadData(BaseModel):
    brand:           str
    user_name:       str
    user_phone:      str
    user_message:    str
    conversation_id: Optional[str] = None
    channel:         Optional[str] = "unknown"


class ChatResponse(BaseModel):
    responses:  list
    sender_id:  str
    channel:    str
    timestamp:  str
    attachment: Optional[dict[str, Any]] = None
    transcript: Optional[str] = None


# ══════════════════════════════════════════════════════════════
#  SYSTEM ENDPOINTS
# ══════════════════════════════════════════════════════════════
@app.get("/health", tags=["System"])
async def health():
    """فحص صحة Rasa والقنوات المفعلة."""
    rasa_ok = False
    try:
        async with httpx.AsyncClient(timeout=3) as client:
            r = await client.get(f"{RASA_URL}/")
        rasa_ok = r.status_code == 200
    except Exception:
        pass

    return {
        "status": "ok" if rasa_ok else "degraded",
        "rasa":   "up" if rasa_ok else "down",
        "channels_active": {
            "website":   True,
            "whatsapp":  bool(WA_URL and WA_TOKEN),
            "messenger": bool(META_TOKEN),
            "telegram":  bool(TG_TOKEN),
        },
        "uptime_seconds": round(time.time() - _start_time),
        "timestamp":      datetime.now(timezone.utc).isoformat(),
    }


@app.get("/admin/stats", tags=["System"])
async def admin_stats(_: None = Depends(_require_admin)):
    """إحصائيات الرسائل لكل قناة منذ آخر تشغيل."""
    return {
        "message_counts": dict(_stats),
        "total":          sum(_stats.values()),
        "uptime_seconds": round(time.time() - _start_time),
        "timestamp":      datetime.now(timezone.utc).isoformat(),
    }


@app.get("/brands", tags=["Brands"])
async def get_brands():
    return {
        "brands": [
            {"id": "alazab_construction", "name": "Alazab Construction",
             "desc": "تنفيذ المشروعات المعمارية السكنية والتجارية",
             "color": "#1a56db", "icon": "🏗️"},
            {"id": "luxury_finishing", "name": "Luxury Finishing",
             "desc": "التشطيبات الراقية للوحدات السكنية والتجارية",
             "color": "#c27803", "icon": "✨"},
            {"id": "brand_identity", "name": "Brand Identity",
             "desc": "تجهيز وتنفيذ هوية العلامات التجارية",
             "color": "#7e3af2", "icon": "🎨"},
            {"id": "uberfix", "name": "UberFix",
             "desc": "منصة الصيانة والتشغيل الذكية",
             "color": "#057a55", "icon": "🔧"},
            {"id": "laban_alasfour", "name": "Laban Alasfour",
             "desc": "التوريدات العامة والخامات المعمارية",
             "color": "#e3a008", "icon": "🧱"},
        ]
    }


# ══════════════════════════════════════════════════════════════
#  CHAT — موقع / تطبيق
# ══════════════════════════════════════════════════════════════
@app.post("/chat", response_model=ChatResponse, tags=["Chat"])
async def chat(request: Request, payload: ChatRequest):
    """الواجهة الرئيسية للموقع والتطبيق — مزامنة."""
    channel = payload.channel or "website"
    site_host = payload.site_host or _extract_request_site_host(request)
    brand = _resolve_brand(payload.brand, site_host, request)

    _count(channel)
    responses = await _rasa_send(
        payload.sender_id,
        payload.message,
        brand,
        extra_metadata={"channel": channel, "site_host": site_host},
    )
    if not responses:
        responses = [{
            "text": (
                "تم استلام رسالتك بنجاح. إذا أردت، أرسل تفاصيل أكثر "
                "وسأتابع معك خطوة بخطوة."
            )
        }]
    return ChatResponse(
        responses=responses,
        sender_id=payload.sender_id,
        channel=channel,
        attachment=None,
        transcript=None,
        timestamp=datetime.now(timezone.utc).isoformat(),
    )


@app.post("/chat/upload", response_model=ChatResponse, tags=["Chat"])
async def chat_upload(
    request: Request,
    sender_id: str = Form(...),
    file: UploadFile = File(...),
    brand: Optional[str] = Form(default=None),
    channel: str = Form(default="website"),
    site_host: Optional[str] = Form(default=None),
):
    """استقبال ملفات من واجهة الموقع وتمرير وصفها للبوت."""
    if not sender_id.strip():
        raise HTTPException(status_code=422, detail="sender_id مطلوب")

    resolved_site_host = site_host or _extract_request_site_host(request)
    resolved_brand = _resolve_brand(brand, resolved_site_host, request)
    attachment = await _save_upload(file, ALLOWED_FILE_EXTENSIONS, kind="file")

    _count(channel)
    public_attachment = _serialize_attachment(attachment)

    responses = await _rasa_send(
        sender_id.strip(),
        _build_file_prompt(public_attachment, resolved_brand, resolved_site_host),
        resolved_brand,
        extra_metadata={
            "channel": channel,
            "site_host": resolved_site_host,
            "attachment": public_attachment,
        },
    )
    if not responses:
        responses = [{
            "text": (
                "تم استلام الملف بنجاح. إذا أردت، اكتب لي ما المطلوب تنفيذه عليه "
                "أو أضف أي تفاصيل إضافية مرتبطة به."
            )
        }]
    return ChatResponse(
        responses=responses,
        sender_id=sender_id.strip(),
        channel=channel,
        timestamp=datetime.now(timezone.utc).isoformat(),
        attachment=public_attachment,
        transcript=None,
    )


@app.post("/chat/audio", response_model=ChatResponse, tags=["Chat"])
async def chat_audio(
    request: Request,
    sender_id: str = Form(...),
    file: UploadFile = File(...),
    brand: Optional[str] = Form(default=None),
    channel: str = Form(default="website"),
    site_host: Optional[str] = Form(default=None),
):
    """استقبال ملاحظات صوتية من الواجهة مع نسخها نصيًا إن أمكن."""
    if not sender_id.strip():
        raise HTTPException(status_code=422, detail="sender_id مطلوب")

    resolved_site_host = site_host or _extract_request_site_host(request)
    resolved_brand = _resolve_brand(brand, resolved_site_host, request)
    attachment = await _save_upload(file, AUDIO_FILE_EXTENSIONS, kind="audio")
    transcript = await _transcribe_audio(attachment["path"])
    public_attachment = _serialize_attachment(attachment)

    _count(channel)
    if transcript:
        responses = await _rasa_send(
            sender_id.strip(),
            _build_audio_prompt(transcript, public_attachment, resolved_brand, resolved_site_host),
            resolved_brand,
            extra_metadata={
                "channel": channel,
                "site_host": resolved_site_host,
                "audio_attachment": public_attachment,
                "audio_transcript": transcript,
            },
        )
        if not responses:
            responses = [{
                "text": (
                    "تم استلام الملاحظة الصوتية وتفريغها نصيًا بنجاح.\n"
                    f"النص: {transcript}"
                )
            }]
    else:
        responses = [{
            "text": (
                "تم استلام الملاحظة الصوتية بنجاح. "
                "لتفعيل فهم الرسائل الصوتية والرد عليها تلقائيًا، اضبط `OPENAI_API_KEY` صالحًا على الخادم."
            )
        }]

    return ChatResponse(
        responses=responses,
        sender_id=sender_id.strip(),
        channel=channel,
        timestamp=datetime.now(timezone.utc).isoformat(),
        attachment=public_attachment,
        transcript=transcript,
    )


# ══════════════════════════════════════════════════════════════
#  LEADS
# ══════════════════════════════════════════════════════════════
@app.post("/lead", tags=["Leads"])
async def receive_lead(lead: LeadData, background_tasks: BackgroundTasks):
    """يستقبل بيانات عميل جديد ويُشعر الفريق عبر جميع القنوات."""
    logger.info(f"New lead | brand={lead.brand} | phone={lead.user_phone} | ch={lead.channel}")
    background_tasks.add_task(_notify_all_channels, lead)
    return {"status": "received", "timestamp": datetime.now(timezone.utc).isoformat()}


# ══════════════════════════════════════════════════════════════
#  META WEBHOOK — WhatsApp + Messenger
# ══════════════════════════════════════════════════════════════
@app.get("/webhook/meta", tags=["Meta"])
async def meta_verify(
    hub_mode: Optional[str] = Query(default=None, alias="hub.mode"),
    hub_verify_token: Optional[str] = Query(default=None, alias="hub.verify_token"),
    hub_challenge: Optional[str] = Query(default=None, alias="hub.challenge"),
):
    if hub_mode == "subscribe" and hub_verify_token == META_VERIFY:
        logger.info("Meta webhook verified ✓")
        return PlainTextResponse(hub_challenge)
    raise HTTPException(status_code=403, detail="Meta verification failed")


@app.post("/webhook/meta", tags=["Meta"])
async def meta_messages(request: Request, background_tasks: BackgroundTasks):
    """رسائل WhatsApp + Messenger الواردة."""
    body = await request.body()
    sig  = request.headers.get("X-Hub-Signature-256", "")

    if META_SECRET and not _verify_meta_signature(body, sig):
        raise HTTPException(status_code=403, detail="Invalid Meta signature")

    data = await request.json()

    for entry in data.get("entry", []):
        # WhatsApp
        for change in entry.get("changes", []):
            for msg in change.get("value", {}).get("messages", []):
                wa_id = msg.get("from")
                text  = msg.get("text", {}).get("body", "")
                if wa_id and text:
                    _count("whatsapp")
                    background_tasks.add_task(_handle_whatsapp, wa_id, text)

        # Messenger
        for messaging in entry.get("messaging", []):
            sender_id = messaging.get("sender", {}).get("id")
            text      = messaging.get("message", {}).get("text", "")
            if sender_id and text:
                _count("messenger")
                background_tasks.add_task(_handle_messenger, sender_id, text)

    return {"status": "ok"}


# ══════════════════════════════════════════════════════════════
#  TELEGRAM WEBHOOK
# ══════════════════════════════════════════════════════════════
@app.post("/webhook/telegram", tags=["Telegram"])
async def telegram_messages(request: Request, background_tasks: BackgroundTasks):
    """
    رسائل Telegram الواردة.
    يُسجَّل عبر:
      POST https://api.telegram.org/bot{TOKEN}/setWebhook
        ?url=https://chat.alazab.com/webhook/telegram
    """
    data    = await request.json()
    message = data.get("message") or data.get("edited_message")
    if not message:
        return {"status": "ok"}

    chat_id = message.get("chat", {}).get("id")
    text    = message.get("text", "")

    if not chat_id or not text:
        return {"status": "ok"}

    # أوامر البوت
    if text == "/start":
        background_tasks.add_task(
            _send_telegram, chat_id,
            "👋 أهلاً بك في مجموعة العزب!\n\n"
            "أنا مساعدك الذكي، يمكنني مساعدتك في:\n"
            "🏗️ Alazab Construction\n"
            "✨ Luxury Finishing\n"
            "🎨 Brand Identity\n"
            "🔧 UberFix\n"
            "🧱 Laban Alasfour\n\n"
            "تفضل، اكتب سؤالك!"
        )
        return {"status": "ok"}

    if text == "/help":
        background_tasks.add_task(
            _send_telegram, chat_id,
            "💡 *أمثلة:*\n\n"
            "• ما خدمات الإنشاء؟\n"
            "• أريد عرض سعر تشطيب\n"
            "• أحتاج صيانة عاجلة\n"
            "• طلب خامات بناء بالجملة\n"
            "• التحدث مع موظف"
        )
        return {"status": "ok"}

    # رسالة عادية → Rasa
    _count("telegram")
    background_tasks.add_task(_handle_telegram, chat_id, text)
    return {"status": "ok"}


# ══════════════════════════════════════════════════════════════
#  HANDLERS
# ══════════════════════════════════════════════════════════════
async def _handle_whatsapp(wa_id: str, text: str) -> None:
    try:
        responses = await _rasa_send(f"wa_{wa_id}", text)
        for resp in responses:
            reply = resp.get("text", "")
            if reply:
                await _send_whatsapp(wa_id, reply)
    except Exception as e:
        logger.error(f"WhatsApp handler error: {e}")
        await _send_whatsapp(wa_id, "عذرًا، حدث خطأ. يرجى المحاولة لاحقًا.")


async def _handle_messenger(sender_id: str, text: str) -> None:
    try:
        responses = await _rasa_send(f"fb_{sender_id}", text)
        for resp in responses:
            reply = resp.get("text", "")
            if reply:
                await _send_messenger(sender_id, reply)
    except Exception as e:
        logger.error(f"Messenger handler error: {e}")


async def _handle_telegram(chat_id: int, text: str) -> None:
    try:
        responses = await _rasa_send(f"tg_{chat_id}", text)
        for resp in responses:
            reply = resp.get("text", "")
            if reply:
                await _send_telegram(chat_id, reply)
    except Exception as e:
        logger.error(f"Telegram handler error: {e}")
        await _send_telegram(chat_id, "عذرًا، حدث خطأ. يرجى المحاولة لاحقًا.")


# ══════════════════════════════════════════════════════════════
#  NOTIFICATIONS — إشعارات الفريق
# ══════════════════════════════════════════════════════════════
async def _notify_all_channels(lead: LeadData) -> None:
    """يُرسل إشعار عميل جديد عبر كل القنوات المفعلة."""
    msg = (
        f"🔔 *عميل جديد — {lead.brand}*\n"
        f"الاسم: {lead.user_name}\n"
        f"الهاتف: {lead.user_phone}\n"
        f"الطلب: {lead.user_message}\n"
        f"القناة: {lead.channel}\n"
        f"المحادثة: {lead.conversation_id or 'غير محدد'}"
    )

    # WhatsApp
    if NOTIFY_PHONE and WA_URL and WA_TOKEN:
        await _send_whatsapp(NOTIFY_PHONE, msg)

    # Telegram
    if NOTIFY_TG_CHAT and TG_TOKEN:
        await _send_telegram(int(NOTIFY_TG_CHAT), msg)

    # CRM Webhook
    if WEBHOOK_NOTIFY:
        try:
            async with httpx.AsyncClient(timeout=8) as client:
                await client.post(WEBHOOK_NOTIFY, json={
                    "brand":           lead.brand,
                    "user_name":       lead.user_name,
                    "user_phone":      lead.user_phone,
                    "user_message":    lead.user_message,
                    "channel":         lead.channel,
                    "conversation_id": lead.conversation_id,
                    "timestamp":       datetime.now(timezone.utc).isoformat(),
                })
        except Exception as e:
            logger.error(f"CRM webhook error: {e}")


# ══════════════════════════════════════════════════════════════
#  RASA
# ══════════════════════════════════════════════════════════════
async def _rasa_send(
    sender_id: str,
    text: str,
    brand: Optional[str] = None,
    extra_metadata: Optional[dict[str, Any]] = None,
) -> list:
    payload: dict[str, Any] = {"sender": sender_id, "message": text}
    metadata: dict[str, Any] = {}
    if brand:
        metadata["brand"] = brand
    if extra_metadata:
        metadata.update({k: v for k, v in extra_metadata.items() if v is not None})
    if metadata:
        payload["metadata"] = metadata

    try:
        async with httpx.AsyncClient(timeout=12) as client:
            r = await client.post(
                f"{RASA_URL}/webhooks/rest/webhook",
                json=payload,
            )
            r.raise_for_status()
            return r.json()
    except httpx.TimeoutException:
        logger.error(f"Rasa timeout | sender={sender_id}")
        raise HTTPException(status_code=504, detail="انتهت مهلة الاتصال بالبوت")
    except Exception as e:
        logger.error(f"Rasa error | {e}")
        raise HTTPException(status_code=502, detail="خطأ في الاتصال بالبوت")


# ══════════════════════════════════════════════════════════════
#  SENDERS
# ══════════════════════════════════════════════════════════════
async def _send_whatsapp(to: str, text: str) -> bool:
    if not (WA_URL and WA_TOKEN):
        return False
    try:
        async with httpx.AsyncClient(timeout=8) as client:
            r = await client.post(
                WA_URL,
                headers={"Authorization": f"Bearer {WA_TOKEN}"},
                json={
                    "messaging_product": "whatsapp",
                    "to": to, "type": "text",
                    "text": {"body": text},
                },
            )
            return r.status_code == 200
    except Exception as e:
        logger.error(f"WhatsApp send error: {e}")
        return False


async def _send_messenger(to: str, text: str) -> bool:
    if not META_TOKEN:
        return False
    try:
        async with httpx.AsyncClient(timeout=8) as client:
            r = await client.post(
                "https://graph.facebook.com/v18.0/me/messages",
                params={"access_token": META_TOKEN},
                json={"recipient": {"id": to}, "message": {"text": text}},
            )
            return r.status_code == 200
    except Exception as e:
        logger.error(f"Messenger send error: {e}")
        return False


async def _send_telegram(chat_id: int, text: str) -> bool:
    if not TG_TOKEN:
        return False
    try:
        async with httpx.AsyncClient(timeout=8) as client:
            r = await client.post(
                f"{TG_API_BASE}/sendMessage",
                json={"chat_id": chat_id, "text": text, "parse_mode": "Markdown"},
            )
            return r.status_code == 200
    except Exception as e:
        logger.error(f"Telegram send error: {e}")
        return False


# ══════════════════════════════════════════════════════════════
#  UTILITIES
# ══════════════════════════════════════════════════════════════
def _verify_meta_signature(body: bytes, signature: str) -> bool:
    if not META_SECRET:
        return True
    expected = "sha256=" + hmac.new(
        META_SECRET.encode(), body, hashlib.sha256
    ).hexdigest()
    return hmac.compare_digest(expected, signature)



def _require_admin(request: Request) -> None:
    if not ADMIN_API_KEY:
        return

    token = request.headers.get("X-Admin-Token") or ""
    if hmac.compare_digest(token, ADMIN_API_KEY):
        return

    raise HTTPException(status_code=401, detail="Admin token required")
def _extract_hostname(value: Optional[str]) -> Optional[str]:
    if not value:
        return None
    first_value = value.split(",")[0].strip()
    if not first_value:
        return None
    parsed = urlparse(first_value if "://" in first_value else f"https://{first_value}")
    hostname = parsed.hostname or parsed.path
    return hostname.lower() if hostname else None


def _extract_request_site_host(request: Request) -> Optional[str]:
    for header_name in ("origin", "referer", "x-forwarded-host", "host"):
        hostname = _extract_hostname(request.headers.get(header_name))
        if hostname and hostname != "chat.alazab.com":
            return hostname
    return _extract_hostname(request.headers.get("host"))


def _resolve_brand(
    explicit_brand: Optional[str],
    site_host: Optional[str],
    request: Request,
) -> str:
    if explicit_brand:
        return explicit_brand

    for candidate in (
        site_host,
        _extract_request_site_host(request),
        _extract_hostname(request.headers.get("origin")),
        _extract_hostname(request.headers.get("referer")),
    ):
        if candidate and candidate in SITE_BRAND_MAP:
            return SITE_BRAND_MAP[candidate]

    return os.getenv("DEFAULT_BRAND", "alazab_construction")


async def _save_upload(
    upload: UploadFile,
    allowed_extensions: set[str],
    *,
    kind: str,
) -> dict[str, Any]:
    original_name = upload.filename or f"{kind}.bin"
    safe_name = _sanitize_filename(original_name)
    extension = Path(safe_name).suffix.lower()

    if extension not in allowed_extensions:
        raise HTTPException(status_code=415, detail="نوع الملف غير مدعوم")

    content = await upload.read()
    if not content:
        raise HTTPException(status_code=400, detail="الملف فارغ")
    if len(content) > MAX_UPLOAD_BYTES:
        raise HTTPException(status_code=413, detail="حجم الملف أكبر من المسموح")

    bucket = datetime.now(timezone.utc).strftime("%Y/%m")
    target_dir = UPLOADS_DIR / bucket
    target_dir.mkdir(parents=True, exist_ok=True)

    stamp = datetime.now(timezone.utc).strftime("%Y%m%d%H%M%S")
    target_name = f"{stamp}_{safe_name}"
    target_path = target_dir / target_name
    target_path.write_bytes(content)

    relative_url = f"/uploads/{bucket}/{target_name}"
    return {
        "kind": kind,
        "name": safe_name,
        "size": len(content),
        "content_type": upload.content_type or "application/octet-stream",
        "url": f"{PUBLIC_BASE_URL}{relative_url}",
        "path": str(target_path),
    }


async def _transcribe_audio(audio_path: str) -> Optional[str]:
    api_key = os.getenv("OPENAI_API_KEY", "").strip()
    organization = os.getenv("OPENAI_ORG_ID", "").strip() or None
    project = os.getenv("OPENAI_PROJECT_ID", "").strip() or None
    if not api_key or api_key.startswith("replace-with-"):
        return None

    try:
        client = AsyncOpenAI(
            api_key=api_key,
            organization=organization,
            project=project,
        )
        with open(audio_path, "rb") as audio_file:
            transcript = await client.audio.transcriptions.create(
                model=AUDIO_TRANSCRIPTION_MODEL,
                file=audio_file,
            )
        text = getattr(transcript, "text", None)
        if isinstance(text, str):
            text = text.strip()
            return text or None

        if isinstance(transcript, dict):
            dict_text = str(transcript.get("text", "")).strip()
            return dict_text or None

        return None
    except Exception as exc:
        logger.error("Audio transcription failed: %s", exc)
        return None


def _sanitize_filename(filename: str) -> str:
    cleaned = re.sub(r"[^A-Za-z0-9._-]+", "_", filename).strip("._")
    return cleaned or "upload.bin"


def _build_file_prompt(
    attachment: dict[str, Any],
    brand: Optional[str],
    site_host: Optional[str],
) -> str:
    return (
        "قام المستخدم برفع ملف جديد داخل محادثة الموقع.\n"
        f"البراند: {brand or 'غير محدد'}\n"
        f"الموقع: {site_host or 'غير محدد'}\n"
        f"اسم الملف: {attachment['name']}\n"
        f"نوع الملف: {attachment['content_type']}\n"
        f"رابط الملف: {attachment['url']}\n"
        "اشكر المستخدم وأخبره أن الملف وصل بنجاح، ثم اطلب منه أي تفاصيل إضافية يحتاجها."
    )


def _build_audio_prompt(
    transcript: str,
    attachment: dict[str, Any],
    brand: Optional[str],
    site_host: Optional[str],
) -> str:
    return (
        "هذه رسالة صوتية من المستخدم بعد تفريغها إلى نص.\n"
        f"البراند: {brand or 'غير محدد'}\n"
        f"الموقع: {site_host or 'غير محدد'}\n"
        f"رابط التسجيل: {attachment['url']}\n"
        f"النص المفرغ: {transcript}"
    )


def _serialize_attachment(attachment: dict[str, Any]) -> dict[str, Any]:
    return {k: v for k, v in attachment.items() if k != "path"}


