/**
 * AzaBot — ChatHeader
 * الهيدر مع شعار + حالة الاتصال + زر الإغلاق + قائمة الروابط
 */

import { useState } from "react";
import { X, RefreshCw, LayoutGrid } from "lucide-react";
import { useNavigate } from "react-router-dom";
import azabotLogo from "@/assets/azabot-logo.png";
import { NAV_ITEMS } from "@/types/chat";

interface ChatHeaderProps {
  onClose: () => void;
  onClear: () => void;
  streaming: boolean;
}

export function ChatHeader({ onClose, onClear, streaming }: ChatHeaderProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const navigate = useNavigate();

  return (
    <header className="bg-primary text-primary-foreground rounded-t-2xl shrink-0">
      <div className="flex items-center justify-between px-3 py-3">
        {/* Left: Close + Clear */}
        <div className="flex items-center gap-1">
          <button
            onClick={onClose}
            className="p-1.5 rounded-full hover:bg-primary-foreground/15 transition-colors"
            aria-label="إغلاق"
          >
            <X className="w-4 h-4" aria-hidden />
          </button>
          <button
            onClick={onClear}
            disabled={streaming}
            className="p-1.5 rounded-full hover:bg-primary-foreground/15 transition-colors disabled:opacity-40"
            aria-label="محادثة جديدة"
            title="محادثة جديدة"
          >
            <RefreshCw className="w-4 h-4" aria-hidden />
          </button>
        </div>

        {/* Center: Brand */}
        <div className="text-right flex-1 px-2">
          <div className="font-bold text-sm flex items-center gap-1 justify-end">
            <span className="text-primary-foreground/90">عزبوت</span>
            <span className="text-brand">(AzaBot)</span>
          </div>
          <div className="text-xs text-primary-foreground/60 flex items-center gap-1.5 justify-end mt-0.5">
            <span
              className={"w-1.5 h-1.5 rounded-full " + (streaming ? "bg-yellow-400 animate-pulse" : "bg-brand animate-pulse")}
              aria-hidden
            />
            {streaming ? "يكتب…" : "متصل الآن"}
          </div>
        </div>

        {/* Right: Logo + Nav */}
        <div className="flex items-center gap-1 shrink-0">
          <div className="w-9 h-9 rounded-full bg-brand flex items-center justify-center">
            <img src={azabotLogo} alt="AzaBot" className="w-7 h-7 object-contain" />
          </div>
          <div className="relative">
            <button
              onClick={() => setMenuOpen((v) => !v)}
              className="p-1.5 rounded-full hover:bg-primary-foreground/15 transition-colors"
              aria-label="قائمة الروابط"
              aria-expanded={menuOpen}
            >
              <LayoutGrid className="w-4 h-4" aria-hidden />
            </button>

            {menuOpen && (
              <div className="absolute top-full left-0 mt-1 z-20 bg-card border border-border rounded-xl shadow-xl overflow-hidden w-48 animate-fade-in-up">
                <div className="max-h-64 overflow-y-auto py-1" dir="rtl">
                  {NAV_ITEMS.map((item) => (
                    <button
                      key={item.href}
                      onClick={() => { setMenuOpen(false); onClose(); navigate(item.href); }}
                      className="w-full flex items-center gap-2.5 px-3 py-2.5 text-sm text-foreground hover:bg-muted transition-colors text-right"
                    >
                      <span aria-hidden>{item.icon}</span>
                      <span>{item.label}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
