import { ChevronDown, Volume2 } from "lucide-react";
import { useState } from "react";
import type { VoiceOption } from "@/types/chat";

interface VoiceSelectorProps {
  voices: VoiceOption[];
  selected: VoiceOption;
  onSelect: (v: VoiceOption) => void;
}

export function VoiceSelector({ voices, selected, onSelect }: VoiceSelectorProps) {
  const [open, setOpen] = useState(false);

  return (
    <div className="px-4 pt-3 relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between bg-muted/60 hover:bg-muted transition-colors rounded-xl px-3 py-2.5 text-sm"
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <ChevronDown className={"w-4 h-4 transition-transform " + (open ? "rotate-180" : "")} aria-hidden />
        <div className="flex items-center gap-2">
          <span className="text-foreground font-medium">{selected.label}</span>
          <span className="text-muted-foreground text-xs">• {selected.desc}</span>
          <Volume2 className="w-4 h-4 text-brand" aria-hidden />
        </div>
      </button>

      {open && (
        <div
          className="mt-2 bg-popover border border-border rounded-xl overflow-hidden shadow-bubble animate-fade-in-up"
          role="listbox"
          aria-label="اختيار الصوت"
        >
          {voices.map((v) => (
            <button
              key={v.id}
              role="option"
              aria-selected={selected.id === v.id}
              onClick={() => { onSelect(v); setOpen(false); }}
              className={"w-full flex items-center justify-between px-3 py-2.5 hover:bg-muted/60 transition-colors text-sm " +
                (selected.id === v.id ? "bg-accent" : "")}
            >
              <Volume2 className="w-4 h-4 text-muted-foreground" aria-hidden />
              <div className="text-right flex-1 mx-2">
                <div className="font-semibold text-foreground">{v.label}</div>
                <div className="text-xs text-muted-foreground">{v.desc}</div>
              </div>
              {selected.id === v.id && <span className="text-brand font-bold" aria-hidden>✓</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
