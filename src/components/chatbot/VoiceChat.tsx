import { useState, useCallback, useRef, useEffect } from "react";
import { Mic, MicOff, Loader2, Square, Trash2, Volume2 } from "lucide-react";
import { speechToText, textToSpeech } from "./chat-service";
import { ChatMessage } from "./types";

interface VoiceChatProps {
  onTranscriptMessage: (text: string) => void;
  messages: ChatMessage[];
  isLoading: boolean;
}

export const VoiceChat = ({ onTranscriptMessage, messages, isLoading }: VoiceChatProps) => {
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isPlayingTTS, setIsPlayingTTS] = useState(false);
  const [duration, setDuration] = useState(0);
  const [error, setError] = useState("");
  const [lastTranscript, setLastTranscript] = useState("");
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Auto-play TTS for the latest assistant message
  const lastAssistantMsg = messages.filter((m) => m.role === "assistant").pop();

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
    };
  }, []);

  const startRecording = useCallback(async () => {
    setError("");
    setLastTranscript("");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const mediaRecorder = new MediaRecorder(stream, { mimeType: "audio/webm" });
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      mediaRecorder.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
        if (timerRef.current) clearInterval(timerRef.current);

        const blob = new Blob(chunksRef.current, { type: "audio/webm" });
        if (blob.size === 0) return;

        setIsProcessing(true);
        try {
          const text = await speechToText(blob);
          if (text) {
            setLastTranscript(text);
            onTranscriptMessage(text);
          } else {
            setError("لم يتم التعرف على كلام");
          }
        } catch {
          setError("فشل تحويل الصوت لنص");
        } finally {
          setIsProcessing(false);
          setDuration(0);
        }
      };

      mediaRecorder.start();
      setIsRecording(true);
      setDuration(0);
      timerRef.current = setInterval(() => setDuration((prev) => prev + 1), 1000);
    } catch {
      setError("لا يمكن الوصول للميكروفون");
    }
  }, [onTranscriptMessage]);

  const stopRecording = useCallback(() => {
    mediaRecorderRef.current?.stop();
    setIsRecording(false);
    if (timerRef.current) clearInterval(timerRef.current);
  }, []);

  const cancelRecording = useCallback(() => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.onstop = () => {
        streamRef.current?.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
      };
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      setDuration(0);
      if (timerRef.current) clearInterval(timerRef.current);
      chunksRef.current = [];
    }
  }, [isRecording]);

  const playLastResponse = useCallback(async () => {
    if (!lastAssistantMsg || isPlayingTTS) return;
    setIsPlayingTTS(true);
    try {
      const audioUrl = await textToSpeech(lastAssistantMsg.content);
      const audio = new Audio(audioUrl);
      audioRef.current = audio;
      audio.onended = () => {
        setIsPlayingTTS(false);
        URL.revokeObjectURL(audioUrl);
        audioRef.current = null;
      };
      audio.onerror = () => {
        setIsPlayingTTS(false);
        URL.revokeObjectURL(audioUrl);
        audioRef.current = null;
      };
      await audio.play();
    } catch {
      setIsPlayingTTS(false);
      setError("فشل تشغيل الصوت");
    }
  }, [lastAssistantMsg, isPlayingTTS]);

  const stopTTS = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
      setIsPlayingTTS(false);
    }
  }, []);

  const formatDuration = (seconds: number) => {
    const m = Math.floor(seconds / 60).toString().padStart(2, "0");
    const s = (seconds % 60).toString().padStart(2, "0");
    return `${m}:${s}`;
  };

  return (
    <div className="flex-1 flex flex-col items-center justify-center p-6 space-y-6" dir="rtl">
      {/* Status */}
      <div className="text-center space-y-2">
        {isProcessing ? (
          <>
            <div className="w-20 h-20 mx-auto rounded-full bg-primary/10 flex items-center justify-center">
              <Loader2 className="w-8 h-8 text-primary animate-spin" />
            </div>
            <p className="text-sm text-muted-foreground">جاري تحويل الصوت لنص...</p>
          </>
        ) : isRecording ? (
          <>
            <div className="w-20 h-20 mx-auto rounded-full bg-destructive/10 flex items-center justify-center animate-pulse">
              <Mic className="w-8 h-8 text-destructive" />
            </div>
            <p className="text-lg font-bold text-foreground font-display">{formatDuration(duration)}</p>
            <p className="text-sm text-muted-foreground">جاري التسجيل... تحدث الآن</p>
          </>
        ) : isLoading ? (
          <>
            <div className="w-20 h-20 mx-auto rounded-full bg-primary/10 flex items-center justify-center">
              <Loader2 className="w-8 h-8 text-primary animate-spin" />
            </div>
            <p className="text-sm text-muted-foreground">عزبوت يفكر...</p>
          </>
        ) : (
          <>
            <div className="w-20 h-20 mx-auto rounded-full bg-muted flex items-center justify-center">
              <Mic className="w-8 h-8 text-muted-foreground" />
            </div>
            <p className="text-sm text-muted-foreground">اضغط للتحدث مع عزبوت</p>
          </>
        )}
      </div>

      {/* Error */}
      {error && (
        <div className="text-xs text-destructive bg-destructive/10 rounded-lg px-4 py-2 text-center">
          {error}
        </div>
      )}

      {/* Last transcript */}
      {lastTranscript && !isRecording && !isProcessing && (
        <div className="w-full bg-muted rounded-xl p-3 text-sm text-foreground text-center">
          <p className="text-[10px] text-muted-foreground mb-1">ما قلته:</p>
          <p>"{lastTranscript}"</p>
        </div>
      )}

      {/* Last assistant response */}
      {lastAssistantMsg && !isRecording && !isProcessing && !isLoading && (
        <div className="w-full bg-primary/5 border border-primary/20 rounded-xl p-3 text-sm text-foreground text-center max-h-32 overflow-y-auto">
          <p className="text-[10px] text-primary mb-1">رد عزبوت:</p>
          <p className="line-clamp-4">{lastAssistantMsg.content}</p>
        </div>
      )}

      {/* Controls */}
      <div className="flex items-center gap-4">
        {isRecording ? (
          <>
            <button
              onClick={cancelRecording}
              className="w-12 h-12 rounded-full bg-muted flex items-center justify-center text-destructive hover:bg-destructive/10 transition-colors"
              aria-label="إلغاء التسجيل"
            >
              <Trash2 className="w-5 h-5" />
            </button>
            <button
              onClick={stopRecording}
              className="w-16 h-16 rounded-full bg-destructive text-white flex items-center justify-center hover:bg-destructive/90 transition-colors shadow-lg"
              aria-label="إيقاف التسجيل"
            >
              <Square className="w-6 h-6 fill-current" />
            </button>
          </>
        ) : (
          <>
            <button
              onClick={startRecording}
              disabled={isProcessing || isLoading}
              className="w-16 h-16 rounded-full bg-primary text-primary-foreground flex items-center justify-center hover:bg-primary/90 disabled:opacity-50 transition-colors shadow-lg"
              aria-label="بدء التسجيل"
            >
              <Mic className="w-7 h-7" />
            </button>
            {lastAssistantMsg && (
              <button
                onClick={isPlayingTTS ? stopTTS : playLastResponse}
                disabled={isLoading || isProcessing}
                className={`w-12 h-12 rounded-full flex items-center justify-center transition-colors ${
                  isPlayingTTS
                    ? "bg-primary/20 text-primary"
                    : "bg-muted text-muted-foreground hover:bg-primary/10 hover:text-primary"
                } disabled:opacity-50`}
                aria-label={isPlayingTTS ? "إيقاف الصوت" : "تشغيل الرد صوتياً"}
              >
                {isPlayingTTS ? (
                  <Square className="w-4 h-4 fill-current" />
                ) : (
                  <Volume2 className="w-5 h-5" />
                )}
              </button>
            )}
          </>
        )}
      </div>

      <p className="text-[10px] text-muted-foreground text-center">
        مدعوم بالذكاء الاصطناعي - قد يخطئ أحياناً
      </p>
    </div>
  );
};
