// Shared chrome + tiny DOM helpers. Imported by every tool.
import './brand/brand.css';

export function el(tag, attrs = {}, ...kids) {
  const n = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v == null) continue;
    if (k === 'class') n.className = v;
    else if (k === 'html') n.innerHTML = v;
    else if (k === 'style' && typeof v === 'object') Object.assign(n.style, v);
    else if (k.startsWith('on') && typeof v === 'function') n.addEventListener(k.slice(2), v);
    else if (k in n && !['role', 'aria-label', 'aria-live', 'aria-describedby'].includes(k)) {
      try { n[k] = v; } catch { n.setAttribute(k, v); }
    } else n.setAttribute(k, v);
  }
  for (const c of kids.flat()) {
    if (c == null || c === false) continue;
    n.append(c.nodeType ? c : document.createTextNode(String(c)));
  }
  return n;
}

const anchor = () =>
  '<svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="5" r="3"/><line x1="12" y1="22" x2="12" y2="8"/><path d="M5 12H2a10 10 0 0 0 20 0h-3"/></svg>';

// Builds nav + a .gs-wrap content area + footer. Returns the content element.
export function chrome(subtitle, { back = true } = {}) {
  const nav = el('nav', { class: 'gs-nav', 'aria-label': 'Local tools' });
  nav.innerHTML = anchor();
  nav.append(
    el('a', { href: '../../index.html' }, 'The Good Ship'),
    el('span', { style: { opacity: .5 }, 'aria-hidden': 'true' }, '·'),
    el('span', { style: { opacity: .85 } }, subtitle),
  );
  const wrap = el('main', { class: 'gs-wrap' });
  if (back) {
    wrap.append(el('a', {
      href: '../../index.html', class: 'gs-btn gs-btn-ghost',
      style: { marginBottom: '1.25rem', textDecoration: 'none' },
    }, '← All tools'));
  }
  const content = el('div');
  const foot = el('footer', { class: 'gs-foot' });
  foot.innerHTML = '<b>The Good Ship</b> <span>· tomcw.xyz · CC BY-NC 4.0</span>';
  wrap.append(content, foot);
  document.body.append(nav, wrap);
  return content;
}

export function assurance(text = 'Everything runs in your browser. Your file is not uploaded or sent to a server.') {
  const d = el('div', { class: 'gs-assurance' });
  d.innerHTML = '<svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><path d="m9 12 2 2 4-4"/></svg>';
  d.append(el('span', {}, text));
  return d;
}

export function header(labelText, titleText, leadText) {
  const box = el('header');
  box.append(
    el('div', { class: 'gs-label' }, labelText),
    el('h1', { style: { fontSize: '1.9rem', margin: '.2rem 0 .4rem' } }, titleText),
  );
  if (leadText) box.append(el('p', { class: 'gs-lead', style: { marginTop: 0 } }, leadText));
  return box;
}

export function notice(text, { tone = 'warn' } = {}) {
  const d = el('div', { class: tone === 'warn' ? 'gs-warn' : 'gs-assurance' });
  d.append(el('span', {}, text));
  return d;
}

// Reusable accessible file dropzone. onFile(file) is called on drop/select.
export function dropzone(accept, labelHtml, onFile) {
  const input = el('input', { type: 'file', accept, class: 'gs-visually-hidden' });
  const zone = el('div', {
    class: 'gs-drop', role: 'button', tabIndex: 0,
    'aria-label': 'Choose a file or drop one here',
  }, input);
  zone.insertAdjacentHTML('afterbegin', labelHtml);

  const choose = () => input.click();
  zone.addEventListener('click', e => { if (e.target !== input) choose(); });
  zone.addEventListener('keydown', e => {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); choose(); }
  });
  input.addEventListener('change', () => input.files[0] && onFile(input.files[0]));
  zone.addEventListener('dragover', e => { e.preventDefault(); zone.classList.add('drag'); });
  zone.addEventListener('dragleave', () => zone.classList.remove('drag'));
  zone.addEventListener('drop', e => {
    e.preventDefault(); zone.classList.remove('drag');
    if (e.dataTransfer.files[0]) onFile(e.dataTransfer.files[0]);
  });
  return zone;
}

export function download(bytesOrBlob, filename, type) {
  const blob = bytesOrBlob instanceof Blob ? bytesOrBlob : new Blob([bytesOrBlob], { type });
  const url = URL.createObjectURL(blob);
  const a = el('a', { href: url, download: filename });
  document.body.append(a); a.click(); a.remove();
  // Delaying revocation avoids intermittent download failures in Safari/WebKit.
  setTimeout(() => URL.revokeObjectURL(url), 1500);
}

export async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

export function baseName(filename) {
  const i = filename.lastIndexOf('.');
  return i > 0 ? filename.slice(0, i) : filename;
}

export function fmtBytes(n) {
  if (!Number.isFinite(n)) return '—';
  if (n < 1024) return n + ' B';
  if (n < 1048576) return (n / 1024).toFixed(1) + ' KB';
  if (n < 1073741824) return (n / 1048576).toFixed(2) + ' MB';
  return (n / 1073741824).toFixed(2) + ' GB';
}
