import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { adminApi, adminToken } from "@/lib/adminApi";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { LogOut, Settings, Plug, MessageSquare, FileText, BarChart3 } from "lucide-react";
import azabotLogo from "@/assets/azabot-logo.png";
import { toast } from "sonner";
import GeneralTab from "@/components/admin/GeneralTab";
import IntegrationsTab from "@/components/admin/IntegrationsTab";
import ConversationsTab from "@/components/admin/ConversationsTab";
import LogsTab from "@/components/admin/LogsTab";
import StatsTab from "@/components/admin/StatsTab";

export default function Admin() {
  const nav = useNavigate();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!adminToken.get()) {
      nav("/admin/login", { replace: true });
      return;
    }
    adminApi("stats", { method: "GET" })
      .then(() => setReady(true))
      .catch(() => nav("/admin/login", { replace: true }));
  }, [nav]);

  const logout = () => {
    adminToken.clear();
    toast.success("تم تسجيل الخروج");
    nav("/admin/login");
  };

  if (!ready) return <div className="min-h-screen bg-background" />;

  return (
    <div dir="rtl" className="min-h-screen bg-background">
      <header className="border-b border-border bg-card">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-brand flex items-center justify-center">
              <img src={azabotLogo} alt="AzaBot" className="w-7 h-7" />
            </div>
            <div>
              <h1 className="font-bold text-foreground">لوحة تحكم AzaBot</h1>
              <p className="text-xs text-muted-foreground">إدارة البوت والتكاملات</p>
            </div>
          </div>
          <Button variant="ghost" onClick={logout} className="gap-2">
            <LogOut className="w-4 h-4" /> خروج
          </Button>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-6">
        <Tabs defaultValue="stats" className="w-full">
          <TabsList className="grid grid-cols-5 w-full max-w-2xl mb-6">
            <TabsTrigger value="stats" className="gap-1.5"><BarChart3 className="w-4 h-4" /> نظرة عامة</TabsTrigger>
            <TabsTrigger value="general" className="gap-1.5"><Settings className="w-4 h-4" /> الإعدادات</TabsTrigger>
            <TabsTrigger value="integrations" className="gap-1.5"><Plug className="w-4 h-4" /> التكاملات</TabsTrigger>
            <TabsTrigger value="conversations" className="gap-1.5"><MessageSquare className="w-4 h-4" /> المحادثات</TabsTrigger>
            <TabsTrigger value="logs" className="gap-1.5"><FileText className="w-4 h-4" /> السجلات</TabsTrigger>
          </TabsList>
          <TabsContent value="stats"><StatsTab /></TabsContent>
          <TabsContent value="general"><GeneralTab /></TabsContent>
          <TabsContent value="integrations"><IntegrationsTab /></TabsContent>
          <TabsContent value="conversations"><ConversationsTab /></TabsContent>
          <TabsContent value="logs"><LogsTab /></TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
