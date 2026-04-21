import { useEffect, useState } from "react";
import { adminApi } from "@/lib/adminApi";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { IntegrationLog, errorMessage } from "@/types/admin";

export default function LogsTab() {
  const [list, setList] = useState<IntegrationLog[]>([]);
  const load = () => adminApi<IntegrationLog[]>("list_logs", { method: "GET" })
    .then(setList)
    .catch((e: unknown) => toast.error(errorMessage(e)));
  useEffect(() => { load(); }, []);

  return (
    <Card className="p-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-bold">سجل عمليات الإرسال (آخر 200)</h3>
        <Button variant="outline" size="sm" onClick={load} className="gap-2"><RefreshCw className="w-3.5 h-3.5" /> تحديث</Button>
      </div>
      <div className="space-y-2">
        {list.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">لا توجد سجلات بعد</p>
        ) : list.map((l) => (
          <details key={l.id} className="border border-border rounded-lg">
            <summary className="p-3 cursor-pointer flex items-center gap-2 list-none">
              <Badge variant={l.status === "success" ? "default" : "destructive"} className={l.status === "success" ? "bg-green-500" : ""}>
                {l.status === "success" ? "نجح" : "فشل"}
              </Badge>
              <span className="text-xs font-mono">{l.integration_type}</span>
              <span className="text-sm flex-1">{l.event}</span>
              {l.status_code && <span className="text-xs text-muted-foreground">HTTP {l.status_code}</span>}
              <span className="text-xs text-muted-foreground">{new Date(l.created_at).toLocaleString("ar-EG")}</span>
            </summary>
            <div className="p-3 border-t border-border bg-muted/30 space-y-2 text-xs" dir="ltr">
              {l.error_message && <div className="text-destructive font-mono">{l.error_message}</div>}
              <div>
                <div className="font-bold mb-1">Payload:</div>
                <pre className="bg-background p-2 rounded overflow-x-auto">{JSON.stringify(l.request_payload, null, 2)}</pre>
              </div>
              {l.response_body && (
                <div>
                  <div className="font-bold mb-1">Response:</div>
                  <pre className="bg-background p-2 rounded overflow-x-auto whitespace-pre-wrap">{l.response_body}</pre>
                </div>
              )}
            </div>
          </details>
        ))}
      </div>
    </Card>
  );
}
