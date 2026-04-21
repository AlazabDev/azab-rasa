import { useCallback, useEffect, useState } from "react";
import { adminApi } from "@/lib/adminApi";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Search, Trash2, MessageSquare } from "lucide-react";
import { toast } from "sonner";
import { ConversationDetail, ConversationMessage, ConversationSummary, errorMessage } from "@/types/admin";

export default function ConversationsTab() {
  const [list, setList] = useState<ConversationSummary[]>([]);
  const [q, setQ] = useState("");
  const [selected, setSelected] = useState<ConversationSummary | null>(null);
  const [msgs, setMsgs] = useState<ConversationMessage[]>([]);

  const load = useCallback(() => {
    adminApi<ConversationSummary[]>("list_conversations", { method: "GET", query: q ? { q } : {} })
      .then(setList)
      .catch((e: unknown) => toast.error(errorMessage(e)));
  }, [q]);

  useEffect(() => { load(); }, [load]);

  const open = async (c: ConversationSummary) => {
    setSelected(c);
    const r = await adminApi<ConversationDetail>("get_conversation", { method: "GET", query: { id: c.id } });
    setMsgs(r.messages || []);
  };

  const del = async (id: string) => {
    if (!confirm("حذف المحادثة؟")) return;
    await adminApi("delete_conversation", { body: { id } });
    toast.success("تم الحذف"); load();
  };

  return (
    <div className="space-y-4">
      <Card className="p-4">
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input value={q} onChange={(e) => setQ(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && load()}
              placeholder="ابحث بالاسم/الإيميل/معرف الجلسة" className="pr-10" />
          </div>
          <Button onClick={load}>بحث</Button>
        </div>
      </Card>

      <Card className="divide-y divide-border">
        {list.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-12">لا توجد محادثات</p>
        ) : list.map((c) => (
          <div key={c.id} className="p-4 flex items-center gap-3 hover:bg-muted/40">
            <MessageSquare className="w-5 h-5 text-brand" />
            <div className="flex-1 min-w-0">
              <div className="font-mono text-xs text-muted-foreground truncate">{c.session_id}</div>
              <div className="text-sm">{c.message_count} رسالة · {new Date(c.last_message_at).toLocaleString("ar-EG")}</div>
            </div>
            <Button size="sm" variant="outline" onClick={() => open(c)}>عرض</Button>
            <Button size="icon" variant="ghost" onClick={() => del(c.id)} className="text-destructive"><Trash2 className="w-4 h-4" /></Button>
          </div>
        ))}
      </Card>

      <Dialog open={!!selected} onOpenChange={(v) => !v && setSelected(null)}>
        <DialogContent dir="rtl" className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>محادثة {selected?.session_id?.slice(0, 16)}…</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            {msgs.map((m) => (
              <div key={m.id} className={`p-3 rounded-lg ${m.role === "user" ? "bg-primary/10" : "bg-brand/10"}`}>
                <div className="text-xs font-bold mb-1">{m.role === "user" ? "👤 الزائر" : "🤖 البوت"}</div>
                <div className="text-sm whitespace-pre-wrap">{m.content}</div>
                <div className="text-xs text-muted-foreground mt-1">{new Date(m.created_at).toLocaleString("ar-EG")}</div>
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
