(function () {
  'use strict';

  const cfg = window.AzaBotConfig || {};
  const scriptUrl = document.currentScript?.src ? new URL(document.currentScript.src) : null;
  const apiOrigin = String(cfg.apiOrigin || cfg.apiUrl || scriptUrl?.origin || location.origin).replace(/\/$/, '');
  const host = String(cfg.siteHost || location.hostname || '').toLowerCase();
  const position = cfg.position === 'bottom-left' ? 'left' : 'right';

  const sites = {
    'alazab.com': { brand: 'alazab_construction', subtitle: 'المساعد الذكي - متصل الآن', replies: ['ما هي خدمات الشركة؟', 'أريد عرض سعر تشطيب', 'ما هي فروع الشركة؟', 'كيف أتواصل معكم؟'] },
    'www.alazab.com': { brand: 'alazab_construction', subtitle: 'المساعد الذكي - متصل الآن', replies: ['ما هي خدمات الشركة؟', 'أريد عرض سعر تشطيب', 'ما هي فروع الشركة؟', 'كيف أتواصل معكم؟'] },
    'brand-identity.alazab.com': { brand: 'brand_identity', subtitle: 'مستشار الهوية الذكية - متصل الآن', replies: ['أريد عرض سعر تشطيب', 'ما هي خدمات الشركة؟', 'ما هي أسعار التشطيب؟', 'ما هي فروع الشركة؟'] },
    'laban-alasfour.alazab.com': { brand: 'laban_alasfour', subtitle: 'مستشار التوريدات - متصل الآن', replies: ['أريد كتالوج المنتجات', 'هل يوجد توريد جملة؟', 'ما هي مناطق التغطية؟', 'كيف أطلب عرض سعر؟'] },
    'luxury-finishing.alazab.com': { brand: 'luxury_finishing', subtitle: 'مستشار التشطيبات - متصل الآن', replies: ['ما هي أسعار التشطيب؟', 'أريد عرض سعر تشطيب', 'ما هي الخدمات المتاحة؟', 'هل توجد معاينة؟'] },
    'uberfix.alazab.com': { brand: 'uberfix', subtitle: 'مستشار الصيانة - متصل الآن', replies: ['أريد طلب صيانة', 'هل توجد خدمة طوارئ؟', 'ما هي مناطق العمل؟', 'كيف أتابع طلبي؟'] },
  };
  const site = Object.assign({
    brand: 'alazab_construction',
    subtitle: 'المساعد الذكي - متصل الآن',
    replies: ['ما هي خدمات الشركة؟', 'أريد عرض سعر', 'ما هي فروع الشركة؟', 'كيف أتواصل معكم؟'],
  }, sites[host] || {}, cfg.profile || {});
  if (cfg.brand) site.brand = cfg.brand;

  const navItems = cfg.navItems || [
    { label: 'الرئيسية', href: `${location.origin}/` },
    { label: 'خدماتنا', href: `${location.origin}/services` },
    { label: 'مشاريعنا', href: `${location.origin}/projects` },
    { label: 'طلب عرض سعر', href: `${location.origin}/quote` },
    { label: 'من نحن', href: `${location.origin}/about` },
    { label: 'تواصل معنا', href: `${location.origin}/contact` },
  ];

  const storageKey = cfg.storageKey || `azabot_history_${host || 'default'}_${site.brand}`;
  const senderKey = cfg.senderKey || `azabot_sender_${host || 'default'}`;
  const state = {
    open: false,
    tab: 'text',
    nav: false,
    unread: 0,
    history: load(storageKey),
    senderId: getSender(senderKey),
    recorder: null,
    stream: null,
    chunks: [],
    recording: false,
  };

  injectStyles();
  const root = document.createElement('div');
  root.className = `azw ${position}`;
  root.innerHTML = `
    <div class="azw-panel" data-panel>
      <header class="azw-head">
        <button class="azw-ib" data-menu>${iconGrid()}</button>
        <div class="azw-title"><strong>عزبوت (AzaBot)</strong><span>${site.subtitle}</span></div>
        <div class="azw-head-actions">
          <button class="azw-ib" data-export>${iconDownload()}</button>
          <button class="azw-ib" data-close>×</button>
        </div>
      </header>
      <div class="azw-tabs">
        <button class="azw-tab on" data-tab-btn="text">${iconChat()}<span>محادثة نصية</span></button>
        <button class="azw-tab" data-tab-btn="voice">${iconMic()}<span>محادثة صوتية</span></button>
      </div>
      <div class="azw-nav" data-nav><div class="azw-nav-list"></div></div>
      <section class="azw-body" data-pane="text">
        <div class="azw-welcome" data-welcome>
          <div class="azw-wicon">${iconChat()}</div>
          <h4>مرحبًا! أنا عزبوت 👋</h4>
          <p>كيف يمكنني مساعدتك؟</p>
          <div class="azw-replies">${site.replies.map((r) => `<button class="azw-chip" data-reply="${escAttr(r)}">${esc(r)}</button>`).join('')}</div>
        </div>
        <div class="azw-messages" data-messages></div>
      </section>
      <section class="azw-voice" data-pane="voice" style="display:none">
        <div class="azw-pulse" data-pulse>${iconMic()}</div>
        <div class="azw-vlabel" data-vlabel>اضغط للتحدث مع عزبوت</div>
        <button class="azw-record" data-record>ابدأ</button>
        <div class="azw-foot small">تُرفع الملاحظة الصوتية إلى الخادم لمعالجتها.</div>
      </section>
      <footer class="azw-foot">
        <div class="azw-input">
          <button class="azw-tool azw-send" data-send>${iconSend()}</button>
          <button class="azw-tool" data-attach>${iconClip()}</button>
          <textarea data-text rows="1" placeholder="اكتب رسالتك..."></textarea>
        </div>
        <div class="azw-footnote">مدعوم بالذكاء الاصطناعي - قد يخطئ أحيانًا</div>
        <input type="file" data-file hidden accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.jpg,.jpeg,.png,.webp,.gif,.txt,.csv,.zip">
      </footer>
    </div>
    <button class="azw-launcher" data-launcher>${iconChat()}<span class="azw-badge" data-badge style="display:none">0</span></button>
  `;
  document.body.appendChild(root);

  const el = {
    panel: root.querySelector('[data-panel]'),
    launcher: root.querySelector('[data-launcher]'),
    badge: root.querySelector('[data-badge]'),
    nav: root.querySelector('[data-nav]'),
    navList: root.querySelector('.azw-nav-list'),
    messages: root.querySelector('[data-messages]'),
    welcome: root.querySelector('[data-welcome]'),
    text: root.querySelector('[data-text]'),
    send: root.querySelector('[data-send]'),
    file: root.querySelector('[data-file]'),
    pulse: root.querySelector('[data-pulse]'),
    vlabel: root.querySelector('[data-vlabel]'),
    record: root.querySelector('[data-record]'),
    textPane: root.querySelector('[data-pane="text"]'),
    voicePane: root.querySelector('[data-pane="voice"]'),
    tabButtons: Array.from(root.querySelectorAll('[data-tab-btn]')),
  };

  navItems.forEach((item) => {
    const btn = document.createElement('button');
    btn.className = 'azw-nav-item';
    btn.type = 'button';
    btn.textContent = item.label;
    btn.addEventListener('click', () => {
      state.nav = false;
      syncNav();
      if (item.href) window.location.href = item.href;
      if (item.message) sendText(item.message);
    });
    el.navList.appendChild(btn);
  });

  root.querySelector('[data-close]').addEventListener('click', () => setOpen(false));
  root.querySelector('[data-menu]').addEventListener('click', () => { state.nav = !state.nav; syncNav(); });
  root.querySelector('[data-export]').addEventListener('click', downloadTranscript);
  root.querySelector('[data-attach]').addEventListener('click', () => el.file.click());
  el.launcher.addEventListener('click', () => setOpen(!state.open));
  el.send.addEventListener('click', () => sendText());
  el.text.addEventListener('input', syncSendState);
  el.text.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      sendText();
    }
  });
  el.file.addEventListener('change', onFileSelect);
  root.querySelectorAll('[data-reply]').forEach((btn) => btn.addEventListener('click', () => sendText(btn.dataset.reply || '')));
  el.tabButtons.forEach((btn) => btn.addEventListener('click', () => setTab(btn.dataset.tabBtn || 'text')));
  el.record.addEventListener('click', toggleRecording);

  render();
  syncSendState();
  setTimeout(() => { if (!state.open && !state.history.length) bumpUnread(); }, 2500);

  function setOpen(value) {
    state.open = !!value;
    el.panel.classList.toggle('open', state.open);
    if (state.open) {
      state.unread = 0;
      syncBadge();
      setTimeout(() => el.text.focus(), 80);
    }
  }

  function setTab(tab) {
    state.tab = tab === 'voice' ? 'voice' : 'text';
    el.tabButtons.forEach((btn) => btn.classList.toggle('on', btn.dataset.tabBtn === state.tab));
    el.textPane.style.display = state.tab === 'text' ? 'flex' : 'none';
    el.voicePane.style.display = state.tab === 'voice' ? 'flex' : 'none';
  }

  function syncNav() {
    el.nav.classList.toggle('open', state.nav);
  }

  function syncSendState() {
    el.send.disabled = !String(el.text.value || '').trim();
  }

  function render() {
    el.welcome.style.display = state.history.length ? 'none' : 'flex';
    el.messages.innerHTML = '';
    state.history.forEach((msg) => {
      const row = document.createElement('div');
      row.className = `azw-msg ${msg.sender}`;
      const bubble = document.createElement('div');
      bubble.className = 'azw-bubble';
      if (msg.attachment) bubble.appendChild(renderAttachment(msg));
      if (msg.text) {
        const text = document.createElement('div');
        text.className = 'azw-text';
        text.innerHTML = esc(msg.text).replace(/\n/g, '<br>');
        bubble.appendChild(text);
      }
      if (Array.isArray(msg.buttons) && msg.buttons.length) {
        const actions = document.createElement('div');
        actions.className = 'azw-actions';
        msg.buttons.forEach((button) => {
          const btn = document.createElement('button');
          btn.type = 'button';
          btn.textContent = button.title || button.payload || 'متابعة';
          btn.addEventListener('click', () => sendText(button.payload || button.title || ''));
          actions.appendChild(btn);
        });
        bubble.appendChild(actions);
      }
      const time = document.createElement('div');
      time.className = 'azw-time';
      time.textContent = `${clock(msg.timestamp)}${msg.pending ? ' • جاري الإرسال' : ''}`;
      bubble.appendChild(time);
      row.appendChild(bubble);
      el.messages.appendChild(row);
    });
    el.messages.scrollTop = el.messages.scrollHeight;
  }

  function renderAttachment(msg) {
    const wrap = document.createElement('div');
    wrap.className = msg.kind === 'audio' ? 'azw-audio' : 'azw-attach';
    if (msg.kind === 'audio') {
      wrap.innerHTML = `<div class="azw-ahead">${iconMic()}<strong>ملاحظة صوتية</strong></div>`;
      if (msg.attachment.url) {
        const audio = document.createElement('audio');
        audio.controls = true;
        audio.preload = 'none';
        audio.src = msg.attachment.url;
        wrap.appendChild(audio);
      }
    } else {
      wrap.innerHTML = `<div class="azw-icon">${iconClip()}</div><div class="azw-meta"><strong>${esc(msg.attachment.name || 'ملف')}</strong><span>${bytes(msg.attachment.size || 0)}</span></div>`;
      if (msg.attachment.url) {
        const link = document.createElement('a');
        link.href = msg.attachment.url;
        link.target = '_blank';
        link.rel = 'noopener noreferrer';
        link.textContent = 'فتح';
        wrap.appendChild(link);
      }
    }
    return wrap;
  }

  function addMessage(message) {
    state.history.push(Object.assign({
      id: `m_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      timestamp: new Date().toISOString(),
      sender: 'bot',
      buttons: [],
      pending: false,
    }, message));
    save(storageKey, state.history);
    render();
    if (!state.open && message.sender === 'bot') bumpUnread();
    return state.history[state.history.length - 1].id;
  }

  function updateMessage(id, patch) {
    const target = state.history.find((item) => item.id === id);
    if (!target) return;
    Object.assign(target, patch);
    save(storageKey, state.history);
    render();
  }

  function typing(on) {
    el.messages.querySelector('[data-typing]')?.remove();
    if (!on) return;
    const row = document.createElement('div');
    row.className = 'azw-msg bot';
    row.dataset.typing = '1';
    row.innerHTML = '<div class="azw-bubble azw-typing"><span></span><span></span><span></span></div>';
    el.messages.appendChild(row);
    el.messages.scrollTop = el.messages.scrollHeight;
  }

  async function sendText(text) {
    const value = String(text || el.text.value || '').trim();
    if (!value) return;
    el.text.value = '';
    syncSendState();
    state.nav = false;
    syncNav();
    addMessage({ sender: 'user', kind: 'text', text: value });
    typing(true);
    try {
      const response = await fetch(`${apiOrigin}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sender_id: state.senderId, message: value, brand: site.brand, channel: 'website', site_host: host }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.detail || 'chat failed');
      typing(false);
      pushBot(payload.responses);
    } catch {
      typing(false);
      addMessage({ sender: 'bot', kind: 'text', text: 'حدثت مشكلة مؤقتة أثناء الاتصال. حاول مرة أخرى خلال لحظات.' });
    }
  }

  async function onFileSelect(event) {
    const file = event.target.files && event.target.files[0];
    el.file.value = '';
    if (!file) return;
    const tempUrl = URL.createObjectURL(file);
    const messageId = addMessage({ sender: 'user', kind: 'file', text: `تم إرفاق الملف: ${file.name}`, attachment: { name: file.name, size: file.size, url: tempUrl }, pending: true });
    typing(true);
    try {
      const form = new FormData();
      form.append('sender_id', state.senderId);
      form.append('brand', site.brand);
      form.append('channel', 'website');
      form.append('site_host', host);
      form.append('file', file);
      const response = await fetch(`${apiOrigin}/chat/upload`, { method: 'POST', body: form });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.detail || 'upload failed');
      typing(false);
      updateMessage(messageId, { pending: false, attachment: payload.attachment || { name: file.name, size: file.size, url: tempUrl } });
      pushBot(payload.responses);
    } catch {
      typing(false);
      updateMessage(messageId, { pending: false, text: `تعذر رفع الملف: ${file.name}` });
      addMessage({ sender: 'bot', kind: 'text', text: 'تعذر إرسال الملف الآن. تأكد من أن نوع الملف مدعوم وحجمه مناسب ثم أعد المحاولة.' });
    }
  }

  async function toggleRecording() {
    if (state.recording) {
      state.recorder?.stop();
      return;
    }
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia || typeof MediaRecorder === 'undefined') {
      addMessage({ sender: 'bot', kind: 'text', text: 'هذا المتصفح لا يدعم تسجيل الملاحظات الصوتية.' });
      setTab('text');
      return;
    }
    try {
      state.stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      state.chunks = [];
      state.recorder = new MediaRecorder(state.stream);
      state.recorder.ondataavailable = (e) => { if (e.data && e.data.size) state.chunks.push(e.data); };
      state.recorder.onstop = onRecordStop;
      state.recorder.start();
      state.recording = true;
      el.record.classList.add('rec');
      el.pulse.classList.add('rec');
      el.record.textContent = 'إيقاف';
      el.vlabel.textContent = 'جاري التسجيل الآن... اضغط مرة أخرى للإيقاف';
    } catch {
      el.vlabel.textContent = 'تعذر الوصول إلى الميكروفون';
      setTimeout(() => { el.vlabel.textContent = 'اضغط للتحدث مع عزبوت'; }, 2200);
    }
  }

  async function onRecordStop() {
    state.recording = false;
    el.record.classList.remove('rec');
    el.pulse.classList.remove('rec');
    el.record.textContent = 'ابدأ';
    el.vlabel.textContent = 'جاري تجهيز الملاحظة الصوتية...';
    const mime = state.recorder?.mimeType || 'audio/webm';
    const ext = mime.includes('mp4') ? 'm4a' : 'webm';
    const blob = new Blob(state.chunks, { type: mime });
    state.stream?.getTracks().forEach((track) => track.stop());
    state.stream = null;
    state.chunks = [];
    state.recorder = null;
    if (!blob.size) {
      el.vlabel.textContent = 'لم يتم تسجيل صوت. حاول مرة أخرى.';
      return;
    }
    setTab('text');
    const tempUrl = URL.createObjectURL(blob);
    const filename = `voice-note-${Date.now()}.${ext}`;
    const messageId = addMessage({ sender: 'user', kind: 'audio', text: 'تم إرسال ملاحظة صوتية', attachment: { name: filename, size: blob.size, url: tempUrl }, pending: true });
    typing(true);
    try {
      const form = new FormData();
      form.append('sender_id', state.senderId);
      form.append('brand', site.brand);
      form.append('channel', 'website');
      form.append('site_host', host);
      form.append('file', blob, filename);
      const response = await fetch(`${apiOrigin}/chat/audio`, { method: 'POST', body: form });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.detail || 'audio failed');
      typing(false);
      updateMessage(messageId, { pending: false, text: payload.transcript ? `النص المفرغ: ${payload.transcript}` : 'تم إرسال ملاحظة صوتية', attachment: payload.attachment || { name: filename, size: blob.size, url: tempUrl } });
      pushBot(payload.responses);
      el.vlabel.textContent = 'اضغط للتحدث مع عزبوت';
    } catch {
      typing(false);
      updateMessage(messageId, { pending: false, text: 'تعذر إرسال الملاحظة الصوتية' });
      addMessage({ sender: 'bot', kind: 'text', text: 'تعذر إرسال الملاحظة الصوتية الآن. حاول مرة أخرى بعد لحظات.' });
      el.vlabel.textContent = 'اضغط للتحدث مع عزبوت';
    }
  }

  function pushBot(responses) {
    const items = Array.isArray(responses) ? responses : [];
    if (!items.length) {
      addMessage({ sender: 'bot', kind: 'text', text: 'تم استلام رسالتك. إذا أردت، أرسل مزيدًا من التفاصيل وسأكمل معك.' });
      return;
    }
    items.forEach((item) => addMessage({ sender: 'bot', kind: 'text', text: item.text || 'تم استلام رسالتك.', buttons: Array.isArray(item.buttons) ? item.buttons : [] }));
  }

  function downloadTranscript() {
    const lines = [`AzaBot Transcript`, `Site: ${host || 'unknown'}`, `Brand: ${site.brand}`, `Generated: ${new Date().toISOString()}`, ''];
    state.history.forEach((msg) => {
      lines.push(`[${clock(msg.timestamp)}] ${msg.sender === 'user' ? 'المستخدم' : 'البوت'}: ${msg.text || ''}`);
      if (msg.attachment) lines.push(`  - attachment: ${msg.attachment.name || ''} ${msg.attachment.url || ''}`);
    });
    const blob = new Blob([lines.join('\n')], { type: 'text/plain;charset=utf-8' });
    const href = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = href;
    link.download = `azabot-${(host || 'chat').replace(/[^\w.-]+/g, '-')}-${Date.now()}.txt`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(href), 500);
  }

  function bumpUnread() {
    state.unread += 1;
    syncBadge();
  }

  function syncBadge() {
    el.badge.style.display = state.unread > 0 ? 'inline-flex' : 'none';
    el.badge.textContent = String(state.unread);
  }

  function load(key) {
    try {
      const value = JSON.parse(localStorage.getItem(key) || '[]');
      return Array.isArray(value) ? value : [];
    } catch {
      return [];
    }
  }

  function save(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); } catch {}
  }

  function getSender(key) {
    let value = localStorage.getItem(key);
    if (!value) {
      value = `az_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
      localStorage.setItem(key, value);
    }
    return value;
  }

  function clock(value) {
    return new Date(value || Date.now()).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' });
  }

  function bytes(value) {
    if (!value) return 'بدون حجم';
    if (value < 1024) return `${value} B`;
    if (value < 1048576) return `${(value / 1024).toFixed(1)} KB`;
    return `${(value / 1048576).toFixed(1)} MB`;
  }

  function esc(value) {
    return String(value || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  function escAttr(value) {
    return esc(value).replace(/"/g, '&quot;');
  }

  function iconChat() { return '<svg viewBox="0 0 24 24" fill="none"><path d="M6 6.5A2.5 2.5 0 0 1 8.5 4h7A2.5 2.5 0 0 1 18 6.5v5A2.5 2.5 0 0 1 15.5 14H10l-4 4v-4.5A2.5 2.5 0 0 1 3.5 11V6.5A2.5 2.5 0 0 1 6 4.5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>'; }
  function iconMic() { return '<svg viewBox="0 0 24 24" fill="none"><path d="M12 4a3 3 0 0 1 3 3v4a3 3 0 1 1-6 0V7a3 3 0 0 1 3-3Z" stroke="currentColor" stroke-width="1.8"/><path d="M18 11a6 6 0 1 1-12 0" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/><path d="M12 17v3" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>'; }
  function iconClip() { return '<svg viewBox="0 0 24 24" fill="none"><path d="M8.5 12.5l5.8-5.8a3 3 0 1 1 4.2 4.2l-7.6 7.6a5 5 0 1 1-7.1-7.1l8.2-8.2" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>'; }
  function iconSend() { return '<svg viewBox="0 0 24 24" fill="none"><path d="M21 3 10 14" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/><path d="m21 3-7 18-4-8-8-4 19-6Z" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>'; }
  function iconDownload() { return '<svg viewBox="0 0 24 24" fill="none"><path d="M12 4v9" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/><path d="m8.5 10.5 3.5 3.5 3.5-3.5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/><path d="M5 18h14" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>'; }
  function iconGrid() { return '<svg viewBox="0 0 24 24" fill="none"><path d="M5 5h5v5H5zM14 5h5v5h-5zM5 14h5v5H5zM14 14h5v5h-5z" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/></svg>'; }

  function injectStyles() {
    if (document.getElementById('azabot-widget-styles')) return;
    const style = document.createElement('style');
    style.id = 'azabot-widget-styles';
    style.textContent = `
      .azw,.azw *{box-sizing:border-box;font-family:"Cairo",system-ui,sans-serif}.azw{position:fixed;bottom:20px;z-index:2147483644;direction:rtl}.azw.right{right:20px}.azw.left{left:20px}
      .azw-launcher{width:58px;height:58px;border:0;border-radius:50%;background:linear-gradient(180deg,#f5cf6a,#efb72b);color:#10203a;display:inline-flex;align-items:center;justify-content:center;box-shadow:0 18px 42px rgba(12,22,48,.28);cursor:pointer;position:relative}.azw-launcher svg{width:24px;height:24px}.azw-badge{position:absolute;top:-4px;left:-4px;min-width:22px;height:22px;border-radius:999px;background:#ef4444;color:#fff;font-size:11px;font-weight:800;display:inline-flex;align-items:center;justify-content:center;padding:0 6px;border:2px solid #fff}
      .azw-panel{position:absolute;bottom:74px;right:0;width:360px;max-width:calc(100vw - 24px);height:620px;max-height:calc(100vh - 88px);display:none;flex-direction:column;overflow:hidden;border-radius:24px;background:#fff;border:1px solid #e8ebf2;box-shadow:0 28px 72px rgba(12,22,48,.25)}.azw.left .azw-panel{right:auto;left:0}.azw-panel.open{display:flex}
      .azw-head{min-height:68px;background:linear-gradient(180deg,#04133d,#081845);color:#fff;padding:10px 14px;display:grid;grid-template-columns:36px 1fr auto;align-items:center;gap:10px}.azw-title{display:flex;flex-direction:column;align-items:center;text-align:center}.azw-title strong{font-size:16px}.azw-title span{font-size:12px;color:#d7e0ff}.azw-head-actions{display:inline-flex;gap:6px}.azw-ib{width:34px;height:34px;border-radius:50%;border:0;background:rgba(255,255,255,.12);color:#fff;display:inline-flex;align-items:center;justify-content:center;cursor:pointer}.azw-ib svg{width:18px;height:18px}
      .azw-tabs{display:grid;grid-template-columns:1fr 1fr;border-bottom:1px solid #e6eaf1}.azw-tab{height:46px;border:0;background:#fff;color:#7b8599;font-size:14px;font-weight:700;display:inline-flex;align-items:center;justify-content:center;gap:8px;cursor:pointer;position:relative}.azw-tab svg{width:16px;height:16px}.azw-tab.on{color:#101f39}.azw-tab.on:after{content:"";position:absolute;right:12px;left:12px;bottom:0;height:2px;background:#e3b22c}
      .azw-nav{max-height:0;overflow:hidden;background:#fff;transition:max-height .22s ease;border-bottom:1px solid #eef1f6}.azw-nav.open{max-height:260px}.azw-nav-list{padding:8px 12px 12px;display:grid;gap:8px}.azw-nav-item{min-height:42px;border:1px solid #e4e8f0;border-radius:12px;background:#fff;color:#14233f;font-size:14px;font-weight:700;cursor:pointer}
      .azw-body{flex:1;display:flex;flex-direction:column;background:#fff}.azw-welcome{flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:26px 20px 14px;text-align:center}.azw-wicon{width:66px;height:66px;border-radius:20px;background:linear-gradient(180deg,#fff8df,#fff0ba);color:#d49e14;display:inline-flex;align-items:center;justify-content:center;margin-bottom:18px}.azw-wicon svg{width:30px;height:30px}.azw-welcome h4{margin:0 0 8px;font-size:28px;line-height:1.2;color:#11203b;font-weight:800}.azw-welcome p{margin:0 0 18px;font-size:18px;color:#7a8396}.azw-replies{width:100%;display:grid;grid-template-columns:1fr 1fr;gap:10px}.azw-chip{min-height:40px;border-radius:999px;border:1px solid #dfe5ee;background:#fff;color:#1c2a42;font-size:14px;font-weight:700;cursor:pointer;padding:8px 12px}
      .azw-messages{flex:1;overflow-y:auto;padding:16px;display:flex;flex-direction:column;gap:12px;background:#fff}.azw-msg{display:flex}.azw-msg.user{justify-content:flex-start}.azw-msg.bot{justify-content:flex-end}.azw-bubble{max-width:84%;border-radius:18px;padding:12px 14px;background:#fff;border:1px solid #e4e9f0;color:#213149;box-shadow:0 10px 22px rgba(15,24,42,.06)}.azw-msg.user .azw-bubble{background:#f8fafc;border-color:#edf1f7;border-bottom-left-radius:8px}.azw-msg.bot .azw-bubble{border-bottom-right-radius:8px}.azw-text{font-size:14px;line-height:1.8}.azw-time{margin-top:8px;font-size:11px;color:#8d96a8}.azw-actions{display:flex;flex-wrap:wrap;gap:8px;margin-top:10px}.azw-actions button{min-height:34px;border-radius:999px;border:1px solid #d7deea;background:#fff;color:#15243e;font-size:13px;cursor:pointer;padding:6px 12px}
      .azw-attach,.azw-audio{border:1px solid #e7ebf2;border-radius:14px;padding:10px;background:#fbfcfe;margin-bottom:8px}.azw-attach{display:flex;align-items:center;gap:10px}.azw-icon{width:34px;height:34px;border-radius:10px;background:#eef3fb;color:#10203a;display:inline-flex;align-items:center;justify-content:center;flex-shrink:0}.azw-icon svg,.azw-ahead svg{width:16px;height:16px}.azw-meta{display:flex;flex-direction:column;gap:3px;min-width:0}.azw-meta strong{font-size:13px;color:#12203a;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.azw-meta span{font-size:11px;color:#7d8799}.azw-attach a{margin-inline-start:auto;color:#0d4db3;font-size:12px;font-weight:700;text-decoration:none}.azw-ahead{display:flex;align-items:center;gap:8px;margin-bottom:10px;font-size:13px;color:#11203a}.azw-audio audio{width:100%}
      .azw-typing{display:inline-flex;align-items:center;gap:5px;min-width:70px}.azw-typing span{width:8px;height:8px;border-radius:50%;background:#9aa4b5;animation:azwp 1.2s infinite ease-in-out}.azw-typing span:nth-child(2){animation-delay:.15s}.azw-typing span:nth-child(3){animation-delay:.3s}@keyframes azwp{0%,80%,100%{transform:scale(.85);opacity:.45}40%{transform:scale(1);opacity:1}}
      .azw-voice{flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:18px;text-align:center;padding:34px 24px;background:#fff}.azw-pulse{width:114px;height:114px;border-radius:50%;background:#f3f5fb;color:#6d7d96;border:2px solid #e8edf5;display:inline-flex;align-items:center;justify-content:center}.azw-pulse svg{width:34px;height:34px}.azw-pulse.rec{color:#0b1b39;border-color:#f1c13d;box-shadow:0 0 0 14px rgba(241,193,61,.14),0 0 0 28px rgba(241,193,61,.08)}.azw-vlabel{font-size:22px;line-height:1.5;color:#667387}.azw-record{min-width:120px;min-height:52px;border-radius:999px;border:0;background:#0a1a4b;color:#fff;font-size:16px;font-weight:800;cursor:pointer;box-shadow:0 14px 34px rgba(10,26,75,.22)}.azw-record.rec{background:#d64545}
      .azw-foot{padding:12px 12px 10px;border-top:1px solid #edf1f6;background:#fff}.azw-foot.small{padding:0;border:0;background:transparent;color:#8a93a5;font-size:12px}.azw-input{display:flex;align-items:center;gap:8px;direction:ltr}.azw-input textarea{flex:1;min-height:46px;max-height:110px;resize:none;border:0;border-radius:16px;background:#f2f4f8;padding:12px 14px;font-size:14px;color:#15243e;outline:none;direction:rtl}.azw-tool{width:40px;height:40px;border-radius:50%;border:0;background:#eef2fa;color:#65748a;display:inline-flex;align-items:center;justify-content:center;cursor:pointer;flex-shrink:0}.azw-tool svg{width:18px;height:18px}.azw-send{background:linear-gradient(180deg,#f5cf6a,#efb72b);color:#10203a}.azw-tool:disabled{opacity:.45;cursor:not-allowed}.azw-footnote{text-align:center;font-size:11px;color:#98a2b3;margin-top:8px}
      @media (max-width:640px){.azw.right{right:10px}.azw.left{left:10px;right:10px}.azw-panel{width:min(360px,calc(100vw - 20px));height:min(620px,calc(100vh - 82px))}.azw-welcome h4{font-size:22px}.azw-welcome p,.azw-vlabel{font-size:16px}}
    `;
    document.head.appendChild(style);
  }

  window.__AZ = {
    toggle: () => setOpen(!state.open),
    send: (message) => sendText(message),
    tab: (tab) => setTab(tab === 'v' ? 'voice' : 'text'),
    clear: () => { state.history = []; save(storageKey, state.history); render(); },
  };

  window.AlazabChatWidget = {
    open: () => setOpen(true),
    close: () => setOpen(false),
    toggle: () => setOpen(!state.open),
    send: (message) => sendText(message),
    getState: () => ({ isOpen: state.open, brand: site.brand, senderId: state.senderId, history: [...state.history] }),
  };
})();
