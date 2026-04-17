import re
from typing import Any, Dict, Text

from rasa_sdk import FormValidationAction, Tracker
from rasa_sdk.executor import CollectingDispatcher


class ValidateCollectLeadForm(FormValidationAction):
    def name(self) -> Text:
        return "validate_collect_lead_form"

    def validate_user_name(
        self,
        slot_value: Any,
        dispatcher: CollectingDispatcher,
        tracker: Tracker,
        domain: Dict[Text, Any],
    ) -> Dict[Text, Any]:
        value = str(slot_value or "").strip()
        if len(value) < 2:
            dispatcher.utter_message(text="من فضلك اكتب الاسم بشكل أوضح.")
            return {"user_name": None}
        return {"user_name": value}

    def validate_user_phone(
        self,
        slot_value: Any,
        dispatcher: CollectingDispatcher,
        tracker: Tracker,
        domain: Dict[Text, Any],
    ) -> Dict[Text, Any]:
        value = re.sub(r"[^0-9+]", "", str(slot_value or "").strip())
        if not re.fullmatch(r"(?:\+?20|0)?1[0-2,5]\d{8}", value):
            dispatcher.utter_message(text="من فضلك اكتب رقم موبايل مصري صحيح.")
            return {"user_phone": None}
        return {"user_phone": value}

    def validate_user_message(
        self,
        slot_value: Any,
        dispatcher: CollectingDispatcher,
        tracker: Tracker,
        domain: Dict[Text, Any],
    ) -> Dict[Text, Any]:
        value = str(slot_value or "").strip()
        if len(value) < 5:
            dispatcher.utter_message(text="من فضلك اكتب الطلب أو المشكلة بشكل مختصر وواضح.")
            return {"user_message": None}
        return {"user_message": value}
