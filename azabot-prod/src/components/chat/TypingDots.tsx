export function TypingDots() {
  return (
    <div className="flex items-center gap-1.5 px-3 py-2" role="status" aria-label="عزبوت يكتب">
      <span className="w-2 h-2 bg-brand rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
      <span className="w-2 h-2 bg-brand rounded-full animate-bounce" style={{ animationDelay: "120ms" }} />
      <span className="w-2 h-2 bg-brand rounded-full animate-bounce" style={{ animationDelay: "240ms" }} />
      <span className="sr-only">عزبوت يكتب…</span>
    </div>
  );
}
