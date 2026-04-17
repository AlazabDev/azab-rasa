import { useState, useRef, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  X, Send, Paperclip, Image, FileText, Loader2, MessageCircle,
  Mic, Wrench, Search, ArrowRight, Bell, CheckCheck, Phone
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface ChatMessage {
  id: string;
  text: string;
  sender: "user" | "bot";
  timestamp: Date;
  type: "text" | "image" | "document" | "audio";
  fileName?: string;
  audioDuration?: number;
}

type ChatMode = "main" | "maintenance-menu" | "create-request" | "query-request";

interface MaintenanceForm {
  client_name: string;
  client_phone: string;
  service_type: string;
  description: string;
  priority: string;
}

const BUSINESS_PHONE = "+201004006620";
const BUSINESS_NAME = "Brand Identity";
const normalizePhone = (value: string) => value.replace(/[^\d]/g, "");

const SERVICE_TYPES = [
  { value: "plumbing", label: "سباكة", icon: "🔧" },
  { value: "electrical", label: "كهرباء", icon: "⚡" },
  { value: "ac", label: "تكييف", icon: "❄️" },
  { value: "painting", label: "دهانات", icon: "🎨" },
  { value: "carpentry", label: "نجارة", icon: "🪚" },
  { value: "general", label: "عامة", icon: "🏗️" },
];

const STATUS_MAP: Record<string, { label: string; emoji: string }> = {
  new: { label: "جديد", emoji: "🆕" },
  accepted: { label: "مقبول", emoji: "✅" },
  in_progress: { label: "قيد التنفيذ", emoji: "🔄" },
  completed: { label: "مكتمل", emoji: "🎉" },
  rejected: { label: "مرفوض", emoji: "❌" },
};

const PRIORITY_OPTIONS = [
  { value: "low", label: "منخفضة" },
  { value: "medium", label: "متوسطة" },
  { value: "high", label: "عالية" },
];

const formatDuration = (seconds: number) => {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
};

const requestNotificationPermission = async () => {
  if (!("Notification" in window)) return false;
  if (Notification.permission === "granted") return true;
  const perm = await Notification.requestPermission();
  return perm === "granted";
};

const showNotification = (title: string, body: string) => {
  if (Notification.permission === "granted") {
    new Notification(title, { body, dir: "rtl", lang: "ar", tag: "maintenance-update" });
  }
};

const WhatsAppChat = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: "welcome",
      text: "مرحباً بك في Brand Identity! 👋\nكيف يمكننا مساعدتك اليوم؟",
      sender: "bot",
      timestamp: new Date(),
      type: "text",
    },
  ]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [showAttachMenu, setShowAttachMenu] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [chatMode, setChatMode] = useState<ChatMode>("main");
  const [notificationsEnabled, setNotificationsEnabled] = useState(false);
  const [maintenanceForm, setMaintenanceForm] = useState<MaintenanceForm>({
    client_name: "", client_phone: "", service_type: "", description: "", priority: "medium",
  });
  const [queryInput, setQueryInput] = useState("");
  const [unreadCount, setUnreadCount] = useState(0);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recordingIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    if ("Notification" in window && Notification.permission === "granted") setNotificationsEnabled(true);
  }, []);

  useEffect(() => {
    return () => {
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") mediaRecorderRef.current.stop();
      if (recordingIntervalRef.current) clearInterval(recordingIntervalRef.current);
    };
  }, []);

  const addBotMessage = useCallback((text: string) => {
    setMessages((prev) => [...prev, { id: crypto.randomUUID(), text, sender: "bot", timestamp: new Date(), type: "text" }]);
    if (!isOpen) setUnreadCount((c) => c + 1);
  }, [isOpen]);

  const addUserMessage = (text: string) => {
    setMessages((prev) => [...prev, { id: crypto.randomUUID(), text, sender: "user", timestamp: new Date(), type: "text" }]);
  };

  const handleToggleNotifications = async () => {
    const granted = await requestNotificationPermission();
    setNotificationsEnabled(granted);
    if (granted) {
      toast.success("تم تفعيل الإشعارات بنجاح");
      showNotification("Brand Identity", "سيتم إعلامك بأي تحديثات على طلبات الصيانة ✅");
    } else {
      toast.error("يرجى السماح بالإشعارات من إعدادات المتصفح");
    }
  };

  const handleCreateRequest = async () => {
    const { client_name, client_phone, service_type, description, priority } = maintenanceForm;
    if (!client_name || !client_phone || !service_type || !description) {
      toast.error("يرجى ملء جميع الحقول المطلوبة");
      return;
    }
    setSending(true);
    const serviceLabel = SERVICE_TYPES.find((s) => s.value === service_type);
    addUserMessage(`📝 طلب صيانة جديد\nالاسم: ${client_name}\nالهاتف: ${client_phone}\nالخدمة: ${serviceLabel?.icon} ${serviceLabel?.label}\nالوصف: ${description}`);
    try {
      const { data, error } = await supabase.functions.invoke("maintenance-proxy", {
        body: { action: "create", client_name, client_phone, service_type, description, priority },
      });
      if (error) throw error;
      const reqNum = data?.data?.request_number || data?.request_number || "—";
      addBotMessage(`تم إنشاء طلب الصيانة بنجاح ✅\n\n📋 رقم الطلب: ${reqNum}\n\nاحتفظ بهذا الرقم لمتابعة حالة طلبك.`);
      if (notificationsEnabled) showNotification("طلب صيانة جديد", `تم إنشاء الطلب رقم ${reqNum} بنجاح`);
      setMaintenanceForm({ client_name: "", client_phone: "", service_type: "", description: "", priority: "medium" });
      setChatMode("main");
    } catch (err) {
      console.error("Create request error:", err);
      addBotMessage("حدث خطأ في إنشاء الطلب ❌\nيرجى المحاولة مرة أخرى.");
    } finally {
      setSending(false);
    }
  };

  const handleQueryRequest = async () => {
    if (!queryInput.trim()) { toast.error("يرجى إدخال رقم الطلب أو رقم الهاتف"); return; }
    setSending(true);
    const isRequestNum = /^MR-/i.test(queryInput.trim());
    addUserMessage(`🔍 استعلام: ${queryInput}`);
    try {
      const body = isRequestNum
        ? { action: "query", request_number: queryInput.trim() }
        : { action: "query", client_phone: queryInput.trim() };
      const { data, error } = await supabase.functions.invoke("maintenance-proxy", { body });
      if (error) throw error;
      const requests = data?.data?.requests || data?.data || data?.requests || [];
      if (Array.isArray(requests) && requests.length > 0) {
        const lines = requests.map((r: any) => {
          const status = STATUS_MAP[r.status] || { label: r.status, emoji: "❓" };
          return `📋 ${r.request_number}\n${status.emoji} الحالة: ${status.label}\n🔧 الخدمة: ${r.service_type || "—"}\n📅 التاريخ: ${r.created_at ? new Date(r.created_at).toLocaleDateString("ar-EG") : "—"}`;
        });
        addBotMessage(`نتائج البحث (${requests.length}):\n\n${lines.join("\n\n─────────\n\n")}`);
        if (notificationsEnabled) showNotification("نتائج البحث", `تم العثور على ${requests.length} طلب(ات)`);
      } else if (typeof requests === "object" && requests.request_number) {
        const r = requests;
        const status = STATUS_MAP[r.status] || { label: r.status, emoji: "❓" };
        addBotMessage(`📋 طلب: ${r.request_number}\n${status.emoji} الحالة: ${status.label}\n🔧 الخدمة: ${r.service_type || "—"}\n📝 الوصف: ${r.description || "—"}`);
      } else {
        addBotMessage("لم يتم العثور على طلبات بهذه البيانات 🔍");
      }
      setQueryInput("");
      setChatMode("main");
    } catch (err) {
      console.error("Query error:", err);
      addBotMessage("حدث خطأ في الاستعلام ❌");
    } finally {
      setSending(false);
    }
  };

  const sendMessage = async () => {
    if (!input.trim() || sending) return;
    const text = input.trim();
    setInput("");
    setSending(true);
    addUserMessage(text);
    try {
      const { error } = await supabase.functions.invoke("whatsapp", {
        body: { action: "send", to: normalizePhone(BUSINESS_PHONE), message: text },
      });
      if (error) throw error;
      addBotMessage("تم إرسال رسالتك بنجاح ✅\nسيتم الرد عليك عبر واتساب الأعمال مباشرة.");
    } catch (err) {
      console.error("Send message error:", err);
      toast.error("تعذر الإرسال حالياً، يرجى المحاولة بعد قليل");
      addBotMessage("تعذر إرسال الرسالة حالياً ❌\nيرجى المحاولة بعد قليل.");
    } finally {
      setSending(false);
    }
  };

  const uploadFile = async (file: File | Blob, fileName: string, mediaType: string) => {
    setSending(true);
    const label = mediaType === "image" ? "📷 صورة" : mediaType === "audio" ? "🎤 رسالة صوتية" : `📎 ${fileName}`;
    setMessages((prev) => [...prev, {
      id: crypto.randomUUID(), text: label, sender: "user", timestamp: new Date(),
      type: mediaType as ChatMessage["type"], fileName, audioDuration: mediaType === "audio" ? recordingTime : undefined,
    }]);
    try {
      const formData = new FormData();
      formData.append("file", file, fileName);
      formData.append("to", normalizePhone(BUSINESS_PHONE));
      formData.append("mediaType", mediaType);
      formData.append("fileName", fileName);
      const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
      const anonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
      const res = await fetch(`https://${projectId}.supabase.co/functions/v1/whatsapp`, {
        method: "POST",
        headers: { Authorization: `Bearer ${anonKey}`, apikey: anonKey },
        body: formData,
      });
      if (!res.ok) throw new Error(`Upload failed [${res.status}]`);
      addBotMessage(mediaType === "audio" ? "تم إرسال الرسالة الصوتية بنجاح ✅" : "تم إرسال الملف بنجاح ✅");
    } catch (err) {
      console.error("Upload file error:", err);
      toast.error("حدث خطأ في إرسال الملف");
      addBotMessage("تعذر إرسال الملف حالياً ❌\nيرجى المحاولة بعد قليل.");
    } finally {
      setSending(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>, type: "document" | "image") => {
    const file = e.target.files?.[0];
    if (!file) return;
    setShowAttachMenu(false);
    await uploadFile(file, file.name, type);
    if (fileInputRef.current) fileInputRef.current.value = "";
    if (imageInputRef.current) imageInputRef.current.value = "";
  };

  const startRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream, { mimeType: "audio/webm;codecs=opus" });
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];
      setRecordingTime(0);
      mediaRecorder.ondataavailable = (e) => { if (e.data.size > 0) audioChunksRef.current.push(e.data); };
      mediaRecorder.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        if (recordingIntervalRef.current) { clearInterval(recordingIntervalRef.current); recordingIntervalRef.current = null; }
        const audioBlob = new Blob(audioChunksRef.current, { type: "audio/webm" });
        if (audioBlob.size > 0) await uploadFile(audioBlob, `voice_${Date.now()}.webm`, "audio");
      };
      mediaRecorder.start(250);
      setIsRecording(true);
      recordingIntervalRef.current = setInterval(() => setRecordingTime((prev) => prev + 1), 1000);
    } catch {
      toast.error("لا يمكن الوصول إلى الميكروفون");
    }
  }, []);

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") mediaRecorderRef.current.stop();
    setIsRecording(false);
    setRecordingTime(0);
  }, []);

  const cancelRecording = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      mediaRecorderRef.current.ondataavailable = null;
      mediaRecorderRef.current.onstop = () => { mediaRecorderRef.current?.stream?.getTracks().forEach((t) => t.stop()); };
      mediaRecorderRef.current.stop();
    }
    if (recordingIntervalRef.current) { clearInterval(recordingIntervalRef.current); recordingIntervalRef.current = null; }
    audioChunksRef.current = [];
    setIsRecording(false);
    setRecordingTime(0);
  }, []);

  const handleOpenChat = () => { setIsOpen(true); setUnreadCount(0); };

  // ─── RENDER HELPERS ───

  const renderMaintenanceForm = () => (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="p-4 space-y-3 bg-card border-t border-border overflow-y-auto max-h-[320px]"
    >
      <div className="flex items-center justify-between mb-1">
        <h4 className="text-sm font-bold font-display text-foreground flex items-center gap-2">
          📝 طلب صيانة جديد
        </h4>
        <button onClick={() => setChatMode("main")} className="text-muted-foreground hover:text-foreground transition-colors">
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>
      <div className="space-y-2.5">
        <input
          type="text"
          placeholder="الاسم الكامل *"
          value={maintenanceForm.client_name}
          onChange={(e) => setMaintenanceForm((f) => ({ ...f, client_name: e.target.value }))}
          className="w-full rounded-xl border border-border bg-muted px-4 py-2.5 text-sm font-body text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent transition-all"
        />
        <input
          type="tel"
          placeholder="رقم الهاتف * (01xxxxxxxxx)"
          value={maintenanceForm.client_phone}
          onChange={(e) => setMaintenanceForm((f) => ({ ...f, client_phone: e.target.value }))}
          className="w-full rounded-xl border border-border bg-muted px-4 py-2.5 text-sm font-body text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent transition-all"
          dir="ltr"
        />
        <div>
          <p className="text-xs font-body text-muted-foreground mb-1.5">نوع الخدمة *</p>
          <div className="grid grid-cols-3 gap-1.5">
            {SERVICE_TYPES.map((s) => (
              <button
                key={s.value}
                onClick={() => setMaintenanceForm((f) => ({ ...f, service_type: s.value }))}
                className={`rounded-lg py-2 px-1 text-xs font-body text-center transition-all border ${
                  maintenanceForm.service_type === s.value
                    ? "bg-accent/10 border-accent text-accent-foreground font-semibold"
                    : "bg-muted border-border text-muted-foreground hover:bg-muted/80"
                }`}
              >
                <span className="block text-base mb-0.5">{s.icon}</span>
                {s.label}
              </button>
            ))}
          </div>
        </div>
        <div>
          <p className="text-xs font-body text-muted-foreground mb-1.5">الأولوية</p>
          <div className="flex gap-2">
            {PRIORITY_OPTIONS.map((p) => (
              <button
                key={p.value}
                onClick={() => setMaintenanceForm((f) => ({ ...f, priority: p.value }))}
                className={`flex-1 rounded-lg py-1.5 text-xs font-body text-center transition-all border ${
                  maintenanceForm.priority === p.value
                    ? "bg-accent/15 border-accent text-foreground font-semibold"
                    : "bg-muted border-border text-muted-foreground"
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>
        <textarea
          placeholder="وصف المشكلة *"
          value={maintenanceForm.description}
          onChange={(e) => setMaintenanceForm((f) => ({ ...f, description: e.target.value }))}
          rows={2}
          className="w-full rounded-xl border border-border bg-muted px-4 py-2.5 text-sm font-body text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent transition-all resize-none"
        />
        <button
          onClick={handleCreateRequest}
          disabled={sending}
          className="w-full py-3 rounded-xl bg-primary text-primary-foreground font-bold text-sm font-display hover:bg-primary/90 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
        >
          {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
          إرسال الطلب
        </button>
      </div>
    </motion.div>
  );

  const renderQueryForm = () => (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="p-4 space-y-3 bg-card border-t border-border"
    >
      <div className="flex items-center justify-between mb-1">
        <h4 className="text-sm font-bold font-display text-foreground flex items-center gap-2">
          🔍 متابعة طلب صيانة
        </h4>
        <button onClick={() => setChatMode("main")} className="text-muted-foreground hover:text-foreground transition-colors">
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>
      <input
        type="text"
        placeholder="رقم الطلب (MR-25-XXXXX) أو رقم الهاتف"
        value={queryInput}
        onChange={(e) => setQueryInput(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && handleQueryRequest()}
        className="w-full rounded-xl border border-border bg-muted px-4 py-2.5 text-sm font-body text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent transition-all"
        dir="ltr"
      />
      <button
        onClick={handleQueryRequest}
        disabled={sending || !queryInput.trim()}
        className="w-full py-3 rounded-xl bg-primary text-primary-foreground font-bold text-sm font-display hover:bg-primary/90 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
      >
        {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
        بحث عن الطلب
      </button>
    </motion.div>
  );

  const renderMaintenanceMenu = () => (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="p-4 space-y-3 bg-card border-t border-border"
    >
      <div className="flex items-center justify-between mb-1">
        <h4 className="text-sm font-bold font-display text-foreground flex items-center gap-2">
          🔧 خدمات الصيانة
        </h4>
        <button onClick={() => setChatMode("main")} className="text-muted-foreground hover:text-foreground transition-colors">
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>
      <button
        onClick={() => setChatMode("create-request")}
        className="w-full py-3.5 rounded-xl bg-primary text-primary-foreground font-bold text-sm font-display hover:bg-primary/90 transition-all flex items-center justify-center gap-2.5"
      >
        <Wrench className="w-4 h-4" />
        طلب صيانة جديد
      </button>
      <button
        onClick={() => setChatMode("query-request")}
        className="w-full py-3.5 rounded-xl bg-secondary text-secondary-foreground font-bold text-sm font-display hover:bg-secondary/80 transition-all flex items-center justify-center gap-2.5 border border-border"
      >
        <Search className="w-4 h-4" />
        متابعة حالة طلب
      </button>
    </motion.div>
  );

  return (
    <>
      {/* WhatsApp FAB */}
      <button
        onClick={isOpen ? () => setIsOpen(false) : handleOpenChat}
        className="fixed bottom-6 left-6 z-50 group"
        aria-label="فتح محادثة واتساب"
      >
        <div className="relative">
          <motion.div
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.95 }}
            className="w-14 h-14 rounded-full bg-[#25D366] flex items-center justify-center shadow-xl"
          >
            <AnimatePresence mode="wait">
              {isOpen ? (
                <motion.div key="close" initial={{ rotate: -90, opacity: 0 }} animate={{ rotate: 0, opacity: 1 }} exit={{ rotate: 90, opacity: 0 }}>
                  <X className="w-6 h-6 text-white" />
                </motion.div>
              ) : (
                <motion.div key="chat" initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }}>
                  <MessageCircle className="w-7 h-7 text-white" />
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>

          <AnimatePresence>
            {unreadCount > 0 && !isOpen && (
              <motion.span
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                exit={{ scale: 0 }}
                className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-destructive text-destructive-foreground text-[10px] font-bold flex items-center justify-center"
              >
                {unreadCount}
              </motion.span>
            )}
          </AnimatePresence>

          {!isOpen && (
            <motion.div
              animate={{ scale: [1, 1.5], opacity: [0.4, 0] }}
              transition={{ repeat: Infinity, duration: 2.5, ease: "easeOut" }}
              className="absolute inset-0 rounded-full bg-[#25D366]"
            />
          )}
        </div>
      </button>

      {/* Chat Window */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 30, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 30, scale: 0.9 }}
            transition={{ type: "spring", damping: 25, stiffness: 300 }}
            className="fixed bottom-24 left-6 z-50 w-[380px] max-w-[calc(100vw-2rem)] rounded-2xl overflow-hidden shadow-2xl flex flex-col border border-border bg-card"
            style={{ maxHeight: "min(550px, calc(100vh - 8rem))" }}
          >
            {/* Header */}
            <div className="bg-primary px-4 py-3.5 shrink-0">
              <div className="flex items-center gap-3">
                <div className="relative">
                  <div className="w-11 h-11 rounded-full bg-primary-foreground/15 flex items-center justify-center border border-primary-foreground/20">
                    <MessageCircle className="w-5 h-5 text-primary-foreground" />
                  </div>
                  <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-[#25D366] border-2 border-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="text-primary-foreground font-display font-bold text-sm truncate">{BUSINESS_NAME}</h3>
                  <p className="text-primary-foreground/60 text-[11px] font-body">متصل الآن • الرد فوري</p>
                </div>
                <div className="flex items-center gap-0.5">
                  <button
                    onClick={handleToggleNotifications}
                    className={`w-8 h-8 rounded-full flex items-center justify-center transition-colors ${
                      notificationsEnabled ? "bg-primary-foreground/20 text-accent" : "text-primary-foreground/50 hover:text-primary-foreground hover:bg-primary-foreground/10"
                    }`}
                    title={notificationsEnabled ? "الإشعارات مفعلة" : "تفعيل الإشعارات"}
                  >
                    <Bell className="w-4 h-4" />
                  </button>
                  <a
                    href={`tel:${BUSINESS_PHONE}`}
                    className="w-8 h-8 rounded-full flex items-center justify-center text-primary-foreground/50 hover:text-primary-foreground hover:bg-primary-foreground/10 transition-colors"
                  >
                    <Phone className="w-4 h-4" />
                  </a>
                  <button
                    onClick={() => setIsOpen(false)}
                    className="w-8 h-8 rounded-full flex items-center justify-center text-primary-foreground/50 hover:text-primary-foreground hover:bg-primary-foreground/10 transition-colors"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>

            {/* Messages */}
            <div
              className="flex-1 overflow-y-auto p-4 space-y-3 min-h-[180px] bg-muted/30"
            >
              {messages.map((msg) => (
                <motion.div
                  key={msg.id}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.15 }}
                  className={`flex ${msg.sender === "user" ? "justify-end" : "justify-start"}`}
                >
                  <div
                    className={`max-w-[82%] px-3.5 py-2 text-[13px] font-body leading-relaxed shadow-sm ${
                      msg.sender === "user"
                        ? "bg-accent/15 text-foreground rounded-2xl rounded-br-md border border-accent/20"
                        : "bg-card text-foreground rounded-2xl rounded-bl-md border border-border"
                    }`}
                  >
                    {msg.type === "audio" ? (
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-full bg-accent flex items-center justify-center shrink-0">
                          <Mic className="w-3.5 h-3.5 text-accent-foreground" />
                        </div>
                        <div className="flex-1">
                          <div className="flex gap-0.5 items-center h-4">
                            {[...Array(20)].map((_, i) => (
                              <div key={i} className="w-0.5 bg-accent/60 rounded-full" style={{ height: `${Math.random() * 14 + 4}px` }} />
                            ))}
                          </div>
                        </div>
                        {msg.audioDuration && (
                          <span className="text-[10px] text-muted-foreground shrink-0">{formatDuration(msg.audioDuration)}</span>
                        )}
                      </div>
                    ) : (
                      <p className="whitespace-pre-wrap">{msg.text}</p>
                    )}
                    <div className="flex items-center gap-1 mt-1">
                      <span className="text-[10px] text-muted-foreground" dir="ltr">
                        {msg.timestamp.toLocaleTimeString("ar-EG", { hour: "2-digit", minute: "2-digit" })}
                      </span>
                      {msg.sender === "user" && <CheckCheck className="w-3 h-3 text-accent" />}
                    </div>
                  </div>
                </motion.div>
              ))}
              <div ref={messagesEndRef} />
            </div>

            {/* Maintenance sections */}
            {chatMode === "maintenance-menu" && renderMaintenanceMenu()}
            {chatMode === "create-request" && renderMaintenanceForm()}
            {chatMode === "query-request" && renderQueryForm()}

            {/* Attach Menu */}
            <AnimatePresence>
              {showAttachMenu && chatMode === "main" && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 10 }}
                  className="bg-card border-t border-border px-4 py-3 flex gap-6 justify-center shrink-0"
                >
                  <button
                    onClick={() => imageInputRef.current?.click()}
                    className="flex flex-col items-center gap-1.5 text-xs font-body text-muted-foreground hover:text-foreground transition-colors"
                  >
                    <div className="w-11 h-11 rounded-xl bg-accent/15 flex items-center justify-center">
                      <Image className="w-5 h-5 text-accent" />
                    </div>
                    صورة
                  </button>
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="flex flex-col items-center gap-1.5 text-xs font-body text-muted-foreground hover:text-foreground transition-colors"
                  >
                    <div className="w-11 h-11 rounded-xl bg-primary/10 flex items-center justify-center">
                      <FileText className="w-5 h-5 text-primary" />
                    </div>
                    ملف
                  </button>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Input / Recording */}
            {chatMode === "main" && (
              <div className="bg-card border-t border-border px-3 py-2.5 flex items-center gap-2 shrink-0">
                {isRecording ? (
                  <>
                    <button onClick={cancelRecording} className="w-9 h-9 rounded-full flex items-center justify-center text-destructive hover:bg-destructive/10 transition-colors">
                      <X className="w-5 h-5" />
                    </button>
                    <div className="flex-1 flex items-center justify-center gap-2 bg-destructive/10 rounded-full px-3 py-1.5">
                      <motion.div animate={{ opacity: [1, 0.3, 1] }} transition={{ repeat: Infinity, duration: 1.2 }} className="w-2.5 h-2.5 rounded-full bg-destructive" />
                      <span className="text-sm font-body text-destructive font-medium tabular-nums" dir="ltr">
                        {formatDuration(recordingTime)}
                      </span>
                    </div>
                    <button onClick={stopRecording} className="w-9 h-9 rounded-full bg-accent flex items-center justify-center text-accent-foreground hover:bg-accent/90 transition-colors">
                      <Send className="w-4 h-4" />
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      onClick={() => setShowAttachMenu(!showAttachMenu)}
                      className="w-9 h-9 rounded-full flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                    >
                      <Paperclip className="w-5 h-5" />
                    </button>
                    <button
                      onClick={() => { setChatMode("maintenance-menu"); setShowAttachMenu(false); }}
                      className="w-9 h-9 rounded-full flex items-center justify-center text-muted-foreground hover:text-accent hover:bg-accent/10 transition-colors"
                      title="خدمات الصيانة"
                    >
                      <Wrench className="w-5 h-5" />
                    </button>
                    <input
                      type="text"
                      value={input}
                      onChange={(e) => setInput(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && sendMessage()}
                      placeholder="اكتب رسالتك..."
                      className="flex-1 bg-muted rounded-full px-4 py-2 text-sm font-body text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-accent/30 focus:bg-card transition-all"
                      disabled={sending}
                    />
                    {input.trim() ? (
                      <button
                        onClick={sendMessage}
                        disabled={sending}
                        className="w-9 h-9 rounded-full bg-accent flex items-center justify-center text-accent-foreground hover:bg-accent/90 transition-colors disabled:opacity-50"
                      >
                        {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                      </button>
                    ) : (
                      <button
                        onClick={startRecording}
                        disabled={sending}
                        className="w-9 h-9 rounded-full bg-accent flex items-center justify-center text-accent-foreground hover:bg-accent/90 transition-colors disabled:opacity-50"
                      >
                        {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Mic className="w-4 h-4" />}
                      </button>
                    )}
                  </>
                )}
              </div>
            )}

            {/* Hidden file inputs */}
            <input ref={fileInputRef} type="file" className="hidden" accept=".pdf,.doc,.docx,.xls,.xlsx,.zip" onChange={(e) => handleFileUpload(e, "document")} />
            <input ref={imageInputRef} type="file" className="hidden" accept="image/*" onChange={(e) => handleFileUpload(e, "image")} />
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};

export default WhatsAppChat;
