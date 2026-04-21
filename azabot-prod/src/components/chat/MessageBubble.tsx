import ReactMarkdown from "react-markdown";
import { Bot, Paperclip, Volume2 } from "lucide-react";
import { formatBytes } from "@/lib/chat-service";
import type { Message } from "@/types/chat";

interface MessageBubbleProps {
  msg: Message;
  ttsEnabled: boolean;
  onSpeak: () => void;
}

export function MessageBubble({ msg, ttsEnabled, onSpeak }: MessageBubbleProps) {
  const isUser = msg.role === "user";

  return (
    <div
      className={"flex gap-2.5 animate-fade-in-up " + (isUser ? "flex-row-reverse" : "")}
      role="article"
      aria-label={isUser ? "رسالتك" : "رد عزبوت"}
    >
      <div
        className={"w-8 h-8 rounded-full flex items-center justify-center shrink-0 text-xs font-bold " +
          (isUser ? "bg-primary text-primary-foreground" :
           msg.isError ? "bg-destructive/20 text-destructive" :
           "bg-brand text-brand-foreground")}
        aria-hidden
      >
        {isUser ? "أنا" : <Bot className="w-4 h-4" />}
      </div>

      <div className={"max-w-[78%] flex flex-col gap-1 " + (isUser ? "items-end" : "items-start")}>
        <div className={"px-3.5 py-2.5 rounded-2xl shadow-bubble text-sm leading-relaxed " +
          (isUser ? "bg-primary text-primary-foreground rounded-tr-sm" :
           msg.isError ? "bg-destructive/10 text-destructive border border-destructive/20 rounded-tl-sm" :
           "bg-muted text-foreground rounded-tl-sm")}>

          {msg.role === "assistant" && msg.content ? (
            <div className="prose prose-sm max-w-none prose-p:my-1 prose-headings:my-2 prose-pre:my-2 prose-ul:my-1 prose-li:my-0 dark:prose-invert">
              <ReactMarkdown>{msg.content}</ReactMarkdown>
            </div>
          ) : msg.content ? (
            <p className="whitespace-pre-wrap break-words">{msg.content}</p>
          ) : (
            <span className="text-muted-foreground italic text-xs">جاري الكتابة…</span>
          )}

          {msg.attachments && msg.attachments.length > 0 && (
            <div className="mt-2 space-y-1 pt-2 border-t border-current/10">
              {msg.attachments.map((a, i) => (
                <div key={i} className={"flex items-center gap-2 text-xs rounded-lg px-2 py-1 " + (isUser ? "bg-white/10" : "bg-card")}>
                  <Paperclip className="w-3 h-3 shrink-0" />
                  <span className="truncate flex-1">{a.name}</span>
                  <span className="opacity-60 shrink-0">{formatBytes(a.size)}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {!isUser && msg.content && ttsEnabled && !msg.isError && (
          <button onClick={onSpeak} className="text-xs text-muted-foreground hover:text-brand flex items-center gap-1 transition-colors px-1" aria-label="استماع للرد">
            <Volume2 className="w-3 h-3" />
            استماع
          </button>
        )}

        <time className="text-[10px] text-muted-foreground/60 px-1" dateTime={new Date(msg.ts).toISOString()}>
          {new Date(msg.ts).toLocaleTimeString("ar-EG", { hour: "2-digit", minute: "2-digit" })}
        </time>
      </div>
    </div>
  );
}
