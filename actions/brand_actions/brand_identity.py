"""
actions/brand_actions/brand_identity.py
=========================================
أوامر مخصصة لـ Brand Identity
"""

import logging
from typing import Any, Text, Dict, List

from rasa_sdk import Action, Tracker
from rasa_sdk.executor import CollectingDispatcher
from rasa_sdk.events import SlotSet
from rasa_sdk.types import DomainDict

logger = logging.getLogger(__name__)


class ActionBrandGetQuote(Action):
    """يضبط سياق العلامة ويمهّد لـ collect_lead flow."""

    def name(self) -> Text:
        return "action_brand_get_quote"

    def run(
        self,
        dispatcher: CollectingDispatcher,
        tracker: Tracker,
        domain: DomainDict,
    ) -> List[Dict[Text, Any]]:

        dispatcher.utter_message(
            text=(
                "🎨 رائع! أخبرنا بنوع نشاطك وحجم المساحة وسنقدم لك "
                "عرضًا شاملًا من الفكرة حتى التنفيذ."
            )
        )
        return [SlotSet("brand", "Brand Identity")]


class ActionBrandShowProcess(Action):
    """يعرض خطوات عملية تنفيذ الهوية التجارية."""

    def name(self) -> Text:
        return "action_brand_show_process"

    def run(
        self,
        dispatcher: CollectingDispatcher,
        tracker: Tracker,
        domain: DomainDict,
    ) -> List[Dict[Text, Any]]:

        steps = [
            ("1️⃣ الاستشارة", "نفهم نشاطك وجمهورك وأهدافك"),
            ("2️⃣ التصميم",   "نصمم الهوية البصرية ونقدم عدة خيارات"),
            ("3️⃣ الموافقة",  "تختار التصميم وتوافق على التفاصيل"),
            ("4️⃣ التنفيذ",   "ننفذ كل عناصر الهوية داخل المساحة"),
            ("5️⃣ التسليم",   "تستلم مشروعك مكتملًا 100٪"),
        ]

        text = "🎨 *مراحل العمل في Brand Identity:*\n\n"
        for step, desc in steps:
            text += f"{step} — {desc}\n"

        dispatcher.utter_message(text=text)
        return [SlotSet("brand", "Brand Identity")]


class ActionBrandShowIndustries(Action):
    """يعرض القطاعات التي تخدمها Brand Identity."""

    def name(self) -> Text:
        return "action_brand_show_industries"

    def run(
        self,
        dispatcher: CollectingDispatcher,
        tracker: Tracker,
        domain: DomainDict,
    ) -> List[Dict[Text, Any]]:

        industries = [
            "🍔 مطاعم وكافيهات",
            "💊 صيدليات وعيادات",
            "🛍️ محلات تجارية",
            "🏢 مكاتب وشركات",
            "🏋️ صالات رياضية",
            "📚 مراكز تعليمية",
            "✂️ صالونات وسبا",
        ]

        text = "🎨 *القطاعات التي نخدمها:*\n\n" + "\n".join(industries)
        text += "\n\nأي قطاع ينتمي إليه نشاطك؟"

        dispatcher.utter_message(text=text)
        return [SlotSet("brand", "Brand Identity")]
