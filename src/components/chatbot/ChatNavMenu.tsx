import { useNavigate } from "react-router-dom";
import { NAV_ITEMS } from "./types";

interface ChatNavMenuProps {
  isOpen: boolean;
  onClose: () => void;
  onCloseChat: () => void;
}

export const ChatNavMenu = ({ isOpen, onClose, onCloseChat }: ChatNavMenuProps) => {
  const navigate = useNavigate();

  if (!isOpen) return null;

  return (
    <div className="absolute top-full left-0 right-0 z-10 bg-card border border-border rounded-b-xl shadow-lg overflow-hidden">
      <div className="py-1 max-h-64 overflow-y-auto" dir="rtl">
        {NAV_ITEMS.map((item) => (
          <button
            key={item.href}
            onClick={() => {
              onClose();
              onCloseChat();
              navigate(item.href);
            }}
            className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-foreground hover:bg-muted transition-colors text-right"
          >
            <span>{item.icon}</span>
            <span>{item.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
};
