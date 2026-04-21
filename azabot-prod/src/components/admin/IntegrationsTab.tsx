import { useEffect, useState } from "react";
import { adminApi } from "@/lib/adminApi";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Plus, Trash2, TestTube, Webhook, Send, MessageCircle, Phone } from "lucide-react";
import { AdminIntegration, errorMessage } from "@/types/admin";

const TYPES = [
  { id: "webhook", label: "Webhook عام", icon: Webhook, desc: "أرسل لأي URL — يعمل مع n8n/Make/Zapier" },
  { id: "telegram", label: "Telegram", icon: Send, desc: "أرسل لقناة/بوت تيليجرام" },
  { id: "whatsapp", label: "WhatsApp Business", icon: MessageCircle, desc: "Meta Cloud API" },
  { id: "twilio", label: "Twilio (SMS/WhatsApp)", icon: Phone, desc: "رسائل SMS أو WhatsApp عبر Twilio" },
];

const EVENTS = [
  { id: "conversation.started", label: "بدء محادثة جديدة" },
  { id: "message.created", label: "كل رسالة جديدة" },
];

export default function IntegrationsTab() {
  const [list, setList] = useState<AdminIntegration[]>([]);
  const [editing, setEditing] = useState<AdminIntegration | null>(null);
  const [open, setOpen] = useState(false);

  const load = () => adminApi<AdminIntegration[]>("list_integrations", { method: "GET" })
    .then(setList)
    .catch((e: unknown) => toast.error(errorMessage(e)));
  useEffect(() => { load(); }, []);

  const startNew = (type: string) => {
    setEditing({ type, name: TYPES.find((t) => t.id === type)?.label || "", enabled: true, config: {}, events: ["message.created"] });
    setOpen(true);
  };

  const startEdit = (it: AdminIntegration) => { setEditing({ ...it }); setOpen(true); };

  const save = async () => {
    try {
      await adminApi("save_integration", { body: editing });
      toast.success("تم الحفظ");
      setOpen(false); setEditing(null); load();
    } catch (e: unknown) { toast.error(errorMessage(e)); }
  };

  const del = async (id: string) => {
    if (!confirm("حذف هذا التكامل؟")) return;
    await adminApi("delete_integration", { body: { id } });
    toast.success("تم الحذف"); load();
  };

  const test = async (id: string) => {
    toast.loading("جارٍ الاختبار...", { id: "test" });
    try {
      const r = await adminApi<{ status: string; statusCode?: number; errorMessage?: string }>("test_integration", { body: { id } });
      toast.dismiss("test");
      if (r.status === "success") toast.success(`نجح الاختبار (${r.statusCode})`);
      else toast.error(`فشل: ${r.errorMessage || r.statusCode}`);
    } catch (e: unknown) { toast.dismiss("test"); toast.error(errorMessage(e)); }
  };

  return (
    <div className="space-y-4">
      <Card className="p-6">
        <h3 className="font-bold text-lg mb-4">إضافة تكامل جديد</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {TYPES.map((t) => (
            <button key={t.id} onClick={() => startNew(t.id)}
              className="flex items-start gap-3 p-4 rounded-xl border border-border hover:border-brand hover:bg-accent transition-smooth text-right">
              <t.icon className="w-6 h-6 text-brand shrink-0" />
              <div className="flex-1">
                <div className="font-semibold text-foreground">{t.label}</div>
                <div className="text-xs text-muted-foreground mt-0.5">{t.desc}</div>
              </div>
            </button>
          ))}
        </div>
      </Card>

      <Card className="p-6">
        <h3 className="font-bold text-lg mb-4">التكاملات المُفعّلة ({list.length})</h3>
        {list.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">لا توجد تكاملات بعد</p>
        ) : (
          <div className="space-y-2">
            {list.map((it) => {
              const T = TYPES.find((t) => t.id === it.type);
              const Icon = T?.icon || Webhook;
              return (
                <div key={it.id} className="flex items-center gap-3 p-3 rounded-lg border border-border">
                  <Icon className="w-5 h-5 text-brand shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-foreground truncate">{it.name}</div>
                    <div className="text-xs text-muted-foreground">{T?.label} · {it.events?.length || 0} حدث</div>
                  </div>
                  <Switch checked={it.enabled} onCheckedChange={async (v) => {
                    await adminApi("save_integration", { body: { ...it, enabled: v } }); load();
                  }} />
                  <Button size="icon" variant="ghost" onClick={() => it.id && test(it.id)} disabled={!it.id} title="اختبار"><TestTube className="w-4 h-4" /></Button>
                  <Button size="icon" variant="ghost" onClick={() => startEdit(it)}>تعديل</Button>
                  <Button size="icon" variant="ghost" onClick={() => it.id && del(it.id)} disabled={!it.id} className="text-destructive"><Trash2 className="w-4 h-4" /></Button>
                </div>
              );
            })}
          </div>
        )}
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent dir="rtl" className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing?.id ? "تعديل" : "إضافة"} تكامل {TYPES.find((t) => t.id === editing?.type)?.label}</DialogTitle>
          </DialogHeader>
          {editing && (
            <div className="space-y-3">
              <div>
                <Label>اسم التكامل</Label>
                <Input value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} className="mt-1.5" />
              </div>

              {editing.type === "webhook" && (
                <>
                  <div>
                    <Label>URL</Label>
                    <Input dir="ltr" value={editing.config?.url || ""}
                      onChange={(e) => setEditing({ ...editing, config: { ...editing.config, url: e.target.value } })}
                      placeholder="https://example.com/webhook" className="mt-1.5" />
                  </div>
                  <div>
                    <Label>Secret (اختياري — يُرسل في X-AzaBot-Secret)</Label>
                    <Input dir="ltr" value={editing.config?.secret || ""}
                      onChange={(e) => setEditing({ ...editing, config: { ...editing.config, secret: e.target.value } })}
                      className="mt-1.5" />
                  </div>
                </>
              )}

              {editing.type === "telegram" && (
                <>
                  <div>
                    <Label>Bot Token (من @BotFather)</Label>
                    <Input dir="ltr" type="password" value={editing.config?.bot_token || ""}
                      onChange={(e) => setEditing({ ...editing, config: { ...editing.config, bot_token: e.target.value } })}
                      placeholder="123456:ABC-..." className="mt-1.5" />
                  </div>
                  <div>
                    <Label>Chat ID (المحادثة/القناة)</Label>
                    <Input dir="ltr" value={editing.config?.chat_id || ""}
                      onChange={(e) => setEditing({ ...editing, config: { ...editing.config, chat_id: e.target.value } })}
                      placeholder="-1001234567890" className="mt-1.5" />
                    <p className="text-xs text-muted-foreground mt-1">للحصول عليه: أرسل رسالة للبوت ثم اذهب إلى api.telegram.org/bot&lt;TOKEN&gt;/getUpdates</p>
                  </div>
                </>
              )}

              {editing.type === "whatsapp" && (
                <>
                  <div>
                    <Label>Phone Number ID</Label>
                    <Input dir="ltr" value={editing.config?.phone_number_id || ""}
                      onChange={(e) => setEditing({ ...editing, config: { ...editing.config, phone_number_id: e.target.value } })}
                      className="mt-1.5" />
                  </div>
                  <div>
                    <Label>Access Token (Meta)</Label>
                    <Input dir="ltr" type="password" value={editing.config?.access_token || ""}
                      onChange={(e) => setEditing({ ...editing, config: { ...editing.config, access_token: e.target.value } })}
                      className="mt-1.5" />
                  </div>
                  <div>
                    <Label>رقم المستلم (مع كود الدولة)</Label>
                    <Input dir="ltr" value={editing.config?.recipient || ""}
                      onChange={(e) => setEditing({ ...editing, config: { ...editing.config, recipient: e.target.value } })}
                      placeholder="966501234567" className="mt-1.5" />
                  </div>
                </>
              )}

              {editing.type === "twilio" && (
                <>
                  <div>
                    <Label>Account SID</Label>
                    <Input dir="ltr" value={editing.config?.account_sid || ""}
                      onChange={(e) => setEditing({ ...editing, config: { ...editing.config, account_sid: e.target.value } })}
                      className="mt-1.5" />
                  </div>
                  <div>
                    <Label>Auth Token</Label>
                    <Input dir="ltr" type="password" value={editing.config?.auth_token || ""}
                      onChange={(e) => setEditing({ ...editing, config: { ...editing.config, auth_token: e.target.value } })}
                      className="mt-1.5" />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <Label>From</Label>
                      <Input dir="ltr" value={editing.config?.from || ""}
                        onChange={(e) => setEditing({ ...editing, config: { ...editing.config, from: e.target.value } })}
                        placeholder="+15017122661" className="mt-1.5" />
                    </div>
                    <div>
                      <Label>To</Label>
                      <Input dir="ltr" value={editing.config?.to || ""}
                        onChange={(e) => setEditing({ ...editing, config: { ...editing.config, to: e.target.value } })}
                        placeholder="+966501234567" className="mt-1.5" />
                    </div>
                  </div>
                </>
              )}

              <div>
                <Label>الأحداث المُرسَلة</Label>
                <div className="space-y-2 mt-1.5">
                  {EVENTS.map((ev) => (
                    <label key={ev.id} className="flex items-center gap-2 cursor-pointer">
                      <input type="checkbox" checked={(editing.events || []).includes(ev.id)}
                        onChange={(e) => {
                          const cur = new Set(editing.events || []);
                          if (e.target.checked) cur.add(ev.id);
                          else cur.delete(ev.id);
                          setEditing({ ...editing, events: [...cur] });
                        }} />
                      <span className="text-sm">{ev.label}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <Button variant="ghost" onClick={() => setOpen(false)}>إلغاء</Button>
                <Button onClick={save} className="bg-brand hover:bg-brand-glow text-brand-foreground">حفظ</Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
