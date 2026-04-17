import { useState, useCallback } from "react";
import { Volume2, Loader2 } from "lucide-react";
import { textToSpeech } from "./chat-service";

interface TTSButtonProps {
  text: string;
}

export const TTSButton = ({ text }: TTSButtonProps) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const handlePlay = useCallback(async () => {
    if (isLoading || isPlaying) return;
    setIsLoading(true);
    try {
      const audioUrl = await textToSpeech(text);
      const audio = new Audio(audioUrl);
      audio.onended = () => {
        setIsPlaying(false);
        URL.revokeObjectURL(audioUrl);
      };
      audio.onerror = () => {
        setIsPlaying(false);
        URL.revokeObjectURL(audioUrl);
      };
      setIsPlaying(true);
      setIsLoading(false);
      await audio.play();
    } catch {
      setIsLoading(false);
      setIsPlaying(false);
    }
  }, [text, isLoading, isPlaying]);

  if (isLoading) {
    return <Loader2 className="w-3 h-3 animate-spin text-muted-foreground inline-block mr-1" />;
  }

  return (
    <button
      onClick={handlePlay}
      className="inline-flex items-center text-muted-foreground hover:text-primary transition-colors"
      aria-label="Listen to message"
    >
      <Volume2 className={`w-3 h-3 ${isPlaying ? "text-primary" : ""}`} />
    </button>
  );
};
