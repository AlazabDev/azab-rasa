"""
actions/brand_actions/alazab_construction.py
=============================================
أوامر مخصصة لـ Alazab Construction
"""

import logging
from typing import Any, Text, Dict, List

from rasa_sdk import Action, Tracker
from rasa_sdk.executor import CollectingDispatcher
from rasa_sdk.events import SlotSet
from rasa_sdk.types import DomainDict

logger = logging.getLogger(__name__)


class ActionAlazabGetQuote(Action):
    """يضبط سياق العلامة ويمهّد لـ collect_lead flow."""

    def name(self) -> Text:
        return "action_alazab_get_quote"

    def run(
        self,
        dispatcher: CollectingDispatcher,
        tracker: Tracker,
        domain: DomainDict,
    ) -> List[Dict[Text, Any]]:

        dispatcher.utter_message(
            text=(
                "سنجمع بياناتك لتحويلها لمهندس Alazab Construction "
                "الذي سيتواصل معك لمناقشة مشروعك وتقديم عرض السعر. ✅"
            )
        )
        return [SlotSet("brand", "Alazab Construction")]


class ActionAlazabShowProjects(Action):
    """يعرض ملخصًا عن أبرز مشاريع Alazab Construction."""

    def name(self) -> Text:
        return "action_alazab_show_projects"

    def run(
        self,
        dispatcher: CollectingDispatcher,
        tracker: Tracker,
        domain: DomainDict,
    ) -> List[Dict[Text, Any]]:

        # قابل للتوسعة: جلب المشاريع من API أو قاعدة بيانات
        projects = [
            {"name": "مجمع سكني — القاهرة الجديدة", "type": "سكني",  "units": 120},
            {"name": "مركز تجاري — أكتوبر",           "type": "تجاري", "units": 40},
            {"name": "مبنى إداري — مدينة نصر",         "type": "خدمي",  "units": 8},
        ]

        text = "🏗️ *أبرز مشاريع Alazab Construction:*\n\n"
        for p in projects:
            text += f"• {p['name']} ({p['type']} — {p['units']} وحدة)\n"
        text += "\nهل تريد مزيدًا من التفاصيل أو عرض سعر لمشروع مشابه؟"

        dispatcher.utter_message(text=text)
        return [SlotSet("brand", "Alazab Construction")]
