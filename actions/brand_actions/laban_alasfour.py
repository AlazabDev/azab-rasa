"""
actions/brand_actions/laban_alasfour.py
=========================================
أوامر مخصصة لـ Laban Alasfour — التوريدات والخامات
"""

import logging
from typing import Any, Text, Dict, List

from rasa_sdk import Action, Tracker
from rasa_sdk.executor import CollectingDispatcher
from rasa_sdk.events import SlotSet
from rasa_sdk.types import DomainDict

logger = logging.getLogger(__name__)


class ActionLabanShowCatalog(Action):
    """يعرض كتالوج المنتجات المتاحة."""

    def name(self) -> Text:
        return "action_laban_show_catalog"

    def run(
        self,
        dispatcher: CollectingDispatcher,
        tracker: Tracker,
        domain: DomainDict,
    ) -> List[Dict[Text, Any]]:

        catalog = {
            "🧱 مواد البناء":    ["طوب أحمر", "طوب أبيض", "اسمنت", "رمل", "زلط"],
            "🪟 مواد التشطيب":   ["بلاط", "سيراميك", "رخام", "جبس", "دهانات"],
            "🔩 مواد الصيانة":   ["أنابيب PVC", "كابلات كهربائية", "مواسير نحاس"],
            "🏗️ مواد العزل":    ["عزل حراري", "عزل مائي", "فوم", "مواد خاصة"],
            "🚪 تشطيبات داخلية": ["أبواب خشب", "شبابيك ألومنيوم", "أسطح مطبخ"],
        }

        text = "🧱 *كتالوج Laban Alasfour:*\n\n"
        for category, items in catalog.items():
            text += f"{category}\n"
            text += "  " + " · ".join(items) + "\n\n"
        text += "للطلب أو الاستفسار عن الأسعار والكميات، تواصل معنا."

        dispatcher.utter_message(text=text)
        return [SlotSet("brand", "Laban Alasfour")]


class ActionLabanBulkQuote(Action):
    """يعالج طلبات الجملة ويضبط بيانات التواصل."""

    def name(self) -> Text:
        return "action_laban_bulk_quote"

    def run(
        self,
        dispatcher: CollectingDispatcher,
        tracker: Tracker,
        domain: DomainDict,
    ) -> List[Dict[Text, Any]]:

        dispatcher.utter_message(
            text=(
                "🧱 للطلبات بالجملة نقدم:\n"
                "• أسعار خاصة للمقاولين والشركات\n"
                "• جدول توريد مرن يتناسب مع جدول مشروعك\n"
                "• توصيل مباشر للموقع\n\n"
                "أحتاج بياناتك لإعداد عرض السعر المناسب."
            )
        )
        return [SlotSet("brand", "Laban Alasfour")]


class ActionLabanCheckDelivery(Action):
    """يوضح تفاصيل خدمة التوصيل."""

    def name(self) -> Text:
        return "action_laban_check_delivery"

    def run(
        self,
        dispatcher: CollectingDispatcher,
        tracker: Tracker,
        domain: DomainDict,
    ) -> List[Dict[Text, Any]]:

        dispatcher.utter_message(
            text=(
                "🚛 *خدمة التوصيل — Laban Alasfour:*\n\n"
                "• داخل المحافظة: خلال 24–48 ساعة\n"
                "• المحافظات الأخرى: 2–4 أيام عمل\n"
                "• الحد الأدنى للتوصيل المجاني: يُحدد حسب الطلب\n"
                "• الدفع: عند الاستلام أو تحويل بنكي\n\n"
                "أرسل عنوان الموقع والكميات المطلوبة لتأكيد الموعد."
            )
        )
        return [SlotSet("brand", "Laban Alasfour")]
