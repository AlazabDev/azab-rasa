/**
 * AzaBot — المكوّن الرئيسي
 * ─────────────────────────────────────────────────────────
 * بُنية نظيفة: كل منطق في Hooks، كل UI في مكوّنات منفصلة
 * ─────────────────────────────────────────────────────────
 */

import { useEffect, useRef, useState, useCallback } from "react";
import { MessageSquare, Mic, MessageCircle, Volume2, VolumeX } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

import { useChat } from "@/hooks/useChat";
import { useTTS } from "@/hooks/useTTS";
import { uid } from "@/lib/chat-service";

import { ChatHeader } from "./chat/ChatHeader";
import { MessageBubble } from "./chat/MessageBubble";
import { TypingDots } from "./chat/TypingDots";
import { WelcomeScreen } from "./chat/WelcomeScreen";
import { ChatInput } from "./chat/ChatInput";
import { VoiceView } from "./chat/VoiceView";
import { VoiceSelector } from "./chat/VoiceSelector";

import type { Attachment, ChatTab } from "@/types/chat";

export default function AzaBot() {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<ChatTab>("text");

  // رسالة مؤقتة + ملفات مؤقتة قبل الإرسال
  const [inputText, setInputText] = useState("");
  const [pendingAttachments, setPendingAttachments] = useState<Attachment[]>([]);
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);

  const scrollRef = useRef<HTMLDivElement>(null);

  // Hooks
  const { messages, streaming, send, clearMessages, downloadConversation } = useChat();
  const tts = useTTS();

  // Auto-scroll عند كل رسالة جديدة
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
  }, [messages, streaming]);

  // TTS تلقائي لرد البوت في تبويب الصوت
  useEffect(() => {
    if (tab !== "voice") return;
    const lastBot = [...messages].reverse().find((m) => m.role === "assistant");
    if (lastBot && !streaming) tts.speak(lastBot.content);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messages, streaming, tab]);

  // ─── Handlers ───────────────────────────────────────────

  const handleSend = useCallback(() => {
    const text = inputText.trim();
    if (!text && pendingFiles.length === 0) return;
    if (streaming) return;

    send(
      text,
      pendingAttachments.length > 0 ? pendingAttachments : undefined,
      pendingFiles.length > 0 ? pendingFiles : undefined,
    );
    setInputText("");
    setPendingAttachments([]);
    setPendingFiles([]);
  }, [inputText, pendingFiles, pendingAttachments, streaming, send]);

  const handlePickQuestion = useCallback(
    (q: string) => send(q),
    [send]
  );

  const handleVoiceSend = useCallback(
    (text: string) => send(text),
    [send]
  );

  const handleAddFiles = useCallback((files: File[]) => {
    setPendingFiles((p) => [...p, ...files]);
    setPendingAttachments((p) => [
      ...p,
      ...files.map((f) => ({ name: f.name, size: f.size, type: f.type })),
    ]);
  }, []);

  const handleRemoveFile = useCallback((idx: number) => {
    setPendingFiles((p) => p.filter((_, i) => i !== idx));
    setPendingAttachments((p) => p.filter((_, i) => i !== idx));
  }, []);

  const handleClose = useCallback(() => {
    setOpen(false);
    tts.stop();
  }, [tts]);

  const handleClear = useCallback(() => {
    clearMessages();
    setInputText("");
    setPendingAttachments([]);
    setPendingFiles([]);
    toast.success("تم بدء محادثة جديدة.");
  }, [clearMessages]);

  // ─── Floating Button ─────────────────────────────────────

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="fixed bottom-6 left-6 z-50 w-14 h-14 rounded-full bg-brand text-brand-foreground flex items-center justify-center shadow-[0_8px_32px_-8px_hsl(42,100%,55%,0.6)] hover:scale-110 active:scale-95 transition-transform"
        aria-label="فتح المساعد الذكي عزبوت"
      >
        <MessageCircle className="w-6 h-6" aria-hidden />
      </button>
    );
  }

  // ─── Chat Window ─────────────────────────────────────────

  return (
    <div
      className="fixed bottom-6 left-6 z-50 w-[390px] max-w-[calc(100vw-1.5rem)] h-[600px] max-h-[calc(100svh-2rem)] bg-background rounded-2xl shadow-[var(--shadow-chat)] border border-border flex flex-col overflow-hidden animate-fade-in-up"
      role="dialog"
      aria-modal="true"
      aria-label="نافذة دردشة عزبوت"
    >
      {/* Header */}
      <ChatHeader onClose={handleClose} onClear={handleClear} streaming={streaming} />

      {/* Tabs */}
      <div className="flex border-b border-border bg-card shrink-0" role="tablist">
        <TabButton
          active={tab === "text"}
          onClick={() => setTab("text")}
          icon={<MessageSquare className="w-4 h-4" />}
          label="محادثة نصية"
          id="tab-text"
        />
        <TabButton
          active={tab === "voice"}
          onClick={() => setTab("voice")}
          icon={<Mic className="w-4 h-4" />}
          label="محادثة صوتية"
          id="tab-voice"
        />
      </div>

      {/* Voice selector (تبويب الصوت فقط) */}
      {tab === "voice" && (
        <VoiceSelector
          voices={tts.voices}
          selected={tts.selectedVoice}
          onSelect={tts.setSelectedVoice}
        />
      )}

      {/* Body */}
      {tab === "voice" ? (
        <VoiceView messages={messages} streaming={streaming} onSendText={handleVoiceSend} />
      ) : (
        <>
          <div
            ref={scrollRef}
            className="flex-1 overflow-y-auto px-4 py-4 space-y-3 scrollbar-thin scrollbar-thumb-border"
            role="log"
            aria-live="polite"
            aria-label="سجل المحادثة"
          >
            {messages.length === 0 ? (
              <WelcomeScreen onPickQuestion={handlePickQuestion} />
            ) : (
              <>
                {messages.map((msg) => (
                  <MessageBubble
                    key={msg.id}
                    msg={msg}
                    ttsEnabled={tts.enabled}
                    onSpeak={() => tts.speak(msg.content)}
                  />
                ))}
                {/* أنيميشن الكتابة: يظهر فقط إذا آخر رسالة بوت لا تزال فارغة */}
                {streaming && messages[messages.length - 1]?.role === "assistant" && !messages[messages.length - 1]?.content && (
                  <TypingDots />
                )}
              </>
            )}
          </div>

          {/* Input */}
          <ChatInput
            value={inputText}
            onChange={setInputText}
            onSend={handleSend}
            onDownload={downloadConversation}
            streaming={streaming}
            pendingAttachments={pendingAttachments}
            pendingFiles={pendingFiles}
            onAddFiles={handleAddFiles}
            onRemoveFile={handleRemoveFile}
          />
        </>
      )}

      {/* TTS toggle في تبويب النص */}
      {tab === "text" && (
        <div className="absolute top-[3.5rem] left-2">
          <Button
            size="icon"
            variant="ghost"
            onClick={tts.toggle}
            className="w-8 h-8 rounded-full"
            aria-label={tts.enabled ? "إيقاف النطق" : "تشغيل النطق"}
            title={tts.enabled ? "إيقاف النطق" : "تشغيل النطق"}
          >
            {tts.enabled
              ? <Volume2 className="w-4 h-4 text-brand" />
              : <VolumeX className="w-4 h-4 text-muted-foreground" />}
          </Button>
        </div>
      )}
    </div>
  );
}

// ─── TabButton ───────────────────────────────────────────────

function TabButton({
  active,
  onClick,
  icon,
  label,
  id,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
  id: string;
}) {
  return (
    <button
      id={id}
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={"flex-1 flex items-center justify-center gap-2 py-3 text-sm font-semibold transition-colors relative " +
        (active ? "text-brand" : "text-muted-foreground hover:text-foreground")}
    >
      {label}
      {icon}
      {active && (
        <span className="absolute bottom-0 left-1/4 right-1/4 h-0.5 bg-brand rounded-full" aria-hidden />
      )}
    </button>
  );
}
