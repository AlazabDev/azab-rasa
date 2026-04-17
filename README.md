# 🤖 Alazab Group Chatbot
### مساعد مجموعة العزب الذكي — Rasa Pro CALM

[![Rasa Pro](https://img.shields.io/badge/Rasa%20Pro-3.16%2B-5C4EE5)](https://rasa.com/docs/rasa-pro/)
[![Python](https://img.shields.io/badge/Python-3.11-3776AB)](https://python.org)
[![Docker](https://img.shields.io/badge/Docker-Compose-2496ED)](https://docker.com)
[![Arabic NLU](https://img.shields.io/badge/Language-Arabic%20🇸🇦-green)](https://rasa.com)

---

## 📋 نظرة عامة

مساعد ذكي متكامل لـ **مجموعة العزب** يخدم خمس علامات تجارية في وقت واحد،
مبني على **Rasa Pro CALM** مع دعم كامل للغة العربية بجميع اللهجات.

### 🏢 البراندات المدعومة

| البراند | التخصص | لون هوية | اسم البوت |
|---------|---------|----------|-----------|
| 🏗️ **Alazab Construction** | المشروعات المعمارية | `#1a56db` | عزبوت |
| ✨ **Luxury Finishing** | التشطيبات الراقية | `#c27803` | لاكشري بوت |
| 🎨 **Brand Identity** | هوية العلامات التجارية | `#7e3af2` | براند بوت |
| 🔧 **UberFix** | منصة الصيانة الذكية | `#057a55` | فيكس بوت |
| 🧱 **Laban Alasfour** | التوريدات والخامات | `#e3a008` | لبن بوت |

---

## 🗂️ هيكل المشروع

```
alazab-rasa/
│
├── 📦 Infrastructure
│   ├── docker-compose.yaml         # Stack كامل بـ healthchecks
│   ├── Dockerfile.webhook          # FastAPI webhook server
│   ├── Dockerfile.actions          # Rasa actions server
│   ├── nginx.conf                  # Reverse proxy + SSL + Rate limiting
│   ├── deploy.sh                   # سكربت نشر إنتاجي متكامل
│   ├── Makefile                    # أوامر مختصرة للتطوير والإنتاج
│   ├── .env.example                # نموذج متغيرات البيئة
│   └── .gitignore
│
├── 🤖 Rasa Core
│   ├── config.yml                  # CALM + LLM + EnterpriseSearch
│   ├── endpoints.yml               # Redis + Actions + NLG Rephraser
│   ├── credentials.yml             # REST + Socket.IO + WhatsApp + Meta
│   ├── pyproject.toml
│   │
│   ├── data/                       # Flows (CALM)
│   │   ├── general/                # hello, goodbye, help, lead, handoff
│   │   ├── brands/                 # flow لكل برند
│   │   └── system/patterns/
│   │
│   ├── domain/                     # Responses + Slots + Actions
│   │   ├── shared/slots.yml
│   │   ├── general/
│   │   ├── brands/
│   │   └── system/patterns/
│   │
│   └── docs/                       # قاعدة المعرفة (EnterpriseSearchPolicy)
│       ├── alazab_group.txt
│       ├── alazab_construction.txt
│       ├── luxury_finishing.txt
│       ├── brand_identity.txt
│       ├── uberfix.txt
│       └── laban_alasfour.txt
│
├── ⚙️ Actions Server
│   ├── actions/__init__.py          # تسجيل كل الـ actions
│   ├── actions/action_submit_lead.py
│   ├── actions/action_human_handoff.py
│   └── actions/brand_actions/
│       ├── alazab_construction.py
│       ├── luxury_finishing.py
│       ├── brand_identity.py
│       ├── uberfix.py
│       └── laban_alasfour.py
│
├── 🌐 Webhook Server (FastAPI)
│   └── webhook/server.py           # /chat, /lead, /brands, /webhook/meta
│
├── 🎨 Chatbot Widget
│   ├── chatbot-widget/index.html   # صفحة معاينة كل البراندات
│   └── chatbot-widget/widget.js    # سكربت التضمين الإنتاجي
│
├── 🧪 Tests
│   └── tests/e2e_test_cases/
│       ├── general/
│       └── brands/
│
└── 📝 Prompts
    └── prompts/rephraser_arabic_personality.jinja2
```

---

## 🚀 البدء السريع

### المتطلبات
- Python 3.11+
- Rasa Pro License
- OpenAI API Key
- Docker & Docker Compose
- شهادة SSL (للإنتاج)

### ⚡ نشر سريع بـ Make

```bash
# 1. استنسخ المشروع
git clone https://github.com/alazab/alazab-rasa.git
cd alazab-rasa

# 2. إعداد البيئة
make setup          # ينسخ .env.example → .env
# عدّل .env بالقيم الفعلية

# 3. نشر كامل (train → validate → docker up)
make deploy

# أو بخطوات منفصلة:
make train          # تدريب النموذج
make validate       # التحقق من صحة البيانات
make up             # رفع الحاويات
make status         # فحص الحالة
```

### 🔧 أوامر Make المتاحة

```bash
make help           # عرض كل الأوامر
make setup          # إعداد .env
make train          # تدريب Rasa
make validate       # التحقق من صحة البيانات
make up             # تشغيل Docker Compose
make down           # إيقاف الحاويات
make logs           # سجلات Rasa
make logs-webhook   # سجلات Webhook
make status         # حالة كل الخدمات
make test           # اختبارات E2E
make widget         # فتح صفحة معاينة الـ Widget
make clean          # حذف النماذج المؤقتة
make deploy         # نشر إنتاجي كامل
```

---

## 🎨 تضمين الـ Widget في موقعك

ضع الكود التالي قبل `</body>` في صفحتك:

```html
<script>
  window.AlazabChatConfig = {
    brand:    'alazab_construction',  // اسم البراند
    apiUrl:   'https://api.alazab.com',
    position: 'bottom-left',          // أو 'bottom-right'
    lang:     'ar',
  };
</script>
<script src="https://cdn.alazab.com/chatbot/widget.js" defer></script>
```

### أسماء البراندات المتاحة:
- `alazab_construction`
- `luxury_finishing`
- `brand_identity`
- `uberfix`
- `laban_alasfour`

---

## 🔌 واجهات API

| Endpoint | Method | الوصف |
|----------|--------|-------|
| `/chat` | POST | إرسال رسالة والحصول على رد |
| `/health` | GET | فحص صحة الخدمة |
| `/brands` | GET | قائمة البراندات ومعلوماتها |
| `/lead` | POST | استقبال بيانات عميل جديد |
| `/webhook/meta` | GET/POST | WhatsApp / Messenger |
| `/docs` | GET | توثيق API تفاعلي (Swagger) |

```bash
# مثال — إرسال رسالة
curl -X POST https://api.alazab.com/chat \
  -H "Content-Type: application/json" \
  -d '{"message":"ما هي خدمات UberFix؟","sender_id":"user_123","brand":"uberfix"}'
```

---

## ⚙️ المتغيرات البيئية

| المتغير | الوصف | مطلوب |
|---------|-------|--------|
| `RASA_PRO_LICENSE` | رخصة Rasa Pro | ✅ |
| `OPENAI_API_KEY` | مفتاح OpenAI | ✅ |
| `DB_PASSWORD` | كلمة سر PostgreSQL | ✅ |
| `REDIS_PASSWORD` | كلمة سر Redis | ✅ |
| `WHATSAPP_TOKEN` | توكن WhatsApp Business | اختياري |
| `NOTIFY_PHONE` | رقم فريق المبيعات | اختياري |
| `UBERFIX_API_URL` | رابط API نظام UberFix | اختياري |
| `WEBHOOK_NOTIFY_URL` | رابط CRM الداخلي | اختياري |
| `FB_VERIFY_TOKEN` | توكن التحقق من Meta | اختياري |
| `FB_APP_SECRET` | سر تطبيق Meta | اختياري |
| `FB_PAGE_ACCESS_TOKEN` | توكن صفحة Facebook | اختياري |
| `OPENAI_HANDOFF_MODEL` | موديل GPT للتلخيص | اختياري (افتراضي: gpt-4o-mini) |

---

## 🏗️ المعمارية التقنية

```
المستخدم (موقع / واتساب / ماسنجر)
    │
    ▼
[Nginx — SSL + Rate Limiting + Widget Serving]
    │
    ▼
[Webhook Server — FastAPI :8000]
    │  يخدم Widget + يوجّه للـ channels
    ▼
[Rasa Pro Server :5005]
    │
    ├── SearchReadyLLMCommandGenerator  ← GPT-5.1 يفهم النية
    ├── FlowPolicy                      ← ينفذ الـ flows
    └── EnterpriseSearchPolicy          ← يبحث في FAISS (docs/)
              │
              ▼
    [Actions Server :5055]
              │
              ├── action_submit_lead      → WhatsApp / CRM
              ├── action_human_handoff    → GPT تلخيص + WhatsApp
              ├── action_uberfix_*        → UberFix API
              └── action_*_brand          → منطق كل برند
              │
    [Redis — Tracker Store]
    [PostgreSQL — Events History]
```

---

## 📞 التواصل

- **الموقع:** alazab.com
- **البريد:** info@alazab.com
