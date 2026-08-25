import { chrome, header, el, copyText } from '../../src/shell.js';
import { diffChars, diffLines, diffWords } from 'diff';

const root = chrome('text diff');
root.append(header('tool · compare', 'Text diff',
  'Paste two versions. Additions in green, removals in gold. Nothing leaves the page.'));

const a = el('textarea', { rows: 9, placeholder: 'Original…', spellcheck: false, 'aria-label': 'Original text' });
const b = el('textarea', { rows: 9, placeholder: 'Changed…', spellcheck: false, 'aria-label': 'Changed text' });
const modeSel = el('select', {},
  el('option', { value: 'lines' }, 'By line'),
  el('option', { value: 'words' }, 'By word'),
  el('option', { value: 'chars' }, 'By character'));

const out = el('div', { class: 'gs-card', style: { marginTop: '1rem', whiteSpace: 'pre-wrap', overflowWrap: 'anywhere',
  fontFamily: 'var(--fm)', fontSize: '.82rem', lineHeight: '1.6', minHeight: '3rem' }, 'aria-live': 'polite' });
const stats = el('div', { class: 'gs-mono gs-muted', style: { fontSize: '.75rem', marginTop: '.5rem' } });

function seg(text, kind) {
  const style = kind === 'add'
    ? { background: 'var(--soft-green)', color: 'var(--green-dk)' }
    : kind === 'del'
    ? { background: 'var(--gold-bg)', color: '#765b17', textDecoration: 'line-through' }
    : {};
  return el('span', { style }, text);
}

function run() {
  const fn = modeSel.value === 'words' ? diffWords : modeSel.value === 'chars' ? diffChars : diffLines;
  const parts = fn(a.value, b.value);
  out.innerHTML = '';
  let add = 0, del = 0;
  for (const p of parts) {
    if (p.added) add += p.count || 1;
    if (p.removed) del += p.count || 1;
    out.append(seg(p.value, p.added ? 'add' : p.removed ? 'del' : 'same'));
  }
  if (!a.value && !b.value) out.textContent = 'Diff appears here.';
  stats.textContent = `+${add} / −${del} (${modeSel.value})`;
}

a.addEventListener('input', run);
b.addEventListener('input', run);
modeSel.addEventListener('change', run);

const copyChanged = el('button', { class: 'gs-btn gs-btn-ghost', onclick: async () => {
  const ok = await copyText(b.value);
  copyChanged.textContent = ok ? 'Copied changed text' : 'Copy unavailable';
  setTimeout(() => { copyChanged.textContent = 'Copy changed text'; }, 1200);
} }, 'Copy changed text');
const clear = el('button', { class: 'gs-btn gs-btn-ghost', onclick: () => { a.value = ''; b.value = ''; run(); a.focus(); } }, 'Clear');

root.append(
  el('div', { class: 'gs-toolbar', style: { margin: '1rem 0 .6rem' } },
    el('label', {}, el('span', { class: 'gs-label' }, 'compare '), modeSel), copyChanged, clear),
  el('div', { class: 'gs-two-col' }, a, b),
  stats, out);
run();
