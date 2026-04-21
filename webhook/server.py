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
import json
import logging
import os
import re
import time
import uuid
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
from fastapi.responses import FileResponse, HTMLResponse, PlainTextResponse, Response
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
ROOT_DIR = BASE_DIR.parent
STATIC_DIR = BASE_DIR / "static"
UPLOADS_DIR = STATIC_DIR / "uploads"
FRONTEND_DIST_DIR = ROOT_DIR / "azabot-prod" / "dist"
FRONTEND_ASSETS_DIR = FRONTEND_DIST_DIR / "assets"
FRONTEND_EMBED_DIR = ROOT_DIR / "azabot-prod" / "embed"
ADMIN_DATA_FILE = ROOT_DIR / ".runtime" / "admin-data.json"
UPLOADS_DIR.mkdir(parents=True, exist_ok=True)
ADMIN_DATA_FILE.parent.mkdir(parents=True, exist_ok=True)

PUBLIC_BASE_URL = os.getenv("PUBLIC_BASE_URL", "https://bot.alazab.com").rstrip("/")
MAX_UPLOAD_BYTES = int(os.getenv("MAX_UPLOAD_BYTES", str(12 * 1024 * 1024)))
ALLOWED_FILE_EXTENSIONS = {
    ".pdf", ".doc", ".docx", ".xls", ".xlsx", ".ppt", ".pptx",
    ".jpg", ".jpeg", ".png", ".webp", ".gif", ".txt", ".csv", ".zip",
}
AUDIO_FILE_EXTENSIONS = {".mp3", ".wav", ".ogg", ".m4a", ".webm", ".aac", ".mp4"}
AUDIO_TRANSCRIPTION_MODEL = os.getenv("AUDIO_TRANSCRIPTION_MODEL", "gpt-4o-mini-transcribe")
AUDIO_TTS_MODEL = os.getenv("AUDIO_TTS_MODEL", "gpt-4o-mini-tts")
AUDIO_TTS_VOICE = os.getenv("AUDIO_TTS_VOICE", "alloy")

BRAND_PATH_MAP = {
    "/": "alazab_construction",
    "/luxury-finishing": "luxury_finishing",
    "/brand-identity": "brand_identity",
    "/uberfix": "uberfix",
    "/laban-alasfour": "laban_alasfour",
}

BRAND_PROFILES = {
    "alazab_construction": {
        "slug": "",
        "name": "Alazab Construction",
        "title": "عزبوت",
        "subtitle": "المساعد الذكي لمجموعة العزب",
    },
    "luxury_finishing": {
        "slug": "luxury-finishing",
        "name": "Luxury Finishing",
        "title": "لاكشري بوت",
        "subtitle": "مستشار التشطيبات الراقية",
    },
    "brand_identity": {
        "slug": "brand-identity",
        "name": "Brand Identity",
        "title": "براند بوت",
        "subtitle": "خبير الهوية البصرية وتجهيز العلامات",
    },
    "uberfix": {
        "slug": "uberfix",
        "name": "UberFix",
        "title": "فيكس بوت",
        "subtitle": "مستشار الصيانة والتشغيل",
    },
    "laban_alasfour": {
        "slug": "laban-alasfour",
        "name": "Laban Alasfour",
        "title": "لبن بوت",
        "subtitle": "مستشار التوريدات والخامات",
    },
}

SITE_BRAND_MAP = {
    "bot.alazab.com": "alazab_construction",
    "www.bot.alazab.com": "alazab_construction",
}

ALLOWED_ORIGINS = os.getenv(
    "ALLOWED_ORIGINS",
    (
        "https://bot.alazab.com,"
        "https://www.bot.alazab.com,"
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
if FRONTEND_ASSETS_DIR.exists():
    app.mount("/assets", StaticFiles(directory=str(FRONTEND_ASSETS_DIR)), name="frontend-assets")
if FRONTEND_EMBED_DIR.exists():
    app.mount("/embed", StaticFiles(directory=str(FRONTEND_EMBED_DIR)), name="frontend-embed")

# ══════════════════════════════════════════════════════════════
#  Config
# ══════════════════════════════════════════════════════════════
RASA_URL       = os.getenv("RASA_URL",             "http://rasa:5005")
RASA_REQUEST_TIMEOUT = float(os.getenv("RASA_REQUEST_TIMEOUT", "45"))

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

DEFAULT_ADMIN_DATA: dict[str, Any] = {
    "settings": {
        "bot_name": "AzaBot",
        "primary_color": "#d6a318",
        "position": "left",
        "welcome_message": "مرحباً! كيف يمكنني مساعدتك؟",
        "quick_replies": [
            "ما هي خدمات الشركة؟",
            "أريد عرض سعر تشطيب",
            "ما هي أسعار التشطيب؟",
            "كيف أتواصل معكم؟",
        ],
        "ai_model": "rasa-pro",
        "system_prompt": "Rasa Pro هو مصدر الردود الأساسي في هذا المشروع.",
        "voice_enabled": True,
        "auto_speak": False,
        "voice_name": "ar-SA",
        "business_hours_enabled": False,
        "business_hours": {"start": "09:00", "end": "18:00"},
        "offline_message": "وصلت رسالتك خارج ساعات العمل وسنرد عليك في أقرب وقت.",
    },
    "integrations": [],
    "logs": [],
    "conversations": [],
}


def _count(channel: str) -> None:
    _stats[channel] += 1


def _load_admin_data() -> dict[str, Any]:
    if not ADMIN_DATA_FILE.exists():
        return json.loads(json.dumps(DEFAULT_ADMIN_DATA))
    try:
        data = json.loads(ADMIN_DATA_FILE.read_text(encoding="utf-8"))
    except Exception:
        logger.exception("Failed to read admin data file")
        return json.loads(json.dumps(DEFAULT_ADMIN_DATA))
    merged = json.loads(json.dumps(DEFAULT_ADMIN_DATA))
    for key, value in data.items():
        merged[key] = value
    return merged


def _save_admin_data(data: dict[str, Any]) -> None:
    ADMIN_DATA_FILE.write_text(
        json.dumps(data, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )


async def _record_conversation(
    sender_id: str,
    user_text: str,
    responses: list[dict[str, Any]],
    *,
    channel: str,
    brand: Optional[str],
) -> None:
    data = _load_admin_data()
    conversations = data.setdefault("conversations", [])
    now = datetime.now(timezone.utc).isoformat()
    conv = next((item for item in conversations if item.get("session_id") == sender_id), None)
    is_new_conversation = conv is None
    if not conv:
        conv = {
            "id": str(uuid.uuid4()),
            "session_id": sender_id,
            "brand": brand,
            "channel": channel,
            "created_at": now,
            "last_message_at": now,
            "messages": [],
        }
        conversations.insert(0, conv)

    conv["last_message_at"] = now
    conv["brand"] = brand or conv.get("brand")
    conv["channel"] = channel or conv.get("channel")
    user_message = {
        "id": str(uuid.uuid4()),
        "role": "user",
        "content": user_text,
        "created_at": now,
    }
    conv.setdefault("messages", []).append(user_message)
    assistant_messages: list[dict[str, Any]] = []
    for response in responses:
        text = response.get("text") if isinstance(response, dict) else None
        if text:
            assistant_message = {
                "id": str(uuid.uuid4()),
                "role": "assistant",
                "content": text,
                "created_at": datetime.now(timezone.utc).isoformat(),
            }
            assistant_messages.append(assistant_message)
            conv["messages"].append(assistant_message)

    conv["message_count"] = len(conv.get("messages", []))
    data["conversations"] = conversations[:500]
    _save_admin_data(data)
    if is_new_conversation:
        await _dispatch_integrations(
            "conversation.started",
            {
                "conversation": _integration_conversation_payload(conv),
                "message": user_message,
                "responses": assistant_messages,
            },
        )
    await _dispatch_integrations(
        "message.created",
        {
            "conversation": _integration_conversation_payload(conv),
            "message": user_message,
            "responses": assistant_messages,
        },
    )


def _admin_stats_payload() -> dict[str, Any]:
    data = _load_admin_data()
    conversations = data.get("conversations", [])
    messages = sum(len(item.get("messages", [])) for item in conversations)
    today_prefix = datetime.now(timezone.utc).date().isoformat()
    return {
        "conversations": len(conversations),
        "messages": messages,
        "today": sum(
            1 for item in conversations
            if str(item.get("created_at", "")).startswith(today_prefix)
        ),
        "message_counts": dict(_stats),
        "total": sum(_stats.values()),
        "uptime_seconds": round(time.time() - _start_time),
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }


def _require_admin(request: Request) -> None:
    if not ADMIN_API_KEY:
        raise HTTPException(status_code=503, detail="ADMIN_API_KEY is not configured")

    token = request.headers.get("X-Admin-Token") or ""
    if hmac.compare_digest(token, ADMIN_API_KEY):
        return

    raise HTTPException(status_code=401, detail="Admin token required")


# ══════════════════════════════════════════════════════════════
#  Pydantic Models
# ══════════════════════════════════════════════════════════════
class ChatRequest(BaseModel):
    message:   str
    sender_id: str
    brand:     Optional[str] = None
    channel:   Optional[str] = "website"
    site_host: Optional[str] = None
    site_path: Optional[str] = None

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


class TTSRequest(BaseModel):
    text: str
    voice: Optional[str] = None
    model: Optional[str] = None

    @field_validator("text")
    @classmethod
    def text_not_empty(cls, v: str) -> str:
        value = v.strip()
        if not value:
            raise ValueError("text مطلوب")
        return value[:4000]


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
    return _admin_stats_payload()


@app.api_route("/admin/api", methods=["GET", "POST"], tags=["System"])
async def admin_api(request: Request, action: str, _: None = Depends(_require_admin)):
    data = _load_admin_data()
    body: dict[str, Any] = {}
    if request.method != "GET":
        try:
            parsed_body = await request.json()
            if isinstance(parsed_body, dict):
                body = parsed_body
        except Exception:
            body = {}

    if action == "stats":
        return _admin_stats_payload()

    if action == "get_settings":
        return data["settings"]

    if action == "update_settings":
        data["settings"] = {**data.get("settings", {}), **body}
        _save_admin_data(data)
        return data["settings"]

    if action == "list_conversations":
        q = (request.query_params.get("q") or "").strip().lower()
        conversations = data.get("conversations", [])
        if q:
            conversations = [
                item for item in conversations
                if q in str(item.get("session_id", "")).lower()
                or q in str(item.get("brand", "")).lower()
                or q in str(item.get("channel", "")).lower()
            ]
        return [
            {
                "id": item.get("id"),
                "session_id": item.get("session_id"),
                "brand": item.get("brand"),
                "channel": item.get("channel"),
                "message_count": len(item.get("messages", [])),
                "last_message_at": item.get("last_message_at") or item.get("created_at"),
            }
            for item in conversations
        ]

    if action == "get_conversation":
        conv_id = request.query_params.get("id")
        conv = next((item for item in data.get("conversations", []) if item.get("id") == conv_id), None)
        if not conv:
            raise HTTPException(status_code=404, detail="Conversation not found")
        return {**conv, "messages": conv.get("messages", [])}

    if action == "delete_conversation":
        conv_id = body.get("id")
        data["conversations"] = [
            item for item in data.get("conversations", [])
            if item.get("id") != conv_id
        ]
        _save_admin_data(data)
        return {"ok": True}

    if action == "list_integrations":
        return data.get("integrations", [])

    if action == "save_integration":
        integrations = data.setdefault("integrations", [])
        item = dict(body)
        if not item.get("id"):
            item["id"] = str(uuid.uuid4())
            item["created_at"] = datetime.now(timezone.utc).isoformat()
            integrations.insert(0, item)
        else:
            integrations[:] = [
                {**old, **item} if old.get("id") == item["id"] else old
                for old in integrations
            ]
        _save_admin_data(data)
        return item

    if action == "delete_integration":
        integration_id = body.get("id")
        data["integrations"] = [
            item for item in data.get("integrations", [])
            if item.get("id") != integration_id
        ]
        _save_admin_data(data)
        return {"ok": True}

    if action == "test_integration":
        integration_id = body.get("id")
        integration = next(
            (item for item in data.get("integrations", []) if item.get("id") == integration_id),
            None,
        )
        if not integration:
            raise HTTPException(status_code=404, detail="Integration not found")
        return await _test_integration(integration, data)

    if action == "list_logs":
        return data.get("logs", [])[:200]

    raise HTTPException(status_code=400, detail=f"Unsupported admin action: {action}")


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


@app.get("/", response_class=HTMLResponse, tags=["Widget"])
async def brand_home():
    return _frontend_response()


@app.get("/{brand_slug}", response_class=HTMLResponse, tags=["Widget"])
@app.get("/{brand_slug}/", response_class=HTMLResponse, include_in_schema=False)
async def brand_path(brand_slug: str):
    return _frontend_response(brand_slug)


# ══════════════════════════════════════════════════════════════
#  CHAT — موقع / تطبيق
# ══════════════════════════════════════════════════════════════
@app.post("/chat", response_model=ChatResponse, tags=["Chat"])
async def chat(request: Request, payload: ChatRequest):
    """الواجهة الرئيسية للموقع والتطبيق — مزامنة."""
    channel = payload.channel or "website"
    site_host = payload.site_host or _extract_request_site_host(request)
    site_path = payload.site_path or _extract_request_site_path(request)
    brand = _resolve_brand(payload.brand, site_host, site_path, request)

    _count(channel)
    responses = await _rasa_send(
        payload.sender_id,
        payload.message,
        brand,
        extra_metadata={"channel": channel, "site_host": site_host, "site_path": site_path},
    )
    if not responses:
        responses = [{
            "text": (
                "تم استلام رسالتك بنجاح. إذا أردت، أرسل تفاصيل أكثر "
                "وسأتابع معك خطوة بخطوة."
            )
        }]
    await _record_conversation(
        payload.sender_id,
        payload.message,
        responses,
        channel=channel,
        brand=brand,
    )
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
    message: Optional[str] = Form(default=None),
    brand: Optional[str] = Form(default=None),
    channel: str = Form(default="website"),
    site_host: Optional[str] = Form(default=None),
    site_path: Optional[str] = Form(default=None),
):
    """استقبال ملفات من واجهة الموقع وتمرير وصفها للبوت."""
    if not sender_id.strip():
        raise HTTPException(status_code=422, detail="sender_id مطلوب")

    resolved_site_host = site_host or _extract_request_site_host(request)
    resolved_site_path = site_path or _extract_request_site_path(request)
    resolved_brand = _resolve_brand(brand, resolved_site_host, resolved_site_path, request)
    attachment = await _save_upload(file, ALLOWED_FILE_EXTENSIONS, kind="file")

    _count(channel)
    public_attachment = _serialize_attachment(attachment)

    responses = await _rasa_send(
        sender_id.strip(),
        _build_file_prompt(public_attachment, resolved_brand, resolved_site_host, message),
        resolved_brand,
        extra_metadata={
            "channel": channel,
            "site_host": resolved_site_host,
            "site_path": resolved_site_path,
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
    await _record_conversation(
        sender_id.strip(),
        message.strip() if message and message.strip() else f"رفع ملف: {file.filename}",
        responses,
        channel=channel,
        brand=resolved_brand,
    )
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
    site_path: Optional[str] = Form(default=None),
):
    """استقبال ملاحظات صوتية من الواجهة مع نسخها نصيًا إن أمكن."""
    if not sender_id.strip():
        raise HTTPException(status_code=422, detail="sender_id مطلوب")

    resolved_site_host = site_host or _extract_request_site_host(request)
    resolved_site_path = site_path or _extract_request_site_path(request)
    resolved_brand = _resolve_brand(brand, resolved_site_host, resolved_site_path, request)
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
                "site_path": resolved_site_path,
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

    await _record_conversation(
        sender_id.strip(),
        transcript or f"رسالة صوتية: {file.filename}",
        responses,
        channel=channel,
        brand=resolved_brand,
    )
    return ChatResponse(
        responses=responses,
        sender_id=sender_id.strip(),
        channel=channel,
        timestamp=datetime.now(timezone.utc).isoformat(),
        attachment=public_attachment,
        transcript=transcript,
    )


@app.post("/chat/tts", tags=["Chat"])
async def chat_tts(payload: TTSRequest):
    """تحويل رد البوت النصي إلى ملف صوتي MP3 من الخادم."""
    audio = await _text_to_speech(payload.text, payload.voice, payload.model)
    return Response(
        content=audio,
        media_type="audio/mpeg",
        headers={
            "Cache-Control": "no-store",
            "Content-Disposition": 'inline; filename="azabot-reply.mp3"',
        },
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
        ?url=https://bot.alazab.com/webhook/telegram
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


@app.get("/{full_path:path}", response_class=HTMLResponse, include_in_schema=False)
async def spa_fallback(full_path: str):
    return _frontend_response(full_path)


# ══════════════════════════════════════════════════════════════
#  HANDLERS
# ══════════════════════════════════════════════════════════════
async def _handle_whatsapp(wa_id: str, text: str) -> None:
    try:
        responses = await _rasa_send(f"wa_{wa_id}", text)
        await _record_conversation(
            f"wa_{wa_id}",
            text,
            responses,
            channel="whatsapp",
            brand=None,
        )
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
        await _record_conversation(
            f"fb_{sender_id}",
            text,
            responses,
            channel="messenger",
            brand=None,
        )
        for resp in responses:
            reply = resp.get("text", "")
            if reply:
                await _send_messenger(sender_id, reply)
    except Exception as e:
        logger.error(f"Messenger handler error: {e}")


async def _handle_telegram(chat_id: int, text: str) -> None:
    try:
        responses = await _rasa_send(f"tg_{chat_id}", text)
        await _record_conversation(
            f"tg_{chat_id}",
            text,
            responses,
            channel="telegram",
            brand=None,
        )
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
        async with httpx.AsyncClient(timeout=RASA_REQUEST_TIMEOUT) as client:
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
def _integration_conversation_payload(conversation: dict[str, Any]) -> dict[str, Any]:
    return {
        "id": conversation.get("id"),
        "session_id": conversation.get("session_id"),
        "brand": conversation.get("brand"),
        "channel": conversation.get("channel"),
        "created_at": conversation.get("created_at"),
        "last_message_at": conversation.get("last_message_at"),
        "message_count": conversation.get("message_count", len(conversation.get("messages", []))),
    }


def _format_integration_message(event: str, payload: dict[str, Any]) -> str:
    conversation = payload.get("conversation", {}) if isinstance(payload.get("conversation"), dict) else {}
    message = payload.get("message", {}) if isinstance(payload.get("message"), dict) else {}
    responses = payload.get("responses", []) if isinstance(payload.get("responses"), list) else []
    response_text = "\n".join(
        str(item.get("content", "")).strip()
        for item in responses
        if isinstance(item, dict) and str(item.get("content", "")).strip()
    )
    lines = [
        f"AzaBot event: {event}",
        f"Channel: {conversation.get('channel') or '-'}",
        f"Brand: {conversation.get('brand') or '-'}",
        f"Session: {conversation.get('session_id') or '-'}",
        "",
        f"User: {message.get('content') or '-'}",
    ]
    if response_text:
        lines.extend(["", f"Bot: {response_text}"])
    return "\n".join(lines).strip()


async def _deliver_integration_event(
    integration: dict[str, Any],
    event: str,
    payload: dict[str, Any],
) -> dict[str, Any]:
    config = integration.get("config", {}) if isinstance(integration.get("config"), dict) else {}
    request_payload = {
        "event": event,
        "integration": {
            "id": integration.get("id"),
            "type": integration.get("type"),
            "name": integration.get("name"),
        },
        "data": payload,
        "sent_at": datetime.now(timezone.utc).isoformat(),
    }
    log_item = {
        "id": str(uuid.uuid4()),
        "integration_id": integration.get("id"),
        "integration_type": integration.get("type"),
        "event": event,
        "request_payload": request_payload,
        "status": "success",
        "status_code": None,
        "response_body": "",
        "error_message": "",
        "created_at": datetime.now(timezone.utc).isoformat(),
    }

    try:
        integration_type = integration.get("type")
        if integration_type == "webhook":
            url = str(config.get("url") or "").strip()
            if not url:
                raise ValueError("Webhook URL is required")
            headers = {"Content-Type": "application/json"}
            secret = str(config.get("secret") or "").strip()
            if secret:
                headers["X-AzaBot-Secret"] = secret
            async with httpx.AsyncClient(timeout=10) as client:
                response = await client.post(url, json=request_payload, headers=headers)

        elif integration_type == "telegram":
            bot_token = str(config.get("bot_token") or "").strip()
            chat_id = str(config.get("chat_id") or "").strip()
            if not bot_token or not chat_id:
                raise ValueError("Telegram bot_token and chat_id are required")
            async with httpx.AsyncClient(timeout=10) as client:
                response = await client.post(
                    f"https://api.telegram.org/bot{bot_token}/sendMessage",
                    json={"chat_id": chat_id, "text": _format_integration_message(event, payload)},
                )

        elif integration_type == "whatsapp":
            phone_number_id = str(config.get("phone_number_id") or "").strip()
            access_token = str(config.get("access_token") or "").strip()
            recipient = str(config.get("recipient") or "").strip()
            if not phone_number_id or not access_token or not recipient:
                raise ValueError("WhatsApp phone_number_id, access_token and recipient are required")
            async with httpx.AsyncClient(timeout=10) as client:
                response = await client.post(
                    f"https://graph.facebook.com/v20.0/{phone_number_id}/messages",
                    headers={"Authorization": f"Bearer {access_token}"},
                    json={
                        "messaging_product": "whatsapp",
                        "to": recipient,
                        "type": "text",
                        "text": {"body": _format_integration_message(event, payload)[:4000]},
                    },
                )

        elif integration_type == "twilio":
            account_sid = str(config.get("account_sid") or "").strip()
            auth_token = str(config.get("auth_token") or "").strip()
            from_number = str(config.get("from") or "").strip()
            to_number = str(config.get("to") or "").strip()
            if not account_sid or not auth_token or not from_number or not to_number:
                raise ValueError("Twilio account_sid, auth_token, from and to are required")
            async with httpx.AsyncClient(timeout=10) as client:
                response = await client.post(
                    f"https://api.twilio.com/2010-04-01/Accounts/{account_sid}/Messages.json",
                    data={
                        "From": from_number,
                        "To": to_number,
                        "Body": _format_integration_message(event, payload)[:1500],
                    },
                    auth=(account_sid, auth_token),
                )

        else:
            raise ValueError(f"Unsupported integration type: {integration_type}")

        log_item["status_code"] = response.status_code
        log_item["response_body"] = response.text[:2000]
        if response.status_code >= 400:
            log_item["status"] = "failed"
            log_item["error_message"] = response.text[:500]

    except Exception as exc:
        log_item["status"] = "failed"
        log_item["error_message"] = str(exc)

    return log_item


async def _dispatch_integrations(event: str, payload: dict[str, Any]) -> None:
    data = _load_admin_data()
    integrations = [
        item for item in data.get("integrations", [])
        if item.get("enabled") and event in (item.get("events") or [])
    ]
    if not integrations:
        return

    logs = data.setdefault("logs", [])
    for integration in integrations:
        log_item = await _deliver_integration_event(integration, event, payload)
        logs.insert(0, log_item)
    data["logs"] = logs[:200]
    _save_admin_data(data)


async def _test_integration(integration: dict[str, Any], data: dict[str, Any]) -> dict[str, Any]:
    event = "integration.test"
    payload = {
        "conversation": {
            "id": "test",
            "session_id": "integration-test",
            "brand": "test",
            "channel": "admin",
            "message_count": 1,
        },
        "message": {
            "id": "test-message",
            "role": "user",
            "content": "اختبار تكامل AzaBot",
            "created_at": datetime.now(timezone.utc).isoformat(),
        },
        "responses": [{
            "id": "test-response",
            "role": "assistant",
            "content": "هذه رسالة اختبار من لوحة تحكم AzaBot.",
            "created_at": datetime.now(timezone.utc).isoformat(),
        }],
    }
    log_item = await _deliver_integration_event(integration, event, payload)
    logs = data.setdefault("logs", [])
    logs.insert(0, log_item)
    data["logs"] = logs[:200]
    _save_admin_data(data)
    return {
        "status": "success" if log_item["status"] == "success" else "failed",
        "statusCode": log_item.get("status_code"),
        "errorMessage": log_item.get("error_message"),
    }


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
        if hostname and hostname != "bot.alazab.com":
            return hostname
    return _extract_hostname(request.headers.get("host"))


def _extract_path(value: Optional[str]) -> Optional[str]:
    if not value:
        return None
    first_value = value.split(",")[0].strip()
    if not first_value:
        return None
    parsed = urlparse(first_value if "://" in first_value else f"https://bot.alazab.com{first_value}")
    path = parsed.path or "/"
    return "/" + path.strip("/") if path != "/" else "/"


def _extract_request_site_path(request: Request) -> Optional[str]:
    for header_name in ("x-original-uri", "x-forwarded-uri", "referer"):
        path = _extract_path(request.headers.get(header_name))
        if path and path not in {"/chat", "/chat/upload", "/chat/audio"}:
            return path
    return None


def _resolve_brand(
    explicit_brand: Optional[str],
    site_host: Optional[str],
    site_path: Optional[str],
    request: Request,
) -> str:
    if explicit_brand in BRAND_PROFILES:
        return explicit_brand

    for candidate_path in (
        site_path,
        _extract_request_site_path(request),
        _extract_path(request.headers.get("referer")),
    ):
        if candidate_path:
            brand = BRAND_PATH_MAP.get(candidate_path.rstrip("/") or "/")
            if brand:
                return brand

    for candidate in (
        site_host,
        _extract_request_site_host(request),
        _extract_hostname(request.headers.get("origin")),
        _extract_hostname(request.headers.get("referer")),
    ):
        if candidate and candidate in SITE_BRAND_MAP:
            return SITE_BRAND_MAP[candidate]

    return os.getenv("DEFAULT_BRAND", "alazab_construction")


def _frontend_response(path: str = "") -> FileResponse:
    """Serve the built AzaBot React app and its top-level static assets."""
    safe_path = path.strip().lstrip("/")
    if safe_path and "/" not in safe_path:
        static_file = FRONTEND_DIST_DIR / safe_path
        if static_file.is_file():
            return FileResponse(static_file)

    index_file = FRONTEND_DIST_DIR / "index.html"
    if not index_file.is_file():
        raise HTTPException(
            status_code=503,
            detail="Frontend build is missing. Run `pnpm install` and `pnpm build` inside azabot-prod.",
        )
    return FileResponse(index_file)


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


async def _text_to_speech(text: str, voice: Optional[str], model: Optional[str]) -> bytes:
    api_key = os.getenv("OPENAI_API_KEY", "").strip()
    organization = os.getenv("OPENAI_ORG_ID", "").strip() or None
    project = os.getenv("OPENAI_PROJECT_ID", "").strip() or None
    if not api_key or api_key.startswith("replace-with-"):
        raise HTTPException(status_code=503, detail="OPENAI_API_KEY is not configured")

    selected_voice = (voice or AUDIO_TTS_VOICE).strip() or AUDIO_TTS_VOICE
    selected_model = (model or AUDIO_TTS_MODEL).strip() or AUDIO_TTS_MODEL

    try:
        client = AsyncOpenAI(
            api_key=api_key,
            organization=organization,
            project=project,
        )
        speech = await client.audio.speech.create(
            model=selected_model,
            voice=selected_voice,
            input=text.strip()[:4000],
            response_format="mp3",
        )
        if hasattr(speech, "aread"):
            return await speech.aread()
        if hasattr(speech, "content"):
            return speech.content
        return speech.read()
    except HTTPException:
        raise
    except Exception as exc:
        logger.error("Text-to-speech failed: %s", exc)
        raise HTTPException(status_code=502, detail="فشل تحويل النص إلى صوت")


def _sanitize_filename(filename: str) -> str:
    cleaned = re.sub(r"[^A-Za-z0-9._-]+", "_", filename).strip("._")
    return cleaned or "upload.bin"


def _build_file_prompt(
    attachment: dict[str, Any],
    brand: Optional[str],
    site_host: Optional[str],
    message: Optional[str] = None,
) -> str:
    user_note = f"رسالة المستخدم المصاحبة: {message.strip()}\n" if message and message.strip() else ""
    return (
        "قام المستخدم برفع ملف جديد داخل محادثة الموقع.\n"
        f"البراند: {brand or 'غير محدد'}\n"
        f"الموقع: {site_host or 'غير محدد'}\n"
        f"اسم الملف: {attachment['name']}\n"
        f"نوع الملف: {attachment['content_type']}\n"
        f"رابط الملف: {attachment['url']}\n"
        f"{user_note}"
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

