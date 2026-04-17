"""
actions/action_human_handoff.py
================================
يلخص المحادثة بالكامل باستخدام GPT ويرسل الملخص لفريق الدعم،
ثم يُبلغ المستخدم بموعد التحويل.
"""

import os
import logging
from typing import Any, Dict, List, Text

import openai
from rasa_sdk import Action, Tracker
from rasa_sdk.executor import CollectingDispatcher
from rasa_sdk.types import DomainDict

logger = logging.getLogger(__name__)

OPENAI_MODEL = os.getenv("OPENAI_HANDOFF_MODEL", "gpt-4o-mini")


class ActionHumanHandoff(Action):

    def name(self) -> Text:
        return "action_human_handoff"

    async def run(
        self,
        dispatcher: CollectingDispatcher,
        tracker: Tracker,
        domain: DomainDict,
    ) -> List[Dict[Text, Any]]:

        # ── بناء سجل المحادثة ───────────────────────────────
        convo: List[str] = []
        for event in tracker.events:
            if event.get("event") == "user":
                text = str(event.get("text") or "")
                if text:
                    convo.append(f"المستخدم: {text}")
            elif event.get("event") == "bot":
                text = str(event.get("text") or "")
                if text:
                    convo.append(f"البوت: {text}")

        brand        = tracker.get_slot("brand") or "مجموعة العزب"
        user_name    = tracker.get_slot("user_name") or "غير محدد"
        user_phone   = tracker.get_slot("user_phone") or "غير محدد"

        # ── تلخيص المحادثة باستخدام GPT ────────────────────
        summary = "لا يوجد ملخص متاح."
        if convo:
            try:
                prompt = (
                    "المحادثة التالية جرت بين بوت خدمة عملاء ومستخدم. "
                    "لخّصها باختصار باللغة العربية في 3-5 جمل ليتمكن "
                    "الموظف البشري من فهم السياق والطلب الرئيسي فورًا:\n\n"
                    + "\n".join(convo[-20:])  # آخر 20 رسالة فقط لتوفير التوكنز
                )
                client = openai.AsyncOpenAI()
                response = await client.chat.completions.create(
                    model=OPENAI_MODEL,
                    messages=[{"role": "user", "content": prompt}],
                    max_tokens=250,
                    temperature=0.3,
                )
                summary = response.choices[0].message.content or summary
            except Exception as e:
                logger.error(f"GPT summarization error: {e}")

        # ── إرسال الملخص لفريق الدعم ─────────────────────────
        await _notify_support_team(brand, user_name, user_phone, summary, tracker.sender_id)

        dispatcher.utter_message(
            response="utter_transfer_to_manager",
            summary=summary,
        )
        return []


async def _notify_support_team(
    brand: str,
    user_name: str,
    user_phone: str,
    summary: str,
    conversation_id: str,
) -> None:
    """يرسل إشعار التحويل لفريق الدعم عبر WhatsApp."""
    wa_url   = os.getenv("WHATSAPP_API_URL", "")
    wa_token = os.getenv("WHATSAPP_TOKEN", "")
    phone    = os.getenv("NOTIFY_PHONE", "")

    if not (wa_url and wa_token and phone):
        logger.warning("WhatsApp notification not configured — skipping handoff alert.")
        return

    msg = (
        f"🙋 *طلب تحويل لموظف بشري*\n"
        f"البراند: {brand}\n"
        f"الاسم: {user_name}\n"
        f"الهاتف: {user_phone}\n"
        f"المحادثة: {conversation_id}\n\n"
        f"📋 *ملخص المحادثة:*\n{summary}"
    )

    try:
        import httpx
        async with httpx.AsyncClient(timeout=8) as client:
            await client.post(
                wa_url,
                headers={"Authorization": f"Bearer {wa_token}"},
                json={
                    "messaging_product": "whatsapp",
                    "to":   phone,
                    "type": "text",
                    "text": {"body": msg},
                },
            )
    except Exception as e:
        logger.error(f"Handoff WhatsApp notification error: {e}")
