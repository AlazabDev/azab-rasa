/**
 * AzaBot Universal Embed Script v2.0
 * ─────────────────────────────────────────────────────────
 * أضفه في أي موقع بسطر واحد:
 *
 * <script src="https://chat.alazab.com/embed/azabot-embed.js"
 *         data-api="https://daraqtdmiwdszczwticd.supabase.co/functions/v1/chat-v2"
 *         data-key="SUPABASE_ANON_KEY"
 *         data-site="luxury-finishing">
 * </script>
 *
 * المتغيرات:
 *   data-site      : معرف الموقع (اختياري، يُكشف من النطاق)
 *   data-api       : رابط chat-v2 Edge Function
 *   data-key       : Supabase anon key
 *   data-position  : "bottom-right" | "bottom-left" (default: bottom-right)
 * ─────────────────────────────────────────────────────────
 */

(function () {
  "use strict";

  // ── منع التحميل المزدوج ──────────────────────────────────
  if (window.__AZABOT_LOADED__) return;
  window.__AZABOT_LOADED__ = true;

  // ── قراءة الإعدادات من السكريبت ──────────────────────────
  var scripts = document.querySelectorAll("script[data-api]");
  var scriptEl = scripts[scripts.length - 1];
  if (!scriptEl) return;

  var API_URL = scriptEl.getAttribute("data-api") || "";
  var API_KEY = scriptEl.getAttribute("data-key") || "";
  var SITE_ID = scriptEl.getAttribute("data-site") || "";
  var POSITION = scriptEl.getAttribute("data-position") || "bottom-right";
  var IS_RTL = POSITION === "bottom-right";

  if (!API_URL || !API_KEY) {
    console.warn("[AzaBot] data-api and data-key are required.");
    return;
  }

  // ── إعدادات المواقع ───────────────────────────────────────
  var SITE_THEMES = {
    "luxury-finishing": {
      botName: "عزبوت التشطيبات",
      color: "#C9A84C",
      header: "linear-gradient(135deg,#1a1208 0%,#3d2b0e 100%)",
      actions: ["ما هي خدمات التشطيبات؟","أريد عرض سعر","ما أنواع الرخام؟","كيف أتواصل معكم؟"],
      welcome: "مرحباً! أنا عزبوت التشطيبات 🏠",
      sub: "كيف أساعدك في تشطيب مشروعك؟",
    },
    "brand-identity": {
      botName: "عزبوت الهوية",
      color: "#E63946",
      header: "linear-gradient(135deg,#1a0a0a 0%,#3d0e0e 100%)",
      actions: ["أريد تصميم هوية بصرية","ما تكلفة تصميم شعار؟","خدمات التصميم","I need a logo"],
      welcome: "مرحباً! أنا عزبوت الهوية 🎨",
      sub: "كيف نساعدك في بناء علامتك التجارية؟",
    },
    "uberfix": {
      botName: "UberBot",
      color: "#F7B731",
      header: "linear-gradient(135deg,#0f0f0f 0%,#2d2000 100%)",
      actions: ["أريد حجز موعد صيانة","ما خدمات الطوارئ؟","Book a visit","AC repair prices?"],
      welcome: "Hi! I'm UberBot 🔧",
      sub: "How can I help with your maintenance needs?",
    },
    "laban-alasfour": {
      botName: "مساعد العصفور",
      color: "#2D9CDB",
      header: "linear-gradient(135deg,#0a1a2a 0%,#0e2d3d 100%)",
      actions: ["ما منتجاتكم؟","كيف أطلب بالجملة؟","هل توصلون للمنازل؟","أسعار الجبن"],
      welcome: "مرحباً! أنا مساعد العصفور 🥛",
      sub: "كيف أساعدك في منتجات الألبان؟",
    },
    "alazab": {
      botName: "عزبوت",
      color: "#C9A84C",
      header: "linear-gradient(135deg,#1a1f3a 0%,#2d3561 100%)",
      actions: ["ما هي شركات المجموعة؟","خدمات التشطيبات","خدمات التصميم","تواصل معنا"],
      welcome: "مرحباً! أنا عزبوت 👋",
      sub: "كيف يمكنني مساعدتك؟",
    },
  };

  // كشف الموقع من النطاق إذا لم يُحدد
  function detectSiteId() {
    if (SITE_ID) return SITE_ID;
    var host = window.location.hostname;
    for (var id in SITE_THEMES) {
      if (host.indexOf(id) !== -1) return id;
    }
    return "alazab";
  }

  var siteId = detectSiteId();
  var theme = SITE_THEMES[siteId] || SITE_THEMES["alazab"];

  // ── CSS ────────────────────────────────────────────────────
  var style = document.createElement("style");
  style.textContent = `
    #azabot-root *, #azabot-root *::before, #azabot-root *::after {
      box-sizing: border-box; margin: 0; padding: 0;
    }
    #azabot-root { font-family: "Tajawal", "Segoe UI", system-ui, sans-serif; direction: rtl; }
    #azabot-fab {
      position: fixed;
      ${IS_RTL ? "left: 24px" : "right: 24px"};
      bottom: 24px; z-index: 2147483646;
      width: 56px; height: 56px; border-radius: 50%;
      background: ${theme.color}; color: #1a1f3a;
      border: none; cursor: pointer;
      display: flex; align-items: center; justify-content: center;
      box-shadow: 0 8px 32px -8px ${theme.color}99;
      transition: transform 0.2s, box-shadow 0.2s;
      font-size: 24px;
    }
    #azabot-fab:hover { transform: scale(1.1); box-shadow: 0 12px 40px -8px ${theme.color}bb; }
    #azabot-fab:active { transform: scale(0.96); }
    #azabot-window {
      position: fixed;
      ${IS_RTL ? "left: 24px" : "right: 24px"};
      bottom: 24px; z-index: 2147483647;
      width: 380px; max-width: calc(100vw - 24px);
      height: 580px; max-height: calc(100svh - 32px);
      background: #fff; border-radius: 20px;
      box-shadow: 0 24px 64px -16px rgba(0,0,0,0.28);
      display: none; flex-direction: column; overflow: hidden;
      animation: az-slide-up 0.22s cubic-bezier(0.4,0,0.2,1) both;
    }
    #azabot-window.open { display: flex; }
    @keyframes az-slide-up {
      from { opacity:0; transform: translateY(12px) scale(0.97); }
      to   { opacity:1; transform: translateY(0) scale(1); }
    }
    .az-header {
      background: ${theme.header}; color: #fff; padding: 12px 14px;
      display: flex; align-items: center; justify-content: space-between;
      flex-shrink: 0;
    }
    .az-header-brand { text-align: right; flex: 1; }
    .az-header-brand .az-name { font-size: 15px; font-weight: 700; }
    .az-header-brand .az-status { font-size: 11px; opacity: 0.65; display: flex; align-items: center; gap: 4px; justify-content: flex-end; margin-top: 2px; }
    .az-dot { width: 6px; height: 6px; border-radius: 50%; background: ${theme.color}; animation: az-pulse 2s infinite; }
    @keyframes az-pulse { 0%,100%{opacity:1} 50%{opacity:0.4} }
    .az-btn-icon { background:rgba(255,255,255,0.12); border:none; cursor:pointer; border-radius: 8px; padding: 6px; color:#fff; line-height:1; display:flex; align-items:center; transition: background 0.15s; }
    .az-btn-icon:hover { background:rgba(255,255,255,0.22); }
    .az-messages {
      flex:1; overflow-y:auto; padding: 14px;
      display: flex; flex-direction: column; gap: 10px;
      scrollbar-width: thin; scrollbar-color: #e0e0e0 transparent;
    }
    .az-messages::-webkit-scrollbar { width: 4px; }
    .az-messages::-webkit-scrollbar-thumb { background: #e0e0e0; border-radius: 99px; }
    .az-bubble {
      max-width: 80%; display: flex; gap: 8px; animation: az-bubble-in 0.18s ease both;
    }
    @keyframes az-bubble-in { from{opacity:0;transform:translateY(6px)} to{opacity:1;transform:none} }
    .az-bubble.user { flex-direction: row-reverse; margin-left: auto; }
    .az-bubble .az-avatar {
      width: 30px; height: 30px; border-radius: 50%; flex-shrink: 0;
      display: flex; align-items: center; justify-content: center;
      font-size: 13px; font-weight: 700;
    }
    .az-bubble.user .az-avatar { background: #1a1f3a; color: ${theme.color}; }
    .az-bubble.bot .az-avatar { background: ${theme.color}; color: #1a1f3a; }
    .az-text {
      padding: 10px 13px; border-radius: 16px; font-size: 13.5px;
      line-height: 1.65; word-break: break-word;
    }
    .az-bubble.user .az-text { background: #1a1f3a; color: #fff; border-radius: 16px 2px 16px 16px; }
    .az-bubble.bot .az-text { background: #f3f4f6; color: #1a1f3a; border-radius: 2px 16px 16px 16px; }
    .az-welcome { text-align: center; padding: 16px 0; display: flex; flex-direction: column; align-items: center; gap: 8px; }
    .az-welcome .az-w-icon { width: 52px; height: 52px; border-radius: 16px; background: ${theme.color}22; display:flex; align-items:center; justify-content:center; font-size:24px; }
    .az-welcome h3 { font-size: 16px; font-weight: 700; color: #1a1f3a; }
    .az-welcome p { font-size: 13px; color: #6b7280; }
    .az-actions { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-top: 4px; width: 100%; }
    .az-action-btn {
      background: #fff; border: 1.5px solid #e5e7eb; border-radius: 99px;
      padding: 8px 10px; font-size: 12px; color: #1a1f3a;
      cursor: pointer; transition: border-color 0.15s, background 0.15s; line-height: 1.4;
      font-family: inherit;
    }
    .az-action-btn:hover { border-color: ${theme.color}; background: ${theme.color}0d; }
    .az-typing { display: flex; gap: 5px; padding: 10px 13px; background: #f3f4f6; border-radius: 2px 16px 16px 16px; width: fit-content; }
    .az-typing span { width: 7px; height: 7px; border-radius: 50%; background: ${theme.color}; animation: az-bounce 1.2s infinite; }
    .az-typing span:nth-child(2) { animation-delay: 0.12s; }
    .az-typing span:nth-child(3) { animation-delay: 0.24s; }
    @keyframes az-bounce { 0%,80%,100%{transform:translateY(0)} 40%{transform:translateY(-6px)} }
    .az-footer { padding: 10px 12px 12px; border-top: 1px solid #f0f0f0; background: #fff; flex-shrink: 0; }
    .az-input-row { display: flex; gap: 8px; align-items: flex-end; }
    .az-input {
      flex: 1; border: 1.5px solid #e5e7eb; border-radius: 12px;
      padding: 9px 12px; font-size: 13.5px; background: #f9fafb;
      resize: none; min-height: 38px; max-height: 96px; overflow-y: auto;
      outline: none; font-family: inherit; color: #1a1f3a; direction: rtl;
      transition: border-color 0.15s;
    }
    .az-input:focus { border-color: ${theme.color}; background: #fff; }
    .az-send {
      width: 38px; height: 38px; border-radius: 10px; border: none;
      background: ${theme.color}; color: #1a1f3a;
      cursor: pointer; display: flex; align-items: center; justify-content: center;
      transition: background 0.15s, transform 0.1s; flex-shrink: 0;
    }
    .az-send:hover { background: ${theme.color}dd; transform: scale(1.06); }
    .az-send:disabled { opacity: 0.45; cursor: default; transform: none; }
    .az-footer-note { text-align: center; font-size: 10.5px; color: #9ca3af; margin-top: 7px; }
    @media (prefers-color-scheme: dark) {
      #azabot-window { background: #111827; }
      .az-bubble.bot .az-text { background: #1f2937; color: #f9fafb; }
      .az-action-btn { background: #1f2937; border-color: #374151; color: #f9fafb; }
      .az-input { background: #1f2937; border-color: #374151; color: #f9fafb; }
      .az-input:focus { background: #111827; }
      .az-footer { background: #111827; border-top-color: #1f2937; }
      .az-typing { background: #1f2937; }
    }
  `;
  document.head.appendChild(style);

  // ── DOM ───────────────────────────────────────────────────
  var root = document.createElement("div");
  root.id = "azabot-root";
  document.body.appendChild(root);

  // FAB
  var fab = document.createElement("button");
  fab.id = "azabot-fab";
  fab.setAttribute("aria-label", "فتح عزبوت");
  fab.innerHTML = '<svg width="26" height="26" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12c0 1.74.5 3.37 1.36 4.74L2 22l5.26-1.36C8.63 21.5 10.26 22 12 22c5.52 0 10-4.48 10-10S17.52 2 12 2zm-1 13H7v-2h4v2zm6 0h-4v-2h4v2zm0-4H7V9h10v2z"/></svg>';
  root.appendChild(fab);

  // Window
  var win = document.createElement("div");
  win.id = "azabot-window";
  win.setAttribute("role", "dialog");
  win.setAttribute("aria-modal", "true");
  win.setAttribute("aria-label", "نافذة دردشة عزبوت");
  win.innerHTML = `
    <div class="az-header">
      <div class="az-btn-icon" id="az-close" role="button" aria-label="إغلاق" tabindex="0">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
      </div>
      <div class="az-header-brand">
        <div class="az-name">${theme.botName}</div>
        <div class="az-status"><span class="az-dot"></span>متصل الآن</div>
      </div>
      <div style="width:30px"></div>
    </div>
    <div class="az-messages" id="az-messages"></div>
    <div class="az-footer">
      <div class="az-input-row">
        <button class="az-send" id="az-send" aria-label="إرسال">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/></svg>
        </button>
        <textarea class="az-input" id="az-input" placeholder="اكتب رسالتك…" rows="1" aria-label="حقل الرسالة"></textarea>
      </div>
      <div class="az-footer-note">مدعوم بالذكاء الاصطناعي • قد يخطئ أحياناً</div>
    </div>
  `;
  root.appendChild(win);

  // ── State ──────────────────────────────────────────────────
  var isOpen = false;
  var isStreaming = false;
  var history = []; // {role, content}

  // ── Helpers ────────────────────────────────────────────────
  var messagesEl = document.getElementById("az-messages");
  var inputEl = document.getElementById("az-input");
  var sendBtn = document.getElementById("az-send");

  function showWelcome() {
    var el = document.createElement("div");
    el.className = "az-welcome";
    el.innerHTML = `
      <div class="az-w-icon">💬</div>
      <h3>${theme.welcome}</h3>
      <p>${theme.sub}</p>
      <div class="az-actions">
        ${theme.actions.map(function(q) {
          return '<button class="az-action-btn" data-q="' + q.replace(/"/g, "&quot;") + '">' + q + '</button>';
        }).join("")}
      </div>
    `;
    el.querySelectorAll(".az-action-btn").forEach(function(btn) {
      btn.addEventListener("click", function() { sendMessage(this.dataset.q); });
    });
    messagesEl.appendChild(el);
  }

  function appendBubble(role, content) {
    var wrap = document.createElement("div");
    wrap.className = "az-bubble " + role;
    var avatar = document.createElement("div");
    avatar.className = "az-avatar";
    avatar.textContent = role === "user" ? "أنا" : "🤖";
    var text = document.createElement("div");
    text.className = "az-text";
    text.textContent = content;
    wrap.appendChild(avatar);
    wrap.appendChild(text);
    messagesEl.appendChild(wrap);
    scrollBottom();
    return text;
  }

  function appendTyping() {
    var wrap = document.createElement("div");
    wrap.className = "az-bubble bot";
    wrap.id = "az-typing-wrap";
    var avatar = document.createElement("div");
    avatar.className = "az-avatar";
    avatar.textContent = "🤖";
    var dots = document.createElement("div");
    dots.className = "az-typing";
    dots.innerHTML = "<span></span><span></span><span></span>";
    wrap.appendChild(avatar);
    wrap.appendChild(dots);
    messagesEl.appendChild(wrap);
    scrollBottom();
    return wrap;
  }

  function removeTyping() {
    var el = document.getElementById("az-typing-wrap");
    if (el) el.remove();
  }

  function scrollBottom() {
    messagesEl.scrollTop = messagesEl.scrollHeight;
  }

  // ── Send ───────────────────────────────────────────────────
  async function sendMessage(text) {
    text = (text || "").trim();
    if (!text || isStreaming) return;

    // Clear welcome screen on first message
    var welcome = messagesEl.querySelector(".az-welcome");
    if (welcome) welcome.remove();

    appendBubble("user", text);
    history.push({ role: "user", content: text });
    inputEl.value = "";
    autoResize();

    isStreaming = true;
    sendBtn.disabled = true;

    var typingEl = appendTyping();
    var botTextEl = null;
    var accumulated = "";

    try {
      var resp = await fetch(API_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "apikey": API_KEY,
          "Authorization": "Bearer " + API_KEY,
        },
        body: JSON.stringify({
          messages: history.slice(-20),
          siteId: siteId,
          origin: window.location.origin,
        }),
      });

      if (resp.status === 429) throw new Error("تم تجاوز حد الطلبات. انتظر دقيقة.");
      if (!resp.ok) throw new Error("خطأ في الخادم (" + resp.status + ").");

      removeTyping();
      botTextEl = appendBubble("bot", "").parentElement.querySelector(".az-text");
      // في الواقع نحتاج مرجع صحيح
      var botWrap = messagesEl.lastElementChild;
      botTextEl = botWrap.querySelector(".az-text");

      var reader = resp.body.getReader();
      var decoder = new TextDecoder();
      var buf = "";

      while (true) {
        var readResult = await reader.read();
        if (readResult.done) break;
        buf += decoder.decode(readResult.value, { stream: true });
        var nl;
        while ((nl = buf.indexOf("\n")) !== -1) {
          var line = buf.slice(0, nl).trimEnd();
          buf = buf.slice(nl + 1);
          if (!line.startsWith("data: ")) continue;
          var json = line.slice(6).trim();
          if (json === "[DONE]") { break; }
          try {
            var parsed = JSON.parse(json);
            var chunk = parsed.choices?.[0]?.delta?.content || "";
            if (chunk) {
              accumulated += chunk;
              botTextEl.textContent = accumulated;
              scrollBottom();
            }
          } catch (e) { /* skip */ }
        }
      }

      if (accumulated) {
        history.push({ role: "assistant", content: accumulated });
      }

    } catch (err) {
      removeTyping();
      appendBubble("bot", err.message || "حدث خطأ. حاول مرة أخرى.");
    } finally {
      isStreaming = false;
      sendBtn.disabled = false;
      inputEl.focus();
    }
  }

  // ── Auto-resize textarea ───────────────────────────────────
  function autoResize() {
    inputEl.style.height = "auto";
    inputEl.style.height = Math.min(inputEl.scrollHeight, 96) + "px";
  }

  // ── Event Listeners ────────────────────────────────────────
  fab.addEventListener("click", function() {
    isOpen = true;
    fab.style.display = "none";
    win.classList.add("open");
    if (messagesEl.children.length === 0) showWelcome();
    inputEl.focus();
  });

  document.getElementById("az-close").addEventListener("click", function() {
    isOpen = false;
    win.classList.remove("open");
    fab.style.display = "flex";
  });

  sendBtn.addEventListener("click", function() { sendMessage(inputEl.value); });

  inputEl.addEventListener("keydown", function(e) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage(this.value);
    }
  });

  inputEl.addEventListener("input", autoResize);

  // Keyboard: Escape يغلق
  document.addEventListener("keydown", function(e) {
    if (e.key === "Escape" && isOpen) {
      isOpen = false;
      win.classList.remove("open");
      fab.style.display = "flex";
    }
  });

})();
