const state = {
  overview: null,
};

const nodes = {
  healthStatus: document.getElementById('healthStatus'),
  healthMeta: document.getElementById('healthMeta'),
  modelsCount: document.getElementById('modelsCount'),
  docsCount: document.getElementById('docsCount'),
  defaultBrand: document.getElementById('defaultBrand'),
  flagsGrid: document.getElementById('flagsGrid'),
  brandsList: document.getElementById('brandsList'),
  modelsList: document.getElementById('modelsList'),
  docsList: document.getElementById('docsList'),
  responseBox: document.getElementById('responseBox'),
  trackerBox: document.getElementById('trackerBox'),
  senderIdInput: document.getElementById('senderIdInput'),
  messageInput: document.getElementById('messageInput'),
  brandSelect: document.getElementById('brandSelect'),
  widgetBrandSelect: document.getElementById('widgetBrandSelect'),
  widgetApiUrl: document.getElementById('widgetApiUrl'),
  widgetLauncherTitle: document.getElementById('widgetLauncherTitle'),
  widgetHeaderTitle: document.getElementById('widgetHeaderTitle'),
  embedSnippet: document.getElementById('embedSnippet'),
  invokeSnippet: document.getElementById('invokeSnippet'),
  appVersion: document.getElementById('appVersion'),
};

function setActiveView(viewId) {
  document.querySelectorAll('.nav-btn').forEach((btn) => btn.classList.toggle('active', btn.dataset.target === viewId));
  document.querySelectorAll('.view').forEach((view) => view.classList.toggle('active', view.id === `${viewId}View`));
}

function renderFlags(flags) {
  nodes.flagsGrid.innerHTML = '';
  Object.entries(flags).forEach(([key, value]) => {
    const item = document.createElement('div');
    item.className = 'flag-item';
    item.innerHTML = `
      <div>
        <strong>${key}</strong>
      </div>
      <span class="status-pill ${value ? 'status-ok' : 'status-bad'}">${value ? 'جاهز' : 'ناقص'}</span>
    `;
    nodes.flagsGrid.appendChild(item);
  });
}

function renderList(node, items, formatter) {
  node.innerHTML = '';
  if (!items.length) {
    node.innerHTML = '<div class="list-item"><div><strong>لا يوجد</strong><small>لا توجد عناصر لعرضها</small></div></div>';
    return;
  }

  items.forEach((item) => {
    const wrapper = document.createElement('div');
    wrapper.className = 'list-item';
    wrapper.innerHTML = formatter(item);
    node.appendChild(wrapper);
  });
}

function renderOverview(data) {
  state.overview = data;
  const health = data.health;

  nodes.healthStatus.innerHTML = `<span class="health-pill">${health.status}</span>`;
  nodes.healthMeta.textContent = `Rasa: ${health.rasa} | code: ${health.rasa_status_code ?? 'n/a'}`;
  nodes.modelsCount.textContent = String(data.models.length);
  nodes.docsCount.textContent = String(data.knowledge.length);
  nodes.defaultBrand.textContent = data.app.default_brand;
  nodes.appVersion.textContent = `v${data.app.version}`;

  renderFlags(data.flags);

  renderList(nodes.brandsList, data.brands, (item) => `
    <div>
      <strong>${item.icon} ${item.name}</strong>
      <small>${item.desc}</small>
    </div>
    <small style="color:${item.color}">${item.id}</small>
  `);

  renderList(nodes.modelsList, data.models, (item) => `
    <div>
      <strong>${item.name}</strong>
      <small>${item.modified_at}</small>
    </div>
    <small>${item.size_kb} KB</small>
  `);

  renderList(nodes.docsList, data.knowledge, (item) => `
    <div>
      <strong>${item.name}</strong>
      <small>${item.modified_at}</small>
    </div>
    <small>${item.size_kb} KB</small>
  `);

  const brandsOptions = data.brands.map((item) => `<option value="${item.id}">${item.name}</option>`).join('');
  nodes.brandSelect.innerHTML = brandsOptions;
  nodes.widgetBrandSelect.innerHTML = brandsOptions;
  nodes.brandSelect.value = data.app.default_brand;
  nodes.widgetBrandSelect.value = data.app.default_brand;

  renderEmbedCode();
  initWidgetPreview();
}

async function fetchOverview() {
  const response = await fetch('/admin/api/overview');
  if (!response.ok) throw new Error('Failed to load overview');
  const data = await response.json();
  renderOverview(data);
}

async function sendPlaygroundMessage(event) {
  event.preventDefault();
  nodes.responseBox.textContent = 'جارٍ إرسال الرسالة...';
  const payload = {
    sender_id: nodes.senderIdInput.value.trim(),
    brand: nodes.brandSelect.value,
    message: nodes.messageInput.value.trim(),
  };

  const response = await fetch('/admin/api/test-chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  const data = await response.json();
  nodes.responseBox.textContent = JSON.stringify(data, null, 2);
}

async function loadTracker() {
  nodes.trackerBox.textContent = 'جارٍ تحميل التراكر...';
  const senderId = nodes.senderIdInput.value.trim();
  const response = await fetch(`/admin/api/tracker/${encodeURIComponent(senderId)}`);
  const data = await response.json();
  nodes.trackerBox.textContent = JSON.stringify(data, null, 2);
}

function renderEmbedCode() {
  const brand = nodes.widgetBrandSelect.value || (state.overview?.app.default_brand ?? 'uberfix');
  const launcherTitle = nodes.widgetLauncherTitle.value || 'افتح المحادثة';
  const headerTitle = nodes.widgetHeaderTitle.value || 'عزبوت (AzBot)';

  nodes.embedSnippet.textContent = `<script src="${location.origin}/widget/alazab-chat-widget.js"></script>\n<script>\n  window.AlazabChatWidget.init({\n    apiUrl: '${location.origin}/chat',\n    brand: '${brand}',\n    launcherTitle: '${launcherTitle}',\n    headerTitle: '${headerTitle}'\n  });\n</script>`;

  nodes.invokeSnippet.textContent = `window.AlazabChatWidget.open();\nwindow.AlazabChatWidget.send('أريد فتح طلب صيانة جديد');\nwindow.AlazabChatWidget.setBrand('${brand}');\nwindow.dispatchEvent(new CustomEvent('alazab:chat:open', { detail: { message: 'مرحبا' } }));`;
}

function initWidgetPreview() {
  if (!window.AlazabChatWidget) return;
  window.AlazabChatWidget.init({
    apiUrl: `${location.origin}/chat`,
    brand: nodes.widgetBrandSelect.value,
    launcherTitle: nodes.widgetLauncherTitle.value,
    headerTitle: nodes.widgetHeaderTitle.value,
    storageKey: 'alazab_admin_widget_history',
    position: 'bottom-left',
  });
}

function applyWidgetConfig(event) {
  event.preventDefault();
  renderEmbedCode();
  if (!window.AlazabChatWidget) return;
  window.AlazabChatWidget.destroy();
  initWidgetPreview();
  window.AlazabChatWidget.open();
}

function bindEvents() {
  document.querySelectorAll('.nav-btn').forEach((btn) => btn.addEventListener('click', () => setActiveView(btn.dataset.target)));
  document.getElementById('refreshOverviewBtn').addEventListener('click', fetchOverview);
  document.getElementById('playgroundForm').addEventListener('submit', sendPlaygroundMessage);
  document.getElementById('loadTrackerBtn').addEventListener('click', loadTracker);
  document.getElementById('widgetConfigForm').addEventListener('submit', applyWidgetConfig);
  document.getElementById('openWidgetBtn').addEventListener('click', () => window.AlazabChatWidget?.open());
  document.getElementById('sendPresetBtn').addEventListener('click', () => window.AlazabChatWidget?.send('أريد معرفة الخدمات المتاحة الآن.'));
  document.getElementById('copyEmbedBtn').addEventListener('click', async () => {
    await navigator.clipboard.writeText(nodes.embedSnippet.textContent);
    document.getElementById('copyEmbedBtn').textContent = 'تم النسخ';
    setTimeout(() => {
      document.getElementById('copyEmbedBtn').textContent = 'نسخ الكود';
    }, 1800);
  });
  ['change', 'input'].forEach((eventName) => {
    nodes.widgetBrandSelect.addEventListener(eventName, renderEmbedCode);
    nodes.widgetLauncherTitle.addEventListener(eventName, renderEmbedCode);
    nodes.widgetHeaderTitle.addEventListener(eventName, renderEmbedCode);
  });
}

bindEvents();
fetchOverview().catch((error) => {
  nodes.healthStatus.textContent = 'خطأ';
  nodes.healthMeta.textContent = error.message;
});
