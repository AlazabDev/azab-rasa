/**
 * AzaBot — VoiceView
 * تبويب المحادثة الصوتية مع دعم MediaRecorder + ElevenLabs STT/TTS
 */

import { useState, useCallback, useRef, useEffect } from "react";
import { Mic, Square, Trash2, Volume2, Loader2 } from "lucide-react";
import { speechToText, speakInBrowser, stopSpeechPlayback } from "@/lib/chat-service";
import { toast } from "sonner";
import type { Message } from "@/types/chat";

interface VoiceViewProps {
  messages: Message[];
  streaming: boolean;
  onSendText: (text: string) => void;
}

export function VoiceView({ messages, streaming, onSendText }: VoiceViewProps) {
  const [recording, setRecording] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [playingTTS, setPlayingTTS] = useState(false);
  const [duration, setDuration] = useState(0);
  const [transcript, setTranscript] = useState("");

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const lastBot = messages.filter((m) => m.role === "assistant").pop();

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      audioRef.current?.pause();
      streamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  const startRecording = useCallback(async () => {
    setTranscript("");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      const mimeType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
        ? "audio/webm;codecs=opus"
        : "audio/webm";

      const recorder = new MediaRecorder(stream, { mimeType });
      mediaRecorderRef.current = recorder;
      chunksRef.current = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      recorder.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
        if (timerRef.current) clearInterval(timerRef.current);

        const blob = new Blob(chunksRef.current, { type: mimeType });
        if (blob.size === 0) return;

        setProcessing(true);
        try {
          const text = await speechToText(blob);
          if (text) {
            setTranscript(text);
            onSendText(text);
          } else {
            toast.warning("لم يُتعرف على كلام واضح. حاول مرة أخرى.");
          }
        } catch {
          toast.error("فشل تحويل الصوت لنص.");
        } finally {
          setProcessing(false);
          setDuration(0);
        }
      };

      recorder.start(250); // chunks كل 250ms
      setRecording(true);
      setDuration(0);
      timerRef.current = setInterval(() => setDuration((d) => d + 1), 1000);
    } catch {
      toast.error("لا يمكن الوصول للميكروفون. تحقق من الإذن.");
    }
  }, [onSendText]);

  const stopRecording = useCallback(() => {
    mediaRecorderRef.current?.stop();
    setRecording(false);
    if (timerRef.current) clearInterval(timerRef.current);
  }, []);

  const cancelRecording = useCallback(() => {
    if (!recording) return;
    // نُلغي onstop قبل الإيقاف
    if (mediaRecorderRef.current) {
      mediaRecorderRef.current.onstop = () => {
        streamRef.current?.getTracks().forEach((t) => t.stop());
      };
      mediaRecorderRef.current.stop();
    }
    setRecording(false);
    setDuration(0);
    chunksRef.current = [];
    if (timerRef.current) clearInterval(timerRef.current);
  }, [recording]);

  const playTTS = useCallback(async () => {
    if (!lastBot || playingTTS) return;
    setPlayingTTS(true);
    try {
      await speakInBrowser(lastBot.content);
    } catch {
      toast.error("فشل تشغيل الصوت.");
    } finally {
      setPlayingTTS(false);
    }
  }, [lastBot, playingTTS]);

  const stopTTS = useCallback(() => {
    audioRef.current?.pause();
    audioRef.current = null;
    stopSpeechPlayback();
    setPlayingTTS(false);
  }, []);

  const fmt = (s: number) =>
    `${Math.floor(s / 60).toString().padStart(2, "0")}:${(s % 60).toString().padStart(2, "0")}`;

  const busy = processing || streaming;

  return (
    <div className="flex-1 flex flex-col items-center justify-center gap-6 p-6 text-center">
      {/* Status Icon */}
      <div>
        {processing || streaming ? (
          <div className="w-20 h-20 mx-auto rounded-full bg-brand/10 flex items-center justify-center">
            <Loader2 className="w-9 h-9 text-brand animate-spin" />
          </div>
        ) : recording ? (
          <div className="w-20 h-20 mx-auto rounded-full bg-destructive/15 flex items-center justify-center animate-pulse">
            <Mic className="w-9 h-9 text-destructive" />
          </div>
        ) : (
          <div className="w-20 h-20 mx-auto rounded-full bg-brand/10 flex items-center justify-center">
            <Mic className="w-9 h-9 text-brand" />
          </div>
        )}

        <p className="font-bold text-foreground mt-3">
          {processing ? "جاري تحويل الصوت…" :
           streaming ? "عزبوت يفكر…" :
           recording ? fmt(duration) : "محادثة صوتية مع عزبوت"}
        </p>
        <p className="text-sm text-muted-foreground mt-1">
          {recording ? "تحدث الآن" : busy ? "" : "اضغط على زر المايك للبدء"}
        </p>
      </div>

      {/* Transcript */}
      {transcript && !recording && !processing && (
        <div className="w-full bg-muted rounded-xl p-3 text-sm text-center">
          <p className="text-[10px] text-muted-foreground mb-1">ما قلته:</p>
          <p className="text-foreground">"{transcript}"</p>
        </div>
      )}

      {/* Last Bot Reply */}
      {lastBot && !recording && !busy && (
        <div className="w-full bg-brand/5 border border-brand/20 rounded-xl p-3 text-sm text-center max-h-28 overflow-y-auto">
          <p className="text-[10px] text-brand mb-1">رد عزبوت:</p>
          <p className="text-foreground line-clamp-4">{lastBot.content}</p>
        </div>
      )}

      {/* Controls */}
      <div className="flex items-center gap-4">
        {recording ? (
          <>
            <button
              onClick={cancelRecording}
              className="w-12 h-12 rounded-full bg-muted flex items-center justify-center text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
              aria-label="إلغاء التسجيل"
            >
              <Trash2 className="w-5 h-5" />
            </button>
            <button
              onClick={stopRecording}
              className="w-16 h-16 rounded-full bg-destructive text-white flex items-center justify-center hover:bg-destructive/90 transition-colors shadow-lg"
              aria-label="إيقاف وإرسال"
            >
              <Square className="w-6 h-6 fill-current" />
            </button>
          </>
        ) : (
          <>
            <button
              onClick={startRecording}
              disabled={busy}
              className="w-16 h-16 rounded-full bg-brand text-brand-foreground flex items-center justify-center hover:bg-brand-glow disabled:opacity-40 transition-colors shadow-lg"
              aria-label="بدء التسجيل"
            >
              <Mic className="w-7 h-7" />
            </button>
            {lastBot && (
              <button
                onClick={playingTTS ? stopTTS : playTTS}
                disabled={busy}
                className={"w-12 h-12 rounded-full flex items-center justify-center transition-colors disabled:opacity-40 " +
                  (playingTTS ? "bg-brand/20 text-brand" : "bg-muted text-muted-foreground hover:bg-brand/10 hover:text-brand")}
                aria-label={playingTTS ? "إيقاف الصوت" : "تشغيل الرد صوتياً"}
              >
                {playingTTS ? <Square className="w-4 h-4 fill-current" /> : <Volume2 className="w-5 h-5" />}
              </button>
            )}
          </>
        )}
      </div>

      <p className="text-[11px] text-muted-foreground">مدعوم بالذكاء الاصطناعي • قد يخطئ أحياناً</p>
    </div>
  );
}
