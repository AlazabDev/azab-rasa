/**
 * AzaBot — useTTS Hook
 * إدارة Text-to-Speech بشكل موحد
 */

import { useState, useCallback, useRef, useEffect } from "react";
import { VOICES } from "@/types/chat";
import type { VoiceOption } from "@/types/chat";

export function useTTS() {
  const [enabled, setEnabled] = useState(true);
  const [speaking, setSpeaking] = useState(false);
  const [selectedVoice, setSelectedVoice] = useState<VoiceOption>(VOICES[0]);
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);

  // إيقاف الكلام عند الخروج
  useEffect(() => {
    return () => {
      window.speechSynthesis?.cancel();
    };
  }, []);

  const speak = useCallback(
    (text: string) => {
      if (!enabled || !("speechSynthesis" in window)) return;

      window.speechSynthesis.cancel();
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

      const utterance = new SpeechSynthesisUtterance(cleanText);
      utterance.lang = selectedVoice.lang;
      utterance.rate = 0.95;
      utterance.pitch = 1;

      // اختيار أفضل صوت متاح
      const voices = window.speechSynthesis.getVoices();
      const match =
        voices.find((v) => v.lang === selectedVoice.lang) ||
        voices.find((v) => v.lang.startsWith(selectedVoice.lang.split("-")[0]));
      if (match) utterance.voice = match;

      utterance.onstart = () => setSpeaking(true);
      utterance.onend = () => setSpeaking(false);
      utterance.onerror = () => setSpeaking(false);

      utteranceRef.current = utterance;
      window.speechSynthesis.speak(utterance);
    },
    [enabled, selectedVoice]
  );

  const stop = useCallback(() => {
    window.speechSynthesis?.cancel();
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
