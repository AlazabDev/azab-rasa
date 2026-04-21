/**
 * AzaBot — Central Configuration
 * الواجهة تتصل مباشرة بسيرفر FastAPI/Rasa الحالي.
 */

const API_ORIGIN = (
  (import.meta.env.VITE_CHAT_API_URL as string | undefined) ||
  window.location.origin
).replace(/\/$/, "");

export const CONFIG = {
  api: {
    origin: API_ORIGIN,
    chat: `${API_ORIGIN}/chat`,
    upload: `${API_ORIGIN}/chat/upload`,
    audio: `${API_ORIGIN}/chat/audio`,
    tts: `${API_ORIGIN}/chat/tts`,
  },

  chat: {
    maxAttachments: 1,
    maxFileSizeMB: 10,
    maxContextMessages: 20,
    sendCooldownMs: 500,
    allowedFileTypes: [
      "image/*",
      "application/pdf",
      ".doc,.docx",
      ".xls,.xlsx",
      ".txt,.csv",
    ],
  },

  siteId: (import.meta.env.VITE_SITE_ID as string | undefined) || undefined,
} as const;
