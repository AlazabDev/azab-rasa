import { useEffect, useState } from "react";
import { adminApi } from "@/lib/adminApi";
import { Card } from "@/components/ui/card";
import { MessageSquare, Users, Calendar } from "lucide-react";
import { AdminStats } from "@/types/admin";

export default function StatsTab() {
  const [stats, setStats] = useState<AdminStats | null>(null);

  useEffect(() => {
    adminApi<AdminStats>("stats", { method: "GET" }).then(setStats).catch(() => {});
  }, []);

  const items = [
    { label: "إجمالي المحادثات", value: stats?.conversations ?? "—", icon: Users, color: "text-brand" },
    { label: "إجمالي الرسائل", value: stats?.messages ?? "—", icon: MessageSquare, color: "text-primary" },
    { label: "محادثات اليوم", value: stats?.today ?? "—", icon: Calendar, color: "text-green-500" },
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      {items.map((it) => (
        <Card key={it.label} className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">{it.label}</p>
              <p className="text-3xl font-bold mt-2 text-foreground">{it.value}</p>
            </div>
            <it.icon className={`w-10 h-10 ${it.color} opacity-70`} />
          </div>
        </Card>
      ))}
      <Card className="p-6 md:col-span-3">
        <h3 className="font-bold mb-2">رابط البوت العائم</h3>
        <p className="text-sm text-muted-foreground mb-3">
          ضع هذا الكود في موقع ووردبريس (Custom HTML / Header & Footer plugin):
        </p>
        <pre className="bg-muted p-3 rounded-lg text-xs overflow-x-auto" dir="ltr">{`<iframe
  src="${window.location.origin}"
  style="position:fixed;bottom:0;right:0;width:100%;height:100%;border:0;pointer-events:none;z-index:999999;"
  allow="microphone"
  onload="this.style.pointerEvents='auto'"
></iframe>`}</pre>
      </Card>
    </div>
  );
}
