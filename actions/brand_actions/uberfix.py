"""
actions/brand_actions/uberfix.py
==================================
أوامر مخصصة لـ UberFix — منصة الصيانة الذكية
"""

import logging
import os
import re
from typing import Any, Text, Dict, List
from urllib.parse import quote

from rasa_sdk import Action, Tracker
from rasa_sdk.executor import CollectingDispatcher
from rasa_sdk.events import SlotSet
from rasa_sdk.types import DomainDict

logger = logging.getLogger(__name__)

UBERFIX_API_URL = os.getenv("UBERFIX_API_URL", "")
UBERFIX_API_KEY = os.getenv("UBERFIX_API_KEY", "")
UBERFIX_BOT_GATEWAY_URL = os.getenv("UBERFIX_BOT_GATEWAY_URL", "")
UBERFIX_TRACK_BASE_URL = os.getenv("UBERFIX_TRACK_BASE_URL", "https://uberfix.shop/track").rstrip("/")
UBERFIX_STATUS_API_URL = os.getenv("UBERFIX_STATUS_API_URL", "").rstrip("/")


class ActionUberfixCreateRequest(Action):
    """ينشئ طلب صيانة جديد في نظام UberFix."""

    def name(self) -> Text:
        return "action_uberfix_create_request"

    def run(
        self,
        dispatcher: CollectingDispatcher,
        tracker: Tracker,
        domain: DomainDict,
    ) -> List[Dict[Text, Any]]:

        user_name    = tracker.get_slot("user_name") or "عميل"
        user_phone   = tracker.get_slot("user_phone") or ""
        user_message = tracker.get_slot("user_message") or ""

        order_id = _create_uberfix_order(user_name, user_phone, user_message)

        if order_id:
            dispatcher.utter_message(
                text=(
                    f"✅ تم تسجيل طلب الصيانة بنجاح!\n"
                    f"رقم طلبك: *{order_id}*\n"
                    f"سيتواصل معك الفني في أقرب وقت. 🔧"
                )
            )
        else:
            dispatcher.utter_message(
                text=(
                    "✅ وصل طلبك! سنتواصل معك على رقمك خلال أقل من ساعة "
                    "لتأكيد موعد الفني. 🔧"
                )
            )

        return [SlotSet("brand", "UberFix")]


class ActionUberfixTrackRequest(Action):
    """يتحقق من حالة طلب صيانة قائم."""

    def name(self) -> Text:
        return "action_uberfix_track_request"

    def run(
        self,
        dispatcher: CollectingDispatcher,
        tracker: Tracker,
        domain: DomainDict,
    ) -> List[Dict[Text, Any]]:

        last_msg = tracker.latest_message.get("text", "")
        order_id = _extract_uberfix_request_number(last_msg)

        if order_id:
            status = _get_uberfix_status(order_id)
            dispatcher.utter_message(text=f"📋 طلب *{order_id}*: {status}")
        else:
            dispatcher.utter_message(
                text=(
                    "من فضلك أرسل رقم الطلب الذي وصلك في رسالة التأكيد "
                    "وسأتحقق من حالته فورًا."
                )
            )

        return []


class ActionUberfixShowSubscriptions(Action):
    """يعرض باقات الاشتراك السنوية."""

    def name(self) -> Text:
        return "action_uberfix_show_subscriptions"

    def run(
        self,
        dispatcher: CollectingDispatcher,
        tracker: Tracker,
        domain: DomainDict,
    ) -> List[Dict[Text, Any]]:

        plans = [
            {
                "name":     "🥉 باقة أساسية",
                "visits":   4,
                "priority": False,
                "desc":     "مناسبة للمنازل والوحدات الصغيرة",
            },
            {
                "name":     "🥈 باقة متقدمة",
                "visits":   8,
                "priority": True,
                "desc":     "مناسبة للمحلات والمكاتب",
            },
            {
                "name":     "🥇 باقة بريميوم",
                "visits":   12,
                "priority": True,
                "desc":     "مناسبة للمنشآت الكبيرة والمصانع",
            },
        ]

        text = "🔧 *باقات UberFix السنوية:*\n\n"
        for p in plans:
            priority_txt = "✅ أولوية" if p["priority"] else "—"
            text += (
                f"{p['name']}\n"
                f"  زيارات: {p['visits']} × سنويًا | أولوية: {priority_txt}\n"
                f"  {p['desc']}\n\n"
            )
        text += "للاشتراك أو الاستفسار عن الأسعار، تواصل معنا الآن."

        dispatcher.utter_message(text=text)
        return [SlotSet("brand", "UberFix")]


# ──────────────────────────────────────────────────────────────
#  أدوات داخلية — UberFix API
# ──────────────────────────────────────────────────────────────
def _create_uberfix_order(name: str, phone: str, description: str) -> str:
    """يرسل طلب صيانة عبر bot-gateway. يُرجع رقم التتبع أو '' عند الفشل."""
    if not _bot_gateway_url() and not UBERFIX_API_URL:
        return ""

    gateway_payload = {
        "action": "create_request",
        "payload": {
            "client_name": name,
            "client_phone": phone,
            "location": "غير محدد",
            "service_type": _infer_service_type(description),
            "title": _infer_title(description),
            "description": description or "طلب صيانة من بوت UberFix",
            "priority": _infer_priority(description),
        },
        "session_id": _session_id_from_phone(phone),
        "metadata": {"source": "azabot", "locale": "ar"},
    }

    try:
        data = _call_bot_gateway(gateway_payload)
        if data.get("success"):
            result = data.get("data") if isinstance(data.get("data"), dict) else {}
            return (
                data.get("tracking_number")
                or data.get("request_number")
                or result.get("tracking_number")
                or result.get("request_number")
                or data.get("request_id")
                or result.get("request_id")
                or ""
            )
        logger.error("UberFix bot-gateway create failed: %s", data)
    except Exception as e:
        logger.error(f"UberFix bot-gateway create error: {e}")

    return _create_uberfix_order_legacy(name, phone, description)


def _get_uberfix_status(order_id: str) -> str:
    """يجلب حالة طلب UberFix من bot-gateway أو يعيد رابط التتبع عند تعذر الاستعلام."""
    normalized_id = _normalize_uberfix_request_number(order_id)

    try:
        data = _call_bot_gateway({
            "action": "check_status",
            "payload": {
                "search_term": normalized_id,
                "search_type": "request_number",
            },
            "session_id": f"track_{normalized_id}",
            "metadata": {"source": "azabot", "locale": "ar"},
        })
        if data.get("success"):
            return _format_status_response(normalized_id, data)
        logger.error("UberFix bot-gateway status failed: %s", data)
    except Exception as e:
        logger.error(f"UberFix bot-gateway status error: {e}")

    if UBERFIX_STATUS_API_URL:
        return _get_uberfix_status_legacy(normalized_id)

    return _track_link_message(normalized_id)


def _extract_uberfix_request_number(text: str) -> str:
    """يلتقط أرقام UberFix مثل MR-26-01044 بدون قصها إلى 01044."""
    patterns = [
        r"\b([A-Z]{2,4}-\d{2,4}-\d{4,8})\b",
        r"\b([A-Z]{2,4}-?\d{5,12})\b",
        r"\b([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12})\b",
        r"\b(\d{5,10})\b",
    ]
    for pattern in patterns:
        match = re.search(pattern, text, flags=re.IGNORECASE)
        if match:
            return _normalize_uberfix_request_number(match.group(1))
    return ""


def _normalize_uberfix_request_number(value: str) -> str:
    return (value or "").strip().upper()


def _bot_gateway_url() -> str:
    if UBERFIX_BOT_GATEWAY_URL:
        return UBERFIX_BOT_GATEWAY_URL.rstrip("/")
    return os.getenv("LOCAL_BOT_GATEWAY_URL", "http://127.0.0.1:8000/uberfix/bot-gateway").rstrip("/")


def _call_bot_gateway(payload: Dict[str, Any]) -> Dict[str, Any]:
    if not _bot_gateway_url():
        raise RuntimeError("UBERFIX_BOT_GATEWAY_URL/UBERFIX_API_URL is not configured")
    try:
        import httpx
        response = httpx.post(
            _bot_gateway_url(),
            json=payload,
            headers=_uberfix_headers(),
            timeout=12,
        )
        response.raise_for_status()
        data = response.json()
        return data if isinstance(data, dict) else {"success": False, "error": "Invalid gateway response"}
    except Exception as exc:
        logger.error("UberFix bot-gateway call failed | action=%s | error=%s", payload.get("action"), exc)
        raise


def _uberfix_headers() -> Dict[str, str]:
    headers = {"Content-Type": "application/json"}
    if UBERFIX_API_KEY:
        headers["x-api-key"] = UBERFIX_API_KEY
    return headers


def _track_url(order_id: str) -> str:
    return f"{UBERFIX_TRACK_BASE_URL}/{quote(order_id, safe='')}" if order_id else ""


def _track_link_message(order_id: str) -> str:
    if not order_id:
        return "من فضلك أرسل رقم الطلب كاملًا مثل MR-26-01045 وسأجهز لك رابط المتابعة."
    return (
        "رقم الطلب صحيح وتم التعرف عليه.\n"
        "متابعة الحالة تتم من رابط التتبع المباشر:\n"
        f"{_track_url(order_id)}"
    )


def _format_status_response(order_id: str, data: Dict[str, Any]) -> str:
    result = data.get("data")
    if isinstance(result, dict):
        items = result.get("items") or result.get("requests") or result.get("results")
        if isinstance(items, list) and items:
            result = items[0]
    elif isinstance(result, list) and result:
        result = result[0]

    if not isinstance(result, dict):
        message = str(data.get("message") or "").strip()
        return f"{message}\n{_track_url(order_id)}" if message else _track_link_message(order_id)

    status = result.get("status") or result.get("workflow_stage") or result.get("stage") or "غير محدد"
    request_number = result.get("request_number") or result.get("tracking_number") or order_id
    tech = result.get("technician_name") or result.get("assigned_technician_name") or ""
    eta = result.get("eta") or result.get("scheduled_at") or result.get("appointment_time") or ""
    track_url = result.get("track_url") or _track_url(request_number)

    msg = f"الحالة: *{status}*"
    if tech:
        msg += f" | الفني: {tech}"
    if eta:
        msg += f" | الموعد: {eta}"
    if track_url:
        msg += f"\nرابط التتبع: {track_url}"
    return msg


def _create_uberfix_order_legacy(name: str, phone: str, description: str) -> str:
    """Fallback مؤقت للـ maintenance-gateway القديم لو bot-gateway غير جاهز."""
    if not UBERFIX_API_URL:
        return ""
    try:
        import httpx
        payload = {
            "channel": "bot_gateway",
            "client_name": name,
            "client_phone": phone,
            "service_type": _infer_service_type(description),
            "description": description or "طلب صيانة من بوت UberFix",
            "priority": _infer_priority(description),
        }
        response = httpx.post(
            UBERFIX_API_URL,
            json=payload,
            headers=_uberfix_headers(),
            timeout=8,
        )
        response.raise_for_status()
        data = response.json()
        return data.get("request_number") or data.get("tracking_number") or data.get("request_id") or ""
    except Exception as exc:
        logger.error("UberFix legacy create error: %s", exc)
        return ""


def _get_uberfix_status_legacy(order_id: str) -> str:
    try:
        import httpx
        response = httpx.get(
            f"{UBERFIX_STATUS_API_URL}/{quote(order_id, safe='')}",
            headers=_uberfix_headers(),
            timeout=8,
        )
        response.raise_for_status()
        data = response.json()
        return _format_status_response(order_id, data if isinstance(data, dict) else {})
    except Exception as exc:
        logger.error("UberFix legacy status error: %s", exc)
        return _track_link_message(order_id)


def _infer_service_type(description: str) -> str:
    text = (description or "").lower()
    if any(word in text for word in ["كهرب", "electric"]):
        return "electrical"
    if any(word in text for word in ["سباك", "مياه", "تسريب", "plumb"]):
        return "plumbing"
    if any(word in text for word in ["تكييف", "تكيف", "ac", "air"]):
        return "ac"
    return "general"


def _infer_title(description: str) -> str:
    text = (description or "").strip()
    if not text:
        return "طلب صيانة من عزبوت"
    return text[:80]


def _session_id_from_phone(phone: str) -> str:
    digits = re.sub(r"\D+", "", phone or "")
    return f"azabot_{digits[-11:]}" if digits else "azabot_web"


def _infer_priority(description: str) -> str:
    text = (description or "").lower()
    if any(word in text for word in ["عاجل", "طارئ", "emergency", "urgent", "high"]):
        return "high"
    return "normal"
