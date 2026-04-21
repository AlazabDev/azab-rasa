import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  const navigate = useNavigate();
  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-4 text-center p-6" dir="rtl">
      <h1 className="text-6xl font-bold text-brand">404</h1>
      <p className="text-xl text-foreground font-semibold">الصفحة غير موجودة</p>
      <p className="text-muted-foreground text-sm">الرابط الذي تبحث عنه غير متاح.</p>
      <Button onClick={() => navigate("/")} className="mt-2 bg-brand text-brand-foreground hover:bg-brand-glow">
        العودة للرئيسية
      </Button>
    </div>
  );
}
