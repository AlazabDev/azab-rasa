export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  imageUrl?: string;
}

export interface NavItem {
  label: string;
  href: string;
  icon: string;
}

export const NAV_ITEMS: NavItem[] = [
  { label: "الرئيسية", href: "/", icon: "🏠" },
  { label: "خدماتنا", href: "/services", icon: "⚙️" },
  { label: "مشاريعنا", href: "/projects", icon: "📁" },
  { label: "طلب عرض سعر", href: "/quote", icon: "💰" },
  { label: "من نحن", href: "/about", icon: "ℹ️" },
  { label: "تواصل معنا", href: "/contact", icon: "📞" },
  { label: "المدونة", href: "/blog", icon: "📝" },
  { label: "الشركاء", href: "/partners", icon: "🤝" },
];

export const SUGGESTED_QUESTIONS = [
  "ما هي خدمات الشركة؟",
  "أريد عرض سعر تشطيب",
  "ما هي أسعار التشطيب؟",
  "ما هي فروع الشركة؟",
];
