"""
actions/brand_actions/uberfix.py
==================================
أوامر مخصصة لـ UberFix — منصة الصيانة الذكية
"""

import os
import re
import logging
from typing import Any, Text, Dict, List

from rasa_sdk import Action, Tracker
from rasa_sdk.executor import CollectingDispatcher
from rasa_sdk.events import SlotSet
from rasa_sdk.types import DomainDict

logger = logging.getLogger(__name__)

UBERFIX_API_URL = os.getenv("UBERFIX_API_URL", "")
UBERFIX_API_KEY = os.getenv("UBERFIX_API_KEY", "")


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
        match    = re.search(r"\b([A-Z]{2,4}-?\d{4,8}|\d{5,10})\b", last_msg)
        order_id = match.group(1) if match else None

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
    """يرسل طلب صيانة لـ API UberFix. يُرجع رقم الطلب أو '' عند الفشل."""
    if not UBERFIX_API_URL:
        return ""
    try:
        import httpx
        payload = {
            "customer_name":  name,
            "customer_phone": phone,
            "description":    description,
        }
        r = httpx.post(
            f"{UBERFIX_API_URL}/orders",
            json=payload,
            headers={"Authorization": f"Bearer {UBERFIX_API_KEY}"},
            timeout=8,
        )
        r.raise_for_status()
        return r.json().get("order_id", "")
    except Exception as e:
        logger.error(f"UberFix create order error: {e}")
        return ""


def _get_uberfix_status(order_id: str) -> str:
    """يجلب حالة طلب من API UberFix."""
    if not UBERFIX_API_URL:
        return "قيد المراجعة — سيتواصل معك الفريق قريبًا."
    try:
        import httpx
        r = httpx.get(
            f"{UBERFIX_API_URL}/orders/{order_id}",
            headers={"Authorization": f"Bearer {UBERFIX_API_KEY}"},
            timeout=8,
        )
        r.raise_for_status()
        data   = r.json()
        status = data.get("status", "غير محدد")
        tech   = data.get("technician_name", "")
        eta    = data.get("eta", "")
        msg    = f"الحالة: *{status}*"
        if tech:
            msg += f" | الفني: {tech}"
        if eta:
            msg += f" | الموعد: {eta}"
        return msg
    except Exception as e:
        logger.error(f"UberFix track order error: {e}")
        return "تعذّر جلب الحالة. تواصل معنا مباشرة."
