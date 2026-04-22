/**
 * AzaBot — useTTS Hook
 * إدارة Text-to-Speech بشكل موحد
 */

import { useState, useCallback, useEffect } from "react";
import { VOICES } from "@/types/chat";
import type { VoiceOption } from "@/types/chat";
import { speakInBrowser, stopSpeechPlayback } from "@/lib/chat-service";

export function useTTS() {
  const [enabled, setEnabled] = useState(true);
  const [speaking, setSpeaking] = useState(false);
  const [selectedVoice, setSelectedVoice] = useState<VoiceOption>(VOICES[0]);

  // إيقاف الكلام عند الخروج
  useEffect(() => {
    return () => {
      stopSpeechPlayback();
    };
  }, []);

  const speak = useCallback(
    async (text: string) => {
      if (!enabled) return;

      stopSpeechPlayback();
      setSpeaking(false);

      // تنظيف Markdown قبل القراءة
      const cleanText = text
        .replace(/#{1,6}\s/g, "")
        .replace(/\*\*(.+?)\*\*/g, "$1")
        .replace(/\*(.+?)\*/g, "$1")
        .replace(/`(.+?)`/g, "$1")
        .replace(/\[(.+?)\]\(.+?\)/g, "$1")
        .replace(/^\s*[-*+]\s/gm, "")
        .trim();

      try {
        setSpeaking(true);
        await speakInBrowser(cleanText, selectedVoice.lang);
      } finally {
        setSpeaking(false);
      }
    },
    [enabled, selectedVoice]
  );

  const stop = useCallback(() => {
    stopSpeechPlayback();
    setSpeaking(false);
  }, []);

  const toggle = useCallback(() => {
    if (speaking) stop();
    setEnabled((v) => !v);
  }, [speaking, stop]);

  return {
    enabled,
    speaking,
    selectedVoice,
    voices: VOICES,
    speak,
    stop,
    toggle,
    setSelectedVoice,
  };
}
