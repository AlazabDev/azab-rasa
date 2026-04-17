"""
actions/brand_actions/luxury_finishing.py
==========================================
أوامر مخصصة لـ Luxury Finishing
"""

import logging
from typing import Any, Text, Dict, List

from rasa_sdk import Action, Tracker
from rasa_sdk.executor import CollectingDispatcher
from rasa_sdk.events import SlotSet
from rasa_sdk.types import DomainDict

logger = logging.getLogger(__name__)


class ActionLuxuryGetQuote(Action):
    """يضبط سياق العلامة ويمهّد لـ collect_lead flow."""

    def name(self) -> Text:
        return "action_luxury_get_quote"

    def run(
        self,
        dispatcher: CollectingDispatcher,
        tracker: Tracker,
        domain: DomainDict,
    ) -> List[Dict[Text, Any]]:

        dispatcher.utter_message(
            text=(
                "✨ سنرسل مهندس Luxury Finishing للمعاينة وتقديم "
                "عرض سعر تفصيلي مجانًا. أحتاج بياناتك أولًا."
            )
        )
        return [SlotSet("brand", "Luxury Finishing")]


class ActionLuxuryShowMaterials(Action):
    """يعرض قائمة الخامات الفاخرة المتاحة."""

    def name(self) -> Text:
        return "action_luxury_show_materials"

    def run(
        self,
        dispatcher: CollectingDispatcher,
        tracker: Tracker,
        domain: DomainDict,
    ) -> List[Dict[Text, Any]]:

        materials = {
            "أرضيات": ["رخام إيطالي", "بورسلان فاخر", "باركيه خشبي", "إيبوكسي"],
            "حوائط":  ["دهانات فاخرة", "ورق حائط", "خشب ديكوري", "جبس بورد"],
            "إضاءة":  ["تراك ليد", "داون لايت", "إضاءة خفية", "ثريات فاخرة"],
            "أسقف":   ["جبس بورد", "مستويات متعددة", "إضاءة مدمجة"],
        }

        text = "✨ *خامات Luxury Finishing المتاحة:*\n\n"
        for category, items in materials.items():
            text += f"*{category}:* {' · '.join(items)}\n"
        text += "\nكل الخامات يمكن تخصيصها حسب ذوقك وميزانيتك."

        dispatcher.utter_message(text=text)
        return [SlotSet("brand", "Luxury Finishing")]
