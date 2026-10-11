/* Local interactive prototype. All accounts, AI and integration data are simulated. */
(function () {
  'use strict';
  const KEY = 'denso.smartmaint.prototype.v3';
  const SESSION = 'denso.smartmaint.session.v3';
  const clone = value => JSON.parse(JSON.stringify(value));
  const emptyDB = () => ({ schema: 3, revision: 0, users: [], assets: [], knowledge: [], cases: [], proposals: [], notifications: [], audit: [], drafts: {} });
  let db = emptyDB(), storageProblem = '', storedRevision = null;
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed.schema !== 3 || !Array.isArray(parsed.cases) || !Array.isArray(parsed.proposals)) throw new Error('Dữ liệu lưu không đúng phiên bản.');
      db = parsed; storedRevision = parsed.revision;
    }
  } catch (err) { storageProblem = 'Không đọc được dữ liệu lưu trên trình duyệt. Xuất dữ liệu hoặc khởi tạo lại trong Hướng dẫn demo.'; }
  let sessionId = null;
  try { sessionId = sessionStorage.getItem(SESSION); } catch (_) { /* Session works in memory if unavailable. */ }
  const SM = window.SM = {
    db, ui: { page: 'dashboard', id: null, tab: null }, pages: {}, actions: {}, forms: {}, inputs: {},
    session: { userId: sessionId }, storageOK: !storageProblem, storageProblem, savedAt: db.savedAt || null,
    user: () => SM.db.users.find(u => u.id === SM.session.userId) || null,
    now: () => new Date().toISOString(),
    uid: prefix => `${prefix}-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`,
    byId: (list, id) => list.find(item => item.id === id),
    asset: id => SM.db.assets.find(a => a.id === id),
    person: id => SM.db.users.find(u => u.id === id)?.name || id || 'Chưa xác định',
    seeders: [],
    seed: fn => { SM.seeders.push(fn); const before = JSON.stringify(SM.db); fn(SM.db); if (before !== JSON.stringify(SM.db)) SM.seedChanged = true; },
    clone,
    fmtDate: (iso, withTime = true) => {
      if (!iso) return 'Chưa ghi nhận';
      const date = new Date(iso);
      if (!Number.isFinite(date.getTime())) return String(iso);
      return date.toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh', day: '2-digit', month: '2-digit', year: 'numeric', ...(withTime ? { hour: '2-digit', minute: '2-digit' } : {}) });
    },
    escape: value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])),
  };
  SM.e = SM.escape;
  const paths = {
    grid: '<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>',
    wrench: '<path d="M14.7 6.3a5 5 0 0 0-6.4 6.4L3 18l3 3 5.3-5.3a5 5 0 0 0 6.4-6.4L14 13l-3-3z"/>',
    book: '<path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v17H6.5A2.5 2.5 0 0 1 4 17.5zM4 17.5A2.5 2.5 0 0 1 6.5 15H20M8 7h8M8 11h6"/>',
    search: '<circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 5 5"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    arrow: '<path d="M4 12h16m-6-6 6 6-6 6"/>',
    back: '<path d="M20 12H4m6-6-6 6 6 6"/>',
    chevron: '<path d="m9 5 7 7-7 7"/>',
    chevrondown: '<path d="m5 9 7 7 7-7"/>',
    clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    check: '<path d="m5 12 4 4L19 6"/>',
    checkcircle: '<circle cx="12" cy="12" r="9"/><path d="m7.5 12 3 3 6-6"/>',
    shield: '<path d="m12 3 8 3v6c0 5-8 9-8 9s-8-4-8-9V6z"/><path d="m8.5 12 2.5 2.5 4.5-5"/>',
    file: '<path d="M14 3H5v18h14V8zM14 3v5h5M8 12h8M8 16h6"/>',
    edit: '<path d="m14 5 5 5M4 20l5-1L21 7l-5-5L4 14z"/>',
    spark: '<path d="m12 3 2.5 6.5L21 12l-6.5 2.5L12 21l-2.5-6.5L3 12l6.5-2.5z"/>',
    bell: '<path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4"/>',
    machine: '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M7 8h10M7 12h4m2 0h4M7 16h10M8 2v2m8-2v2"/>',
    users: '<circle cx="9" cy="7" r="4"/><path d="M2 21v-3a6 6 0 0 1 12 0v3M17 3a4 4 0 0 1 0 8M18 15a5 5 0 0 1 4 5v1"/>',
    user: '<circle cx="12" cy="7" r="4"/><path d="M4 21v-2a8 8 0 0 1 16 0v2"/>',
    link: '<path d="m10 14 4-4M8 16l-2 2a4 4 0 0 1-6-6l5-5a4 4 0 0 1 6 0m2 1 2-2a4 4 0 0 1 6 6l-5 5a4 4 0 0 1-6 0" transform="translate(1 0)"/>',
    database: '<ellipse cx="12" cy="5" rx="8" ry="3"/><path d="M4 5v14c0 4 16 4 16 0V5M4 12c0 4 16 4 16 0"/>',
    alert: '<path d="m12 3 10 18H2zM12 9v5m0 3h.01"/>',
    info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v6m0-10h.01"/>',
    close: '<path d="m6 6 12 12M6 18 18 6"/>',
    menu: '<path d="M4 6h16M4 12h16M4 18h16"/>',
    logout: '<path d="M9 3H4v18h5m5-14 5 5-5 5m-6-5h12"/>',
    history: '<path d="M3 12a9 9 0 1 0 2.6-6.4L3 8M3 3v5h5m4-1v5l3 2"/>',
    save: '<path d="M4 3h13l4 4v14H3V3zM7 3v6h9V3M7 21v-8h10v8"/>',
    download: '<path d="M12 3v12m-5-5 5 5 5-5M4 16v5h16v-5"/>',
    refresh: '<path d="M20 8a8 8 0 0 0-14-3L3 8m0-5v5h5m-4 8a8 8 0 0 0 14 3l3-3m0 5v-5h-5"/>',
    calendar: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M7 3v4m10-4v4M3 10h18"/>',
    filter: '<path d="M3 5h18M6 12h12M9 19h6"/>',
    help: '<circle cx="12" cy="12" r="9"/><path d="M9 9a3 3 0 1 1 4 3c-1 .5-1 1-1 2m0 3h.01"/>',
  };
  SM.icon = name => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${paths[name] || paths.file}</svg>`;
  SM.badge = (text, tone = 'neutral') => `<span class="badge badge-${SM.e(tone)}">${SM.e(text)}</span>`;
  SM.button = (label, action, style = 'secondary', attrs = '') => `<button type="button" class="btn btn-${SM.e(style)}" data-action="${SM.e(action)}" ${attrs}>${SM.e(label)}</button>`;
  SM.empty = (title, text, extra = '') => `<div class="empty-state">${SM.icon('file')}<h3>${SM.e(title)}</h3><p>${SM.e(text)}</p>${extra}</div>`;
  let fieldSerial = 0;
  function formField(label, name, value, options, textarea) {
    const e = SM.e, id = `field-${name.replace(/[^a-zA-Z0-9_-]/g, '-')}-${++fieldSerial}`;
    const hint = options.hint ? `<small class="field-hint" id="${id}-hint">${e(options.hint)}</small>` : '';
    const attrs = `id="${id}" name="${e(name)}" ${options.required ? 'required' : ''} ${options.disabled ? 'disabled' : ''} ${options.readonly ? 'readonly' : ''} ${options.placeholder ? `placeholder="${e(options.placeholder)}"` : ''} ${hint ? `aria-describedby="${id}-hint"` : ''} ${options.attrs || ''}`;
    return `<div class="field ${options.className || ''}"><label class="field-label" for="${id}">${e(label)}${options.required ? ' <span class="required-mark" aria-hidden="true">*</span>' : ''}</label>${textarea ? `<textarea class="textarea" rows="${options.rows || 4}" ${attrs}>${e(value)}</textarea>` : `<input class="input" type="${e(options.type || 'text')}" value="${e(value)}" ${attrs}>`}${hint}</div>`;
  }
  SM.field = (label, name, value = '', options = {}) => formField(label, name, value, options, false);
  SM.area = (label, name, value = '', options = {}) => formField(label, name, value, options, true);
  SM.getKnowledge = (id, version) => {
    const k = SM.db.knowledge.find(item => item.id === id && item.status === 'published');
    if (!k) return null;
    if (!version || Number(version) === Number(k.version)) return k;
    const historical = (k.history || []).find(item => Number(item.version) === Number(version));
    return historical ? (historical.snapshot || historical) : null;
  };
  SM.updateSaveLabels = text => document.querySelectorAll('[data-save-state]').forEach(el => { el.textContent = text; el.classList.toggle('save-error', !SM.storageOK); });
  SM.commit = (fn, message = '', rerender = true) => {
    if (SM.unsavedChanges) { SM.toast('Có thay đổi chưa lưu. Xuất nội dung đang nhập hoặc xử lý lưu trước khi tiếp tục.', 'warning'); return false; }
    const previous = clone(SM.db);
    if (SM.storageProblem) { SM.toast(SM.storageProblem, 'danger'); return false; }
    try {
      const latest = localStorage.getItem(KEY);
      const revision = latest ? JSON.parse(latest).revision : null;
      if (revision !== storedRevision) {
        SM.toast('Dữ liệu đã thay đổi ở tab khác. Nội dung đang nhập được giữ trên màn hình; sao chép trước khi tải lại.', 'warning');
        SM.storageOK = false;
        SM.unsavedChanges = true;
        SM.updateSaveLabels('Chưa lưu: dữ liệu ở tab khác đã thay đổi.');
        return false;
      }
      SM.updateSaveLabels('Đang lưu trên trình duyệt…');
      fn(SM.db);
      SM.db.revision += 1;
      SM.db.savedAt = SM.now();
      localStorage.setItem(KEY, JSON.stringify(SM.db));
      storedRevision = SM.db.revision; SM.savedAt = SM.db.savedAt; SM.storageOK = true;
    } catch (err) {
      SM.pendingWrite = clone(SM.db);
      SM.db = previous; SM.storageOK = false;
      SM.unsavedChanges = true;
      SM.updateSaveLabels('Chưa lưu được. Giữ trang này và sao chép nội dung.');
      SM.toast('Chưa lưu được: bộ nhớ trình duyệt bị chặn hoặc đã đầy. Dữ liệu đang nhập vẫn ở trên màn hình.', 'danger');
      return false;
    }
    if (rerender && SM.render) SM.render();
    SM.updateSaveLabels(`Đã lưu trên trình duyệt · ${SM.fmtDate(SM.savedAt)}`);
    if (message) SM.toast(message);
    return true;
  };
  SM.notice = (userId, title, body, route = {}) => {
    SM.db.notifications.unshift({ id: SM.uid('NT'), userId, title, body, route, createdAt: SM.now(), read: false });
  };
  SM.log = (action, entityId, detail = '') => SM.db.audit.push({ id: SM.uid('AU'), actorId: SM.user()?.id || 'system', action, entityId, detail, at: SM.now() });
  let toastTimer;
  SM.toast = (text, tone = 'success') => {
    if (tone === 'error') tone = 'danger';
    const el = document.getElementById('toast');
    if (!el) return;
    clearTimeout(toastTimer); el.textContent = text; el.className = `toast show toast-${tone}`;
    toastTimer = setTimeout(() => el.classList.remove('show'), tone === 'danger' || tone === 'warning' ? 10000 : 5500);
  };
  let lastFocus;
  SM.modal = (title, body, footer = '') => {
    const modal = document.getElementById('modal');
    lastFocus = document.activeElement;
    modal.innerHTML = `<div class="modal-head"><h2 id="modal-title">${SM.e(title)}</h2><button type="button" class="icon-btn" data-action="close-modal" aria-label="Đóng">${SM.icon('close')}</button></div><div class="modal-body">${body}</div>${footer ? `<div class="modal-footer">${footer}</div>` : ''}`;
    if (!modal.open) modal.showModal();
  };
  SM.closeModal = () => {
    const el = document.getElementById('modal');
    if (el?.open) el.close();
    if (lastFocus?.isConnected) lastFocus.focus();
  };
  SM.error = (parent, text) => {
    let el = parent?.querySelector('.error-summary');
    if (!el && parent) { el = document.createElement('div'); el.className = 'error-summary notice notice-danger'; el.tabIndex = -1; el.setAttribute('role', 'alert'); parent.prepend(el); }
    if (el) { el.textContent = text; el.hidden = false; el.tabIndex = -1; el.setAttribute('role', 'alert'); el.focus(); el.scrollIntoView({ block: 'nearest' }); }
    else SM.toast(text, 'danger');
  };
  SM.allowed = page => Boolean(SM.user() && SM.pages[page]?.roles.includes(SM.user().role));
  let leaveAction = null;
  SM.captureInputs = () => [...document.querySelectorAll('#app input, #app textarea, #app select, #modal input, #modal textarea, #modal select')].filter(el => el.name || el.dataset.key).map(el => ({ field: el.name || el.dataset.key, value: /^(checkbox|radio)$/.test(el.type) ? el.checked : el.value, record: el.dataset.id || SM.ui.id }));
  SM.guardLeave = next => {
    if (!SM.unsavedChanges) return true;
    const captured = SM.captureInputs();
    SM.recovery = { route: { ...SM.ui }, capturedAt: SM.now(), inputs: captured };
    leaveAction = next;
    SM.modal('Có nội dung chưa lưu', '<p>Trình duyệt chưa xác nhận lưu thay đổi. Xuất nội dung đang nhập trước khi rời trang.</p><p class="field-hint">Nếu có tab khác thay đổi dữ liệu, hãy xuất nội dung rồi tải lại để đối chiếu; không ghi đè tự động.</p>', SM.button('Xuất nội dung đang nhập', 'export-unsaved') + SM.button('Ở lại', 'close-modal') + SM.button('Rời và bỏ thay đổi chưa lưu', 'leave-unsaved', 'danger'));
    return false;
  };
  SM.go = (page, id = null, tab = null) => {
    if (!SM.allowed(page)) { SM.toast('Tài khoản này không có quyền mở chức năng đó.', 'warning'); return; }
    if (!SM.guardLeave(() => SM.go(page, id, tab))) return;
    SM.closeModal();
    SM.ui = { ...SM.ui, page, id, tab, menuOpen: false };
    const hash = '#' + [page, id || '', tab || ''].map(encodeURIComponent).join('/').replace(/\/+$/, '');
    try { history.pushState(null, '', hash); } catch (_) { location.hash = hash; }
    SM.render(); window.scrollTo({ top: 0, behavior: 'instant' });
    requestAnimationFrame(() => document.getElementById('page-title')?.focus({ preventScroll: true }));
  };
  SM.login = id => {
    const user = SM.db.users.find(u => u.id === id);
    if (!user) return;
    if (!SM.guardLeave(() => SM.login(id))) return;
    SM.session.userId = id;
    try { sessionStorage.setItem(SESSION, id); } catch (_) { /* Demo session remains in memory. */ }
    SM.go('dashboard');
  };
  SM.logout = () => {
    if (!SM.guardLeave(() => SM.logout())) return;
    SM.closeModal(); SM.session.userId = null;
    try { sessionStorage.removeItem(SESSION); } catch (_) { /* No persistent session. */ }
    SM.ui = { page: 'dashboard', id: null, tab: null };
    history.replaceState(null, '', '#login'); SM.render();
  };
  SM.actions['close-modal'] = () => SM.closeModal();
  SM.actions['navigate'] = el => SM.go(el.dataset.page, el.dataset.id || null, el.dataset.tab || null);
  SM.actions['logout'] = () => SM.logout();
  SM.actions['menu'] = () => {
    SM.ui.menuOpen = !SM.ui.menuOpen;
    document.querySelector('.app-shell')?.classList.toggle('menu-open', SM.ui.menuOpen);
    document.querySelector('.mobile-menu')?.setAttribute('aria-expanded', String(SM.ui.menuOpen));
  };
  SM.actions['reload-data'] = () => location.reload();
  SM.actions['open-source'] = el => SM.go('knowledge-detail', el.dataset.id);
  SM.persistSeed = () => { if (!SM.storageProblem && SM.seedChanged) { SM.commit(() => {}, '', false); SM.seedChanged = false; } };
  SM.resetDemo = () => {
    try { localStorage.removeItem(KEY); sessionStorage.removeItem(SESSION); location.hash = ''; location.reload(); }
    catch (_) { SM.toast('Trình duyệt đang chặn bộ nhớ. Chưa thể khởi tạo lại.', 'danger'); }
  };
  SM.exportData = () => {
    const url = URL.createObjectURL(new Blob([JSON.stringify(SM.db, null, 2)], { type: 'application/json;charset=utf-8' }));
    const link = document.createElement('a'); link.href = url; link.download = 'denso-smartmaint-demo-data.json'; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  SM.actions['export-unsaved'] = () => {
    const payload = { ...SM.recovery, attemptedData: SM.pendingWrite || null, savedData: SM.db };
    const url = URL.createObjectURL(new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json;charset=utf-8' }));
    const link = document.createElement('a'); link.href = url; link.download = 'denso-noi-dung-chua-luu.json'; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  SM.actions['leave-unsaved'] = () => { const next = leaveAction; leaveAction = null; SM.unsavedChanges = false; SM.closeModal(); if (next) next(); };
  document.addEventListener('click', event => {
    if (event.target.closest('.skip-link')) { event.preventDefault(); const main = document.getElementById('main-content'); if (main) { main.tabIndex = -1; main.focus(); } return; }
    const target = event.target.closest('[data-action]');
    if (!target || target.disabled) return;
    const action = SM.actions[target.dataset.action];
    if (action) { event.preventDefault(); action(target, event); }
  });
  document.addEventListener('submit', event => {
    const form = event.target.closest('form[data-form]');
    if (form && SM.forms[form.dataset.form]) { event.preventDefault(); SM.forms[form.dataset.form](form, event); }
  });
  for (const name of ['input', 'change']) document.addEventListener(name, event => {
    const el = event.target.closest('[data-input]');
    if (el && SM.inputs[el.dataset.input]) SM.inputs[el.dataset.input](el, event);
  });
  function onHistory() { if (SM.startRoute && SM.guardLeave(() => SM.startRoute())) SM.startRoute(); }
  window.addEventListener('popstate', onHistory);
  window.addEventListener('hashchange', onHistory);
  window.addEventListener('storage', event => {
    if (event.key === KEY) {
      SM.storageOK = false;
      SM.updateSaveLabels('Tab khác đã cập nhật dữ liệu. Sao chép nội dung chưa lưu rồi tải lại.');
      SM.toast('Tab khác đã cập nhật dữ liệu. Hãy tải lại trước khi tiếp tục chỉnh sửa.', 'warning');
    }
  });
  window.addEventListener('beforeunload', event => { if (!SM.storageOK) { event.preventDefault(); event.returnValue = ''; } });
  document.addEventListener('keydown', event => { if (event.key === 'Escape' && SM.ui.menuOpen) SM.actions.menu(); });
})();
