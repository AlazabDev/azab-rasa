/**
 * AzaBot — ChatInput
 * حقل الإدخال مع دعم الملفات والاختصارات
 */

import { useRef } from "react";
import { Send, Paperclip, Download, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { formatBytes } from "@/lib/chat-service";
import { CONFIG } from "@/lib/config";
import { toast } from "sonner";
import type { Attachment } from "@/types/chat";

interface ChatInputProps {
  value: string;
  onChange: (v: string) => void;
  onSend: () => void;
  onDownload: () => void;
  streaming: boolean;
  pendingAttachments: Attachment[];
  pendingFiles: File[];
  onAddFiles: (files: File[]) => void;
  onRemoveFile: (idx: number) => void;
}

export function ChatInput({
  value,
  onChange,
  onSend,
  onDownload,
  streaming,
  pendingAttachments,
  pendingFiles,
  onAddFiles,
  onRemoveFile,
}: ChatInputProps) {
  const fileRef = useRef<HTMLInputElement>(null);

  const handleFiles = (list: FileList | null) => {
    if (!list) return;
    const arr = Array.from(list);
    const oversize = arr.filter((f) => f.size > CONFIG.chat.maxFileSizeMB * 1024 * 1024);
    if (oversize.length > 0) {
      toast.error(`بعض الملفات تتجاوز ${CONFIG.chat.maxFileSizeMB} MB وسيتم تجاهلها.`);
    }
    const valid = arr
      .filter((f) => f.size <= CONFIG.chat.maxFileSizeMB * 1024 * 1024)
      .slice(0, CONFIG.chat.maxAttachments - pendingFiles.length);
    if (valid.length > 0) onAddFiles(valid);
  };

  const canSend = !streaming && (value.trim().length > 0 || pendingFiles.length > 0);

  return (
    <div className="border-t border-border bg-card">
      {/* Pending attachments */}
      {pendingAttachments.length > 0 && (
        <div className="px-3 py-2 flex flex-wrap gap-2 border-b border-border bg-muted/30">
          {pendingAttachments.map((a, i) => (
            <div key={i} className="flex items-center gap-1.5 bg-card border border-border rounded-lg px-2 py-1 text-xs max-w-[180px]">
              <button
                onClick={() => onRemoveFile(i)}
                className="text-muted-foreground hover:text-destructive transition-colors shrink-0"
                aria-label={`إزالة ${a.name}`}
              >
                <X className="w-3 h-3" />
              </button>
              <span className="text-muted-foreground shrink-0">({formatBytes(a.size)})</span>
              <span className="text-foreground font-medium truncate">{a.name}</span>
              <Paperclip className="w-3 h-3 text-brand shrink-0" aria-hidden />
            </div>
          ))}
        </div>
      )}

      {/* Input row */}
      <div className="flex items-end gap-2 p-3">
        {/* Send */}
        <Button
          size="icon"
          onClick={onSend}
          disabled={!canSend}
          className="bg-brand hover:bg-brand-glow text-brand-foreground rounded-xl shrink-0 transition-colors"
          aria-label="إرسال"
        >
          <Send className="w-4 h-4 rotate-180" aria-hidden />
        </Button>

        {/* Textarea */}
        <Textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              if (canSend) onSend();
            }
          }}
          placeholder="اكتب رسالتك… (Enter للإرسال، Shift+Enter لسطر جديد)"
          rows={1}
          className="resize-none min-h-[40px] max-h-32 bg-muted/40 border-0 focus-visible:ring-1 focus-visible:ring-brand text-right rounded-xl text-sm"
          aria-label="حقل الرسالة"
          disabled={streaming}
        />

        {/* Attach */}
        <input
          ref={fileRef}
          type="file"
          multiple
          hidden
          accept={CONFIG.chat.allowedFileTypes?.join(",") ?? "*"}
          onChange={(e) => { handleFiles(e.target.files); e.target.value = ""; }}
          aria-hidden
        />
        <Button
          size="icon"
          variant="ghost"
          onClick={() => fileRef.current?.click()}
          disabled={pendingFiles.length >= CONFIG.chat.maxAttachments}
          className="rounded-xl shrink-0 hover:bg-muted"
          aria-label="إرفاق ملف"
          title="إرفاق ملف"
        >
          <Paperclip className="w-5 h-5 text-muted-foreground" aria-hidden />
        </Button>

        {/* Download */}
        <Button
          size="icon"
          variant="ghost"
          onClick={onDownload}
          className="rounded-xl shrink-0 hover:bg-muted"
          aria-label="تحميل المحادثة"
          title="تحميل المحادثة"
        >
          <Download className="w-5 h-5 text-muted-foreground" aria-hidden />
        </Button>
      </div>

      <p className="text-center text-[11px] text-muted-foreground pb-2">
        مدعوم بالذكاء الاصطناعي • قد يخطئ أحياناً
      </p>
    </div>
  );
}
