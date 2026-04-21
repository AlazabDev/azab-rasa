/**
 * AzaBot — useChat Hook
 * يحتوي على كل منطق المحادثة بعيداً عن الـ UI
 */

import { useState, useCallback, useRef } from "react";
import { streamChat, uploadChatFile, uid, downloadChat } from "@/lib/chat-service";
import { toast } from "sonner";
import type { Message, ApiMessage, Attachment } from "@/types/chat";

export function useChat() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [streaming, setStreaming] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const lastSendRef = useRef<number>(0);

  // إلغاء الطلب الحالي
  const abort = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    setStreaming(false);
  }, []);

  const send = useCallback(
    async (text: string, attachments?: Attachment[], files?: File[]) => {
      const trimmed = text.trim();
      if (!trimmed && (!attachments || attachments.length === 0)) return;
      if (streaming) return;

      // منع الإرسال السريع جداً
      const now = Date.now();
      if (now - lastSendRef.current < 500) return;
      lastSendRef.current = now;

      // إضافة رسالة المستخدم
      const userMsg: Message = {
        id: uid(),
        role: "user",
        content: trimmed,
        attachments,
        ts: Date.now(),
      };

      setMessages((prev) => [...prev, userMsg]);
      setStreaming(true);

      // بناء context للـ AI
      const apiMessages: ApiMessage[] = [...messages, userMsg].map((m) => ({
        role: m.role,
        content:
          m.attachments?.length
            ? `${m.content}\n\n[المرفقات: ${m.attachments.map((a) => a.name).join(", ")}]`
            : m.content,
      }));

      // placeholder رسالة البوت
      const assistantId = uid();
      setMessages((prev) => [
        ...prev,
        { id: assistantId, role: "assistant", content: "", ts: Date.now() },
      ]);

      let accumulated = "";
      const controller = new AbortController();
      abortRef.current = controller;

      const request = files?.length
        ? uploadChatFile({
            file: files[0],
            message: trimmed,
            onDelta: (chunk) => {
              accumulated += chunk;
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === assistantId ? { ...m, content: accumulated } : m
                )
              );
            },
            onDone: () => {
              setStreaming(false);
              abortRef.current = null;
              if (!accumulated) {
                setMessages((prev) => prev.filter((m) => m.id !== assistantId));
                toast.error("لم يأتِ رد من الخادم. حاول مرة أخرى.");
              }
            },
            onError: (msg) => {
              toast.error(msg);
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === assistantId
                    ? { ...m, content: msg, isError: true }
                    : m
                )
              );
              setStreaming(false);
              abortRef.current = null;
            },
            signal: controller.signal,
          })
        : streamChat({
            messages: apiMessages,
            onDelta: (chunk) => {
              accumulated += chunk;
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === assistantId ? { ...m, content: accumulated } : m
                )
              );
            },
            onDone: () => {
              setStreaming(false);
              abortRef.current = null;
              // إذا جاء الرد فارغاً
              if (!accumulated) {
                setMessages((prev) => prev.filter((m) => m.id !== assistantId));
                toast.error("لم يأتِ رد من الخادم. حاول مرة أخرى.");
              }
            },
            onError: (msg) => {
              toast.error(msg);
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === assistantId
                    ? { ...m, content: msg, isError: true }
                    : m
                )
              );
              setStreaming(false);
              abortRef.current = null;
            },
            signal: controller.signal,
          });

      await request;
    },
    [messages, streaming]
  );

  const clearMessages = useCallback(() => {
    abort();
    setMessages([]);
  }, [abort]);

  const downloadConversation = useCallback(() => {
    if (messages.length === 0) {
      toast.info("لا توجد محادثة للتحميل.");
      return;
    }
    downloadChat(messages);
  }, [messages]);

  return {
    messages,
    streaming,
    send,
    abort,
    clearMessages,
    downloadConversation,
  };
}
