"""
actions/__init__.py
====================
تسجيل جميع الـ Custom Actions لـ Rasa SDK.
Rasa يكتشف الـ actions تلقائيًا من هذا الملف.
"""

from .action_submit_lead import ActionSubmitLead
from .action_human_handoff import ActionHumanHandoff
from .form_validation import ValidateCollectLeadForm
from .brand_actions.alazab_construction import (
    ActionAlazabGetQuote,
    ActionAlazabShowProjects,
)
from .brand_actions.luxury_finishing import (
    ActionLuxuryGetQuote,
    ActionLuxuryShowMaterials,
)
from .brand_actions.brand_identity import (
    ActionBrandGetQuote,
    ActionBrandShowProcess,
    ActionBrandShowIndustries,
)
from .brand_actions.uberfix import (
    ActionUberfixCreateRequest,
    ActionUberfixTrackRequest,
    ActionUberfixShowSubscriptions,
)
from .brand_actions.laban_alasfour import (
    ActionLabanShowCatalog,
    ActionLabanBulkQuote,
    ActionLabanCheckDelivery,
)

__all__ = [
    "ActionSubmitLead",
    "ActionHumanHandoff",
    "ValidateCollectLeadForm",
    "ActionAlazabGetQuote",
    "ActionAlazabShowProjects",
    "ActionLuxuryGetQuote",
    "ActionLuxuryShowMaterials",
    "ActionBrandGetQuote",
    "ActionBrandShowProcess",
    "ActionBrandShowIndustries",
    "ActionUberfixCreateRequest",
    "ActionUberfixTrackRequest",
    "ActionUberfixShowSubscriptions",
    "ActionLabanShowCatalog",
    "ActionLabanBulkQuote",
    "ActionLabanCheckDelivery",
]
