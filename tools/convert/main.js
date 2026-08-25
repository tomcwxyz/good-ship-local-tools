import { chrome, header, el, download, copyText } from '../../src/shell.js';
import Papa from 'papaparse';
import { load as loadYaml, dump as dumpYaml } from 'js-yaml';

const root = chrome('data converter');
root.append(header('tool · data', 'Data converter',
  'Convert, prettify and validate between JSON, CSV and YAML — all in the browser.'));

const fromSel = sel(['json', 'csv', 'yaml']);
const toSel = sel(['json', 'csv', 'yaml']);
toSel.value = 'yaml';
function sel(opts) {
  const s = el('select');
  for (const o of opts) s.append(el('option', { value: o }, o.toUpperCase()));
  return s;
}

const infer = el('input', { type: 'checkbox' });
const inferWrap = el('label', { style: { display: 'flex', alignItems: 'center', gap: '.4rem', fontSize: '.8rem' } }, infer, 'Infer CSV numbers and booleans');
const input = el('textarea', { rows: 12, placeholder: 'Paste data here…', spellcheck: false, 'aria-label': 'Input data' });
const output = el('textarea', { rows: 12, readOnly: true, spellcheck: false, 'aria-label': 'Converted output' });
const status = el('div', { class: 'gs-mono', style: { fontSize: '.78rem', margin: '.5rem 0', minHeight: '1.2rem' }, 'aria-live': 'polite' });

function parse(text, fmt) {
  if (fmt === 'json') return JSON.parse(text);
  if (fmt === 'yaml') return loadYaml(text);
  const r = Papa.parse(text.trim(), { header: true, skipEmptyLines: true, dynamicTyping: infer.checked });
  if (r.errors.length) throw new Error(r.errors[0].message);
  return r.data;
}

function serialise(data, fmt) {
  if (fmt === 'json') return JSON.stringify(data, null, 2);
  if (fmt === 'yaml') return dumpYaml(data, { indent: 2, lineWidth: 100, noRefs: true });
  return Papa.unparse(csvRows(data));
}

function csvRows(data) {
  const rows = Array.isArray(data) ? data : [data];
  if (!rows.length) return [];
  if (rows.some(r => r == null || typeof r !== 'object' || Array.isArray(r))) {
    return rows.map(value => ({ value: serialiseCell(value) }));
  }
  return rows.map(row => Object.fromEntries(Object.entries(row).map(([k, v]) => [k, serialiseCell(v)])));
}

function serialiseCell(value) {
  if (value == null) return '';
  if (typeof value === 'object') return JSON.stringify(value);
  return value;
}

function run() {
  inferWrap.style.display = fromSel.value === 'csv' ? 'flex' : 'none';
  const text = input.value.trim();
  if (!text) { output.value = ''; status.textContent = ''; return; }
  try {
    const data = parse(text, fromSel.value);
    output.value = serialise(data, toSel.value);
    status.textContent = '✓ valid — converted ' + fromSel.value.toUpperCase() + ' → ' + toSel.value.toUpperCase() +
      (fromSel.value === 'csv' && !infer.checked ? ' · CSV values kept as text' : '');
    status.style.color = 'var(--green-dk)';
  } catch (e) {
    output.value = '';
    status.textContent = '✗ ' + e.message;
    status.style.color = 'var(--gold)';
  }
}

[input, infer].forEach(n => n.addEventListener('input', run));
[fromSel, toSel].forEach(n => n.addEventListener('change', run));

const dl = el('button', { class: 'gs-btn gs-btn-primary', onclick: () => {
  if (!output.value) return;
  const ext = toSel.value;
  const mime = ext === 'json' ? 'application/json' : ext === 'csv' ? 'text/csv' : 'text/yaml';
  download(output.value, 'converted.' + ext, mime + ';charset=utf-8');
} }, 'Download output');
const copy = el('button', { class: 'gs-btn gs-btn-ghost', onclick: async () => {
  if (!output.value) return;
  const ok = await copyText(output.value);
  copy.textContent = ok ? 'Copied' : 'Copy unavailable';
  setTimeout(() => { copy.textContent = 'Copy output'; }, 1200);
} }, 'Copy output');

root.append(
  el('div', { class: 'gs-toolbar', style: { margin: '1rem 0 .6rem' } },
    el('label', {}, el('span', { class: 'gs-label' }, 'from '), fromSel),
    el('span', { class: 'gs-mono gs-muted', 'aria-hidden': 'true' }, '→'),
    el('label', {}, el('span', { class: 'gs-label' }, 'to '), toSel),
    inferWrap),
  el('div', { class: 'gs-two-col' }, input, output),
  status,
  el('div', { class: 'gs-toolbar' }, dl, copy));
run();
