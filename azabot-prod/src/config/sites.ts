/**
 * AzaBot — إعدادات المواقع الديناميكية
 * كل موقع له شخصية مستقلة، بيانات مخصصة، وأسئلة سريعة خاصة به
 */

export interface SiteConfig {
  id: string;
  name: string;
  domain: string | string[];
  botName: string;
  brandColor: string;
  gradientHeader: string;
  systemPrompt: string;
  quickActions: string[];
  welcomeMessage: string;
  contactPhone?: string;
  contactEmail?: string;
  language: "ar" | "en" | "both";
}

export const SITE_CONFIGS: Record<string, SiteConfig> = {
  "luxury-finishing": {
    id: "luxury-finishing",
    name: "الأعزب للتشطيبات الفاخرة",
    domain: ["luxury-finishing.alazab.com"],
    botName: "عزبوت التشطيبات",
    brandColor: "#C9A84C",
    gradientHeader: "linear-gradient(135deg, #1a1208 0%, #3d2b0e 100%)",
    systemPrompt: `أنت "عزبوت"، المساعد الذكي لشركة الأعزب للتشطيبات الفاخرة.
تخصصك: التشطيبات السكنية والتجارية الفاخرة، الديكور الداخلي، الرخام، الأسقف المستعارة.
الشركة تعمل في مصر وتقدم خدمات تشطيب على أعلى مستوى.
ردودك بالعربية الفصحى السهلة. كن مختصراً واحترافياً.
عند السؤال عن الأسعار، اذكر أن الأسعار تبدأ من 800 جنيه/م² وتختلف حسب نوع التشطيب.
رقم التواصل: 01000000000`,
    quickActions: [
      "ما هي خدمات التشطيبات المتوفرة؟",
      "أريد عرض سعر تشطيب شقة",
      "ما هي أنواع الرخام المتوفرة؟",
      "كيف أتواصل مع فريق المبيعات؟",
    ],
    welcomeMessage: "مرحباً! أنا عزبوت، مساعد الأعزب للتشطيبات الفاخرة 🏠\nكيف يمكنني مساعدتك اليوم؟",
    language: "ar",
  },

  "brand-identity": {
    id: "brand-identity",
    name: "الأعزب للهوية البصرية",
    domain: ["brand-identity.alazab.com"],
    botName: "عزبوت الهوية",
    brandColor: "#E63946",
    gradientHeader: "linear-gradient(135deg, #1a0a0a 0%, #3d0e0e 100%)",
    systemPrompt: `أنت "عزبوت"، المساعد الذكي لشركة الأعزب للهوية البصرية والتصميم.
تخصصك: تصميم الهوية البصرية، الشعارات، المطبوعات التسويقية، التصميم الرقمي، العلامات التجارية.
ردودك بالعربية. كن إبداعياً واحترافياً في وصفك للخدمات.
يمكنك الرد بالإنجليزية إذا خاطبك المستخدم بها.`,
    quickActions: [
      "أريد تصميم هوية بصرية لشركتي",
      "ما هي تكلفة تصميم شعار؟",
      "ما الخدمات التصميمية المتوفرة؟",
      "كم يستغرق تنفيذ مشروع الهوية؟",
    ],
    welcomeMessage: "مرحباً! أنا عزبوت، مساعد الأعزب للهوية البصرية 🎨\nكيف نساعدك في بناء علامتك التجارية؟",
    language: "both",
  },

  "uberfix": {
    id: "uberfix",
    name: "UberFix للصيانة",
    domain: ["uberfix.alazab.com"],
    botName: "UberBot",
    brandColor: "#F7B731",
    gradientHeader: "linear-gradient(135deg, #0f0f0f 0%, #2d2000 100%)",
    systemPrompt: `You are "UberBot", the smart assistant for UberFix maintenance services.
Specialization: Home and commercial maintenance, plumbing, electrical, AC repair, general fixes.
Respond in Arabic by default, English if the user writes in English.
Be helpful, quick, and practical. When asked about pricing, mention that prices vary by service type and location.
For urgent requests, emphasize 24/7 availability.`,
    quickActions: [
      "أريد حجز موعد صيانة",
      "ما خدمات الطوارئ المتاحة؟",
      "أسعار صيانة التكييف؟",
      "Book a maintenance appointment",
    ],
    welcomeMessage: "Hi! I'm UberBot, your maintenance assistant 🔧\nHow can I help you today?",
    language: "both",
  },

  "laban-alasfour": {
    id: "laban-alasfour",
    name: "ألبان العصفور",
    domain: ["laban-alasfour.alazab.com"],
    botName: "مساعد العصفور",
    brandColor: "#2ECC71",
    gradientHeader: "linear-gradient(135deg, #082010 0%, #0e3d1e 100%)",
    systemPrompt: `أنت "مساعد العصفور"، المساعد الذكي لشركة ألبان العصفور.
تخصصك: منتجات الألبان الطازجة، جبن، زبادي، مشتقات الحليب.
ردودك بالعربية. كن ودوداً وبسيطاً.
يمكنك مساعدة العملاء في معرفة المنتجات، أماكن التوزيع، وكيفية الطلب.`,
    quickActions: [
      "ما هي منتجاتكم المتوفرة؟",
      "كيف أطلب بالجملة؟",
      "أين يمكنني إيجاد منتجاتكم؟",
      "هل يوجد توصيل للمنازل؟",
    ],
    welcomeMessage: "أهلاً! أنا مساعد ألبان العصفور 🥛\nكيف يمكنني مساعدتك؟",
    language: "ar",
  },

  "alazab": {
    id: "alazab",
    name: "مجموعة الأعزب",
    domain: ["alazab.com", "www.alazab.com"],
    botName: "عزبوت",
    brandColor: "#F39C12",
    gradientHeader: "linear-gradient(135deg, #0a0a1a 0%, #1a1535 100%)",
    systemPrompt: `أنت "عزبوت"، المساعد الذكي لمجموعة الأعزب.
مجموعة الأعزب تضم: التشطيبات الفاخرة، الهوية البصرية، خدمات الصيانة، ومنتجات الألبان.
مهمتك: توجيه العملاء للقسم المناسب وتقديم معلومات عامة عن المجموعة.
ردودك بالعربية الفصحى السهلة. كن مرحباً واحترافياً.`,
    quickActions: [
      "ما هي شركات مجموعة الأعزب؟",
      "أريد خدمة تشطيبات",
      "أريد تصميم هوية بصرية",
      "تواصل معنا",
    ],
    welcomeMessage: "مرحباً! أنا عزبوت، مساعد مجموعة الأعزب 🌟\nكيف يمكنني توجيهك لخدماتنا؟",
    language: "ar",
  },
};

/**
 * يكشف إعدادات الموقع بناءً على النطاق أو المعرف
 */
export function resolveSiteConfig(input: string): SiteConfig {
  // محاولة المطابقة بالمعرف المباشر
  if (SITE_CONFIGS[input]) return SITE_CONFIGS[input];

  // محاولة المطابقة بالنطاق
  const domain = input.replace(/^https?:\/\//, "").split("/")[0].toLowerCase();
  for (const config of Object.values(SITE_CONFIGS)) {
    const domains = Array.isArray(config.domain) ? config.domain : [config.domain];
    if (domains.some((d) => domain === d || domain.endsWith(`.${d}`))) {
      return config;
    }
  }

  // الإعدادات الافتراضية — الموقع الرئيسي
  return SITE_CONFIGS["alazab"];
}
