import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { adminLogin, adminToken } from "@/lib/adminApi";
import { toast } from "sonner";
import azabotLogo from "@/assets/azabot-logo.png";
import { Loader2, Lock } from "lucide-react";
import { errorMessage } from "@/types/admin";

export default function AdminLogin() {
  const nav = useNavigate();
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (adminToken.get()) nav("/admin", { replace: true });
  }, [nav]);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password.trim()) {
      toast.error("أدخل مفتاح الإدارة");
      return;
    }
    setLoading(true);
    try {
      await adminLogin(password);
      toast.success("تم الدخول");
      nav("/admin", { replace: true });
    } catch (e: unknown) {
      toast.error(errorMessage(e, "فشل الدخول"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div dir="rtl" className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-card border border-border rounded-3xl p-8 shadow-chat">
        <div className="flex flex-col items-center mb-6">
          <div className="w-16 h-16 rounded-2xl bg-brand flex items-center justify-center mb-3">
            <img src={azabotLogo} alt="AzaBot" className="w-12 h-12" />
          </div>
          <h1 className="text-2xl font-bold text-foreground">لوحة تحكم AzaBot</h1>
          <p className="text-sm text-muted-foreground mt-1">
            أدخل قيمة ADMIN_API_KEY للدخول
          </p>
        </div>

        <form onSubmit={onSubmit} className="space-y-4">
          <div>
            <Label htmlFor="pw">كلمة المرور</Label>
            <div className="relative mt-1.5">
              <Lock className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                id="pw"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="pr-10"
                autoFocus
                required
              />
            </div>
          </div>
          <Button type="submit" disabled={loading} className="w-full bg-brand hover:bg-brand-glow text-brand-foreground">
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : "دخول"}
          </Button>
        </form>
      </div>
    </div>
  );
}
