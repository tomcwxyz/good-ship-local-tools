import { chrome, header, assurance, dropzone, download, el, fmtBytes } from '../../src/shell.js';
import { decodeTextBuffer } from '../../src/lib/text.js';
import Papa from 'papaparse';

const root = chrome('csv cleaner');
let view;
function render(n) { if (view) view.remove(); view = n; root.append(n); }

function start() {
  const box = el('div');
  box.append(
    header('tool · data', 'CSV cleaner',
      'Tidy a CSV without pasting personal data into a random website. Everything happens here.'),
    el('div', { style: { margin: '1rem 0 1.25rem' } }, assurance()),
    dropzone('.csv,text/csv,text/plain',
      '<div style="font-family:var(--fh);color:var(--text);font-size:1.1rem;margin-bottom:.25rem">Drop a CSV, or click to choose</div>' +
      '<div class="gs-mono" style="font-size:.75rem;color:var(--muted)">UTF-8 and common Windows CSV encoding supported</div>',
      handle));
  render(box);
}

async function handle(file) {
  try {
    showEditor(file, await file.arrayBuffer());
  } catch (err) {
    render(errorCard('Could not read that file: ' + err.message));
  }
}

function parseCsv(buffer, encoding) {
  const decoded = decodeTextBuffer(buffer, encoding);
  const parsed = Papa.parse(decoded.text, { header: true, skipEmptyLines: 'greedy', dynamicTyping: false });
  return { ...parsed, encoding: decoded.encoding };
}

function showEditor(file, buffer) {
  const initial = parseCsv(buffer, 'auto');
  const opts = {
    trimCells: el('input', { type: 'checkbox', checked: true }),
    trimHeaders: el('input', { type: 'checkbox', checked: true }),
    dropEmptyRows: el('input', { type: 'checkbox', checked: true }),
    dropEmptyCols: el('input', { type: 'checkbox' }),
    dedupe: el('input', { type: 'checkbox' }),
  };
  const encoding = el('select', {},
    el('option', { value: 'auto' }, 'Auto-detect'),
    el('option', { value: 'utf-8' }, 'UTF-8'),
    el('option', { value: 'windows-1252' }, 'Windows-1252'),
    el('option', { value: 'utf-16le' }, 'UTF-16 LE'),
    el('option', { value: 'utf-16be' }, 'UTF-16 BE'));

  const wrap = el('div');
  const stat = el('div', { class: 'gs-mono gs-muted', style: { fontSize: '.78rem', margin: '.6rem 0' }, 'aria-live': 'polite' });
  const warnings = el('div', { style: { display: 'grid', gap: '.5rem', marginBottom: '.6rem' } });
  const thead = el('thead');
  const tbody = el('tbody');
  const table = el('div', { style: { overflowX: 'auto', marginTop: '.5rem' } }, el('table', { style: { width: '100%' } }, thead, tbody));
  let parsed = initial;
  let latest = [];
  let latestFields = [];

  function clean() {
    let rows = parsed.data.map(r => ({ ...r }));
    let fields = [...(parsed.meta.fields || [])];

    if (opts.trimHeaders.checked) {
      const used = new Map();
      const renamed = new Map();
      for (const old of fields) {
        const base = old.trim() || 'column';
        const count = (used.get(base) || 0) + 1;
        used.set(base, count);
        renamed.set(old, count === 1 ? base : `${base} (${count})`);
      }
      rows = rows.map(r => Object.fromEntries(fields.map(f => [renamed.get(f), r[f]])));
      fields = fields.map(f => renamed.get(f));
    }

    if (opts.trimCells.checked) rows = rows.map(r => Object.fromEntries(Object.entries(r).map(([k, v]) => [k, typeof v === 'string' ? v.trim() : v])));
    if (opts.dropEmptyRows.checked) rows = rows.filter(r => Object.values(r).some(v => v !== '' && v != null));

    if (opts.dropEmptyCols.checked) {
      fields = fields.filter(f => rows.some(r => r[f] !== '' && r[f] != null));
      rows = rows.map(r => Object.fromEntries(fields.map(f => [f, r[f]])));
    }

    if (opts.dedupe.checked) {
      const seen = new Set();
      rows = rows.filter(r => {
        const key = JSON.stringify(fields.map(f => r[f] ?? ''));
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });
    }
    return { rows, fields };
  }

  function refresh() {
    const cleaned = clean();
    latest = cleaned.rows;
    latestFields = cleaned.fields;
    stat.textContent = `${parsed.data.length} rows in · ${latest.length} rows out · ${latestFields.length} columns · decoded as ${parsed.encoding.toUpperCase()}`;

    warnings.innerHTML = '';
    if (file.size > 25 * 1024 * 1024) warnings.append(errorCard('This is a large CSV. Processing happens in memory, so the page may be slower than usual.', false));
    if (parsed.errors.length) warnings.append(errorCard(`${parsed.errors.length} CSV parsing warning${parsed.errors.length === 1 ? '' : 's'}. First: ${parsed.errors[0].message}`, false));
    if (parsed.meta.renamedHeaders && Object.keys(parsed.meta.renamedHeaders).length) warnings.append(errorCard('Duplicate source headers were renamed so values are not overwritten.', false));

    thead.innerHTML = '';
    thead.append(el('tr', {}, ...latestFields.map(c => el('th', { scope: 'col' }, c))));
    tbody.innerHTML = '';
    for (const r of latest.slice(0, 12)) tbody.append(el('tr', {}, ...latestFields.map(c => el('td', {}, r[c] ?? ''))));
  }

  const optRow = (label, cb) => el('label', { style: { display: 'flex', alignItems: 'center', gap: '.4rem', fontSize: '.85rem', cursor: 'pointer' } }, cb, label);
  Object.values(opts).forEach(c => c.addEventListener('change', refresh));
  encoding.addEventListener('change', () => {
    try { parsed = parseCsv(buffer, encoding.value); refresh(); }
    catch (err) { warnings.replaceChildren(errorCard('Could not decode that file with this encoding: ' + err.message, false)); }
  });

  const dlCsv = el('button', { class: 'gs-btn gs-btn-primary', onclick: () => {
    refresh();
    download(Papa.unparse({ fields: latestFields, data: latest.map(r => latestFields.map(f => r[f] ?? '')) }), file.name.replace(/\.csv$/i, '') + '-clean.csv', 'text/csv;charset=utf-8');
  } }, 'Download clean CSV');
  const dlJson = el('button', { class: 'gs-btn gs-btn-ghost', onclick: () => { refresh(); download(JSON.stringify(latest, null, 2), file.name.replace(/\.csv$/i, '') + '.json', 'application/json;charset=utf-8'); } }, 'Download JSON');
  const again = el('button', { class: 'gs-btn gs-btn-ghost', onclick: start }, 'Another file');

  wrap.append(
    header('tool · data', 'CSV cleaner', null),
    el('div', { class: 'gs-mono', style: { fontSize: '.8rem', margin: '.25rem 0 .75rem' } }, file.name + ' · ' + fmtBytes(file.size)),
    el('div', { class: 'gs-card', style: { display: 'grid', gap: '.75rem' } },
      el('label', { class: 'gs-toolbar' }, el('span', { class: 'gs-label' }, 'source encoding'), encoding),
      el('div', { class: 'gs-toolbar' },
        optRow('Trim cell whitespace', opts.trimCells),
        optRow('Trim column names', opts.trimHeaders),
        optRow('Drop empty rows', opts.dropEmptyRows),
        optRow('Drop empty columns', opts.dropEmptyCols),
        optRow('Remove duplicate rows', opts.dedupe))),
    stat, warnings, table,
    el('div', { class: 'gs-mono gs-muted', style: { fontSize: '.72rem', margin: '.4rem 0' } }, 'preview · first 12 rows · output is UTF-8'),
    el('div', { class: 'gs-toolbar', style: { marginTop: '.5rem' } }, dlCsv, dlJson, again));
  render(wrap);
  refresh();
}

function errorCard(message, includeRetry = true) {
  const card = el('div', { class: 'gs-warn' }, el('span', {}, message));
  if (includeRetry) card.append(el('button', { class: 'gs-btn gs-btn-ghost', style: { marginLeft: 'auto' }, onclick: start }, 'Try another file'));
  return card;
}

start();
