/** AzaBot — Shared TypeScript Types */

export interface Attachment {
  name: string;
  size: number;
  type: string;
}

export interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  attachments?: Attachment[];
  ts: number;
  isError?: boolean;
}

/** ما يُرسل فعلياً لـ AI API */
export interface ApiMessage {
  role: "user" | "assistant";
  content: string;
}

export interface VoiceOption {
  id: string;
  label: string;
  desc: string;
  lang: string;
}

export type ChatTab = "text" | "voice";

export const QUICK_ACTIONS = [
  "ما هي خدمات الشركة؟",
  "أريد عرض سعر تشطيب",
  "ما هي أسعار التشطيب؟",
  "ما هي فروع الشركة؟",
] as const;

export const VOICES: VoiceOption[] = [
  { id: "ar-sa", label: "الصوت الأساسي", desc: "عربي • ذكر • شاب", lang: "ar-SA" },
  { id: "en-us-f", label: "سارة", desc: "أمريكي • أنثى • شابة", lang: "en-US" },
  { id: "en-us-m", label: "جورج", desc: "أمريكي • ذكر • متوسط", lang: "en-US" },
];

export const NAV_ITEMS = [
  { label: "الرئيسية", href: "/", icon: "🏠" },
  { label: "خدماتنا", href: "/services", icon: "⚙️" },
  { label: "مشاريعنا", href: "/projects", icon: "📁" },
  { label: "طلب عرض سعر", href: "/quote", icon: "💰" },
  { label: "من نحن", href: "/about", icon: "ℹ️" },
  { label: "تواصل معنا", href: "/contact", icon: "📞" },
  { label: "المدونة", href: "/blog", icon: "📝" },
  { label: "الشركاء", href: "/partners", icon: "🤝" },
] as const;
