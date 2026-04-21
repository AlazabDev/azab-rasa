const TOKEN_KEY = "azabot_admin_token";
const API_ORIGIN = (
  (import.meta.env.VITE_CHAT_API_URL as string | undefined) ||
  window.location.origin
).replace(/\/$/, "");

export const adminToken = {
  get: () => localStorage.getItem(TOKEN_KEY),
  set: (t: string) => localStorage.setItem(TOKEN_KEY, t),
  clear: () => localStorage.removeItem(TOKEN_KEY),
};

export async function adminLogin(password: string) {
  const res = await fetch(`${API_ORIGIN}/admin/stats`, {
    method: "GET",
    headers: { "X-Admin-Token": password },
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.detail || data.error || "فشل الدخول");
  adminToken.set(password);
  return data;
}

export async function adminApi<T = unknown>(
  action: string,
  opts: { method?: string; body?: unknown; query?: Record<string, string> } = {},
): Promise<T> {
  const t = adminToken.get();
  if (!t) throw new Error("Not authenticated");
  const qs = new URLSearchParams({ action, ...(opts.query || {}) }).toString();
  const res = await fetch(`${API_ORIGIN}/admin/api?${qs}`, {
    method: opts.method || "POST",
    headers: { "Content-Type": "application/json", "X-Admin-Token": t },
    body: opts.method === "GET" ? undefined : JSON.stringify(opts.body || {}),
  });
  const data = await res.json();
  if (res.status === 401) {
    adminToken.clear();
    window.location.href = "/admin/login";
  }
  if (!res.ok) throw new Error(data.detail || data.error || "خطأ");
  return data as T;
}
