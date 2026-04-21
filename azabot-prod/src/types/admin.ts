export interface AdminStats {
  conversations: number;
  messages: number;
  today: number;
  message_counts?: Record<string, number>;
  total?: number;
  uptime_seconds?: number;
  timestamp?: string;
}

export interface AdminSettings {
  bot_name: string;
  primary_color: string;
  position: "right" | "left";
  welcome_message: string;
  quick_replies: string[];
  ai_model: string;
  system_prompt: string;
  voice_enabled: boolean;
  auto_speak: boolean;
  voice_name: string;
  business_hours_enabled: boolean;
  business_hours?: {
    start?: string;
    end?: string;
  };
  offline_message: string;
}

export interface ConversationSummary {
  id: string;
  session_id: string;
  brand?: string;
  channel?: string;
  message_count: number;
  last_message_at: string;
}

export interface ConversationMessage {
  id: string;
  role: "user" | "assistant" | string;
  content: string;
  created_at: string;
}

export interface ConversationDetail extends ConversationSummary {
  created_at?: string;
  messages: ConversationMessage[];
}

export interface AdminIntegration {
  id?: string;
  type: "webhook" | "telegram" | "whatsapp" | "twilio" | string;
  name: string;
  enabled: boolean;
  config: Record<string, string>;
  events: string[];
  created_at?: string;
}

export interface IntegrationLog {
  id: string;
  integration_id?: string;
  integration_type?: string;
  event: string;
  request_payload: unknown;
  status: "success" | "failed" | string;
  status_code?: number | null;
  response_body?: string;
  error_message?: string;
  created_at: string;
}

export function errorMessage(error: unknown, fallback = "حدث خطأ") {
  return error instanceof Error ? error.message : fallback;
}
