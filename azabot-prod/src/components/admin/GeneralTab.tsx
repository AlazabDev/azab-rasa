import { useEffect, useState } from "react";
import { adminApi } from "@/lib/adminApi";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Card } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Loader2, Save } from "lucide-react";
import { AdminSettings, errorMessage } from "@/types/admin";

const MODELS = [
  { id: "google/gemini-2.5-flash", label: "Gemini 2.5 Flash (سريع ومتوازن)" },
  { id: "google/gemini-2.5-flash-lite", label: "Gemini 2.5 Flash Lite (الأسرع والأرخص)" },
  { id: "google/gemini-2.5-pro", label: "Gemini 2.5 Pro (الأقوى)" },
  { id: "openai/gpt-5-mini", label: "GPT-5 Mini" },
  { id: "openai/gpt-5", label: "GPT-5 (الأقوى من OpenAI)" },
];

export default function GeneralTab() {
  const [s, setS] = useState<AdminSettings | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    adminApi<AdminSettings>("get_settings", { method: "GET" })
      .then(setS)
      .catch((e: unknown) => toast.error(errorMessage(e)));
  }, []);

  const upd = <K extends keyof AdminSettings>(k: K, v: AdminSettings[K]) => {
    setS((p) => (p ? { ...p, [k]: v } : p));
  };

  const save = async () => {
    setSaving(true);
    try {
      const updated = await adminApi<AdminSettings>("update_settings", { body: s });
      setS(updated);
      toast.success("تم الحفظ");
    } catch (e: unknown) {
      toast.error(errorMessage(e));
    } finally {
      setSaving(false);
    }
  };

  if (!s) return <div className="flex justify-center p-12"><Loader2 className="w-6 h-6 animate-spin" /></div>;

  return (
    <div className="space-y-4">
      <Card className="p-6 space-y-4">
        <h3 className="font-bold text-lg">الهوية والمظهر</h3>
        <div className="grid md:grid-cols-2 gap-4">
          <div>
            <Label>اسم البوت</Label>
            <Input value={s.bot_name} onChange={(e) => upd("bot_name", e.target.value)} className="mt-1.5" />
          </div>
          <div>
            <Label>اللون الأساسي</Label>
            <div className="flex gap-2 mt-1.5">
              <Input type="color" value={s.primary_color} onChange={(e) => upd("primary_color", e.target.value)} className="w-16 p-1" />
              <Input value={s.primary_color} onChange={(e) => upd("primary_color", e.target.value)} />
            </div>
          </div>
          <div>
            <Label>موضع الزر العائم</Label>
            <Select value={s.position} onValueChange={(v) => upd("position", v as AdminSettings["position"])}>
              <SelectTrigger className="mt-1.5"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="right">يمين</SelectItem>
                <SelectItem value="left">يسار</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <div>
          <Label>رسالة الترحيب</Label>
          <Textarea value={s.welcome_message} onChange={(e) => upd("welcome_message", e.target.value)} className="mt-1.5" rows={2} />
        </div>
        <div>
          <Label>الردود السريعة (سطر لكل رد)</Label>
          <Textarea
            value={(s.quick_replies || []).join("\n")}
            onChange={(e) => upd("quick_replies", e.target.value.split("\n").map((l) => l.trim()).filter(Boolean))}
            className="mt-1.5" rows={4}
          />
        </div>
      </Card>

      <Card className="p-6 space-y-4">
        <h3 className="font-bold text-lg">الذكاء الاصطناعي</h3>
        <div>
          <Label>النموذج</Label>
          <Select value={s.ai_model} onValueChange={(v) => upd("ai_model", v)}>
            <SelectTrigger className="mt-1.5"><SelectValue /></SelectTrigger>
            <SelectContent>
              {MODELS.map((m) => <SelectItem key={m.id} value={m.id}>{m.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label>شخصية البوت (System Prompt)</Label>
          <Textarea
            value={s.system_prompt} onChange={(e) => upd("system_prompt", e.target.value)}
            rows={6} className="mt-1.5 font-mono text-sm"
          />
        </div>
      </Card>

      <Card className="p-6 space-y-4">
        <h3 className="font-bold text-lg">الصوت</h3>
        <div className="flex items-center justify-between">
          <Label>تفعيل الميزات الصوتية</Label>
          <Switch checked={s.voice_enabled} onCheckedChange={(v) => upd("voice_enabled", v)} />
        </div>
        <div className="flex items-center justify-between">
          <Label>نطق ردود البوت تلقائياً</Label>
          <Switch checked={s.auto_speak} onCheckedChange={(v) => upd("auto_speak", v)} />
        </div>
        <div>
          <Label>لغة الصوت الافتراضية</Label>
          <Select value={s.voice_name} onValueChange={(v) => upd("voice_name", v)}>
            <SelectTrigger className="mt-1.5"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="ar-SA">العربية (السعودية)</SelectItem>
              <SelectItem value="ar-EG">العربية (مصر)</SelectItem>
              <SelectItem value="en-US">English (US)</SelectItem>
              <SelectItem value="en-GB">English (UK)</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </Card>

      <Card className="p-6 space-y-4">
        <h3 className="font-bold text-lg">ساعات العمل</h3>
        <div className="flex items-center justify-between">
          <Label>تفعيل الرد خارج الدوام</Label>
          <Switch checked={s.business_hours_enabled} onCheckedChange={(v) => upd("business_hours_enabled", v)} />
        </div>
        {s.business_hours_enabled && (
          <>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>من</Label>
                <Input type="time" value={s.business_hours?.start || "09:00"}
                  onChange={(e) => upd("business_hours", { ...s.business_hours, start: e.target.value })}
                  className="mt-1.5" />
              </div>
              <div>
                <Label>إلى</Label>
                <Input type="time" value={s.business_hours?.end || "18:00"}
                  onChange={(e) => upd("business_hours", { ...s.business_hours, end: e.target.value })}
                  className="mt-1.5" />
              </div>
            </div>
            <div>
              <Label>رسالة خارج ساعات العمل</Label>
              <Textarea value={s.offline_message} onChange={(e) => upd("offline_message", e.target.value)} rows={2} className="mt-1.5" />
            </div>
          </>
        )}
      </Card>

      <div className="flex justify-end sticky bottom-4">
        <Button onClick={save} disabled={saving} className="bg-brand hover:bg-brand-glow text-brand-foreground gap-2 shadow-chat">
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          حفظ التغييرات
        </Button>
      </div>
    </div>
  );
}
