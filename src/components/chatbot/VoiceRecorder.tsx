import { useRef, useState, useCallback, useEffect } from "react";
import { Mic, MicOff, Loader2, Trash2, Circle, ChevronDown } from "lucide-react";
import { speechToText } from "./chat-service";

interface VoiceRecorderProps {
  onTranscript: (text: string) => void;
  disabled: boolean;
}

export const VoiceRecorder = ({ onTranscript, disabled }: VoiceRecorderProps) => {
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedDevice, setSelectedDevice] = useState<string>("");
  const [error, setError] = useState<string>("");
  const [duration, setDuration] = useState(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Load available audio devices
  useEffect(() => {
    const loadDevices = async () => {
      try {
        // Need a temp stream to get device labels
        const tempStream = await navigator.mediaDevices.getUserMedia({ audio: true });
        tempStream.getTracks().forEach((t) => t.stop());

        const allDevices = await navigator.mediaDevices.enumerateDevices();
        const audioInputs = allDevices.filter((d) => d.kind === "audioinput");
        setDevices(audioInputs);
        if (audioInputs.length > 0 && !selectedDevice) {
          setSelectedDevice(audioInputs[0].deviceId);
        }
      } catch {
        setError("لا يمكن الوصول للميكروفون");
      }
    };

    if (expanded) {
      loadDevices();
    }
  }, [expanded, selectedDevice]);

  const startRecording = useCallback(async () => {
    setError("");
    try {
      const constraints: MediaStreamConstraints = {
        audio: selectedDevice ? { deviceId: { exact: selectedDevice } } : true,
      };
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
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
          if (text) onTranscript(text);
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
      timerRef.current = setInterval(() => {
        setDuration((prev) => prev + 1);
      }, 1000);
    } catch {
      setError("لا يمكن بدء التسجيل");
    }
  }, [onTranscript, selectedDevice]);

  const stopRecording = useCallback(() => {
    mediaRecorderRef.current?.stop();
    setIsRecording(false);
    if (timerRef.current) clearInterval(timerRef.current);
  }, []);

  const cancelRecording = useCallback(() => {
    if (mediaRecorderRef.current && isRecording) {
      // Remove the onstop handler to prevent processing
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

  const toggleMute = useCallback(() => {
    if (streamRef.current) {
      const tracks = streamRef.current.getAudioTracks();
      tracks.forEach((track) => {
        track.enabled = isMuted;
      });
      setIsMuted(!isMuted);
    }
  }, [isMuted]);

  const formatDuration = (seconds: number) => {
    const m = Math.floor(seconds / 60).toString().padStart(2, "0");
    const s = (seconds % 60).toString().padStart(2, "0");
    return `${m}:${s}`;
  };

  // Simple toggle button when collapsed
  if (!expanded) {
    return (
      <button
        type="button"
        onClick={() => setExpanded(true)}
        disabled={disabled}
        className="w-10 h-10 rounded-xl bg-muted text-muted-foreground flex items-center justify-center hover:bg-accent/20 disabled:opacity-50 transition-colors"
        aria-label="Voice recording"
      >
        <Mic className="w-4 h-4" />
      </button>
    );
  }

  return (
    <div className="absolute bottom-full left-0 right-0 mb-1 bg-card border border-border rounded-xl shadow-lg p-3 space-y-2" dir="rtl">
      {/* Error message */}
      {error && (
        <div className="text-xs text-destructive bg-destructive/10 rounded-lg px-3 py-1.5">
          {error}
        </div>
      )}

      {/* Mute toggle */}
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={toggleMute}
          disabled={!isRecording}
          className="flex items-center gap-2 text-sm text-foreground disabled:opacity-40"
        >
          {isMuted ? <MicOff className="w-4 h-4 text-destructive" /> : <Mic className="w-4 h-4" />}
          <span>{isMuted ? "صامت" : "كتم الصوت"}</span>
        </button>
        <button
          type="button"
          onClick={() => { if (!isRecording) setExpanded(false); }}
          className="text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          ✕
        </button>
      </div>

      {/* Microphone selector and controls */}
      <div className="flex items-center gap-2">
        {/* Start/Stop Recording button */}
        {isProcessing ? (
          <button disabled className="flex items-center gap-2 px-3 py-2 rounded-lg bg-muted text-sm">
            <Loader2 className="w-4 h-4 animate-spin" />
            <span>جاري التحويل...</span>
          </button>
        ) : isRecording ? (
          <button
            type="button"
            onClick={stopRecording}
            className="flex items-center gap-2 px-3 py-2 rounded-lg bg-destructive/10 text-destructive text-sm font-medium hover:bg-destructive/20 transition-colors"
          >
            <Circle className="w-3 h-3 fill-destructive animate-pulse" />
            <span>{formatDuration(duration)}</span>
            <span>إيقاف</span>
          </button>
        ) : (
          <button
            type="button"
            onClick={startRecording}
            disabled={disabled}
            className="flex items-center gap-2 px-3 py-2 rounded-lg bg-primary/10 text-primary text-sm font-medium hover:bg-primary/20 disabled:opacity-50 transition-colors"
          >
            <Circle className="w-3 h-3" />
            <span>بدء التسجيل</span>
          </button>
        )}

        {/* Microphone selector */}
        <div className="relative flex-1">
          <select
            value={selectedDevice}
            onChange={(e) => setSelectedDevice(e.target.value)}
            disabled={isRecording}
            className="w-full appearance-none rounded-lg border border-border bg-muted px-3 py-2 text-xs text-foreground disabled:opacity-50 pr-7 truncate"
          >
            {devices.map((d) => (
              <option key={d.deviceId} value={d.deviceId}>
                🎙 {d.label || "ميكروفون"}
              </option>
            ))}
            {devices.length === 0 && <option>🎙 الميكروفون</option>}
          </select>
          <ChevronDown className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-muted-foreground pointer-events-none" />
        </div>

        {/* Record indicator */}
        {isRecording && (
          <button
            type="button"
            onClick={cancelRecording}
            className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center text-destructive hover:bg-destructive/10 transition-colors"
            aria-label="Cancel recording"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        )}
      </div>
    </div>
  );
};
