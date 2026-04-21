import AzaBot from "@/components/AzaBot";

/**
 * الصفحة الرئيسية — تعرض AzaBot كـ floating widget
 * يمكنك هنا إضافة محتوى الصفحة وسيظهر البوت فوقه
 */
export default function Index() {
  return (
    <>
      {/* محتوى الصفحة (اختياري) */}
      <main className="min-h-screen flex items-center justify-center bg-background">
        <p className="text-muted-foreground text-sm select-none">
          AzaBot — Chat Widget
        </p>
      </main>

      {/* البوت العائم */}
      <AzaBot />
    </>
  );
}
