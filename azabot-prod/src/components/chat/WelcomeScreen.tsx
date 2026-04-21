import { MessageSquare } from "lucide-react";
import { QUICK_ACTIONS } from "@/types/chat";

interface WelcomeScreenProps {
  onPickQuestion: (q: string) => void;
}

export function WelcomeScreen({ onPickQuestion }: WelcomeScreenProps) {
  return (
    <div className="flex flex-col items-center text-center pt-4 animate-fade-in-up" role="region" aria-label="شاشة الترحيب">
      <div className="w-14 h-14 rounded-2xl bg-brand/15 flex items-center justify-center mb-3" aria-hidden>
        <MessageSquare className="w-7 h-7 text-brand" />
      </div>
      <h2 className="font-bold text-lg text-foreground">
        مرحباً! أنا عزبوت <span aria-hidden>👋</span>
      </h2>
      <p className="text-sm text-muted-foreground mt-1 mb-5">كيف يمكنني مساعدتك؟</p>
      <div className="grid grid-cols-2 gap-2 w-full">
        {QUICK_ACTIONS.map((q) => (
          <button
            key={q}
            onClick={() => onPickQuestion(q)}
            className="text-xs text-foreground bg-card border border-border hover:border-brand hover:bg-accent rounded-full px-3 py-2.5 transition-all shadow-bubble text-center leading-snug focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
          >
            {q}
          </button>
        ))}
      </div>
    </div>
  );
}
