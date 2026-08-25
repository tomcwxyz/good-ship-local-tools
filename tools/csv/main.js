import { chrome, header, assurance, dropzone, download, el, fmtBytes } from '../../src/shell.js';
import { decodeTextBuffer } from '../../src/lib/text.js';
import { cleanCsvData, normaliseCsvHeaders, DELIMITERS, delimiterLabel } from '../../src/lib/csv.js';
import Papa from 'papaparse';

const root = chrome('csv cleaner');
let view;
function render(n) { if (view) view.remove(); view = n; root.append(n); }

function start() {
  const box = el('div');
  box.append(
    header('tool · data', 'CSV cleaner',
      'Tidy, deduplicate and make controlled replacements in a CSV or TSV without pasting personal data into a random website.'),
    el('div', { style: { margin: '1rem 0 1.25rem' } }, assurance()),
    dropzone('.csv,.tsv,text/csv,text/tab-separated-values,text/plain',
      '<div style="font-family:var(--fh);color:var(--text);font-size:1.1rem;margin-bottom:.25rem">Drop a CSV or TSV, or click to choose</div>' +
      '<div class="gs-mono" style="font-size:.75rem;color:var(--muted)">UTF-8 · Windows-1252 · UTF-16 · comma/tab/semicolon/pipe</div>',
      handle));
  render(box);
}

async function handle(file) {
  try {
    if (file.size > 100 * 1024 * 1024) throw new Error('Files over 100 MB are not opened by this tool. Split the file into smaller parts first.');
    showEditor(file, await file.arrayBuffer());
  } catch (err) {
    render(errorCard('Could not read that file: ' + err.message));
  }
}

function detectDelimiter(text) {
  // Papa's delimiter guess uses the parsed row shape. Our real parse deliberately
  // preserves blank rows so the user controls whether they are removed, but a
  // trailing blank line can make a short TSV/CSV look like a one-column file to
  // the guesser. Probe separately with blank lines ignored, then use that explicit
  // delimiter for the real parse so row preservation and delimiter detection do
  // not interfere with one another.
  const probe = Papa.parse(text, {
    header: false,
    skipEmptyLines: 'greedy',
    preview: 20,
    dynamicTyping: false,
  });
  return probe.meta.delimiter || ',';
}

function parseCsv(buffer, encoding, delimiter) {
  const decoded = decodeTextBuffer(buffer, encoding);
  const actualDelimiter = delimiter === 'auto' ? detectDelimiter(decoded.text) : delimiter;
  const parsed = Papa.parse(decoded.text, {
    header: true,
    delimiter: actualDelimiter,
    // Preserve blank source rows here; the cleaning option below decides whether they are removed.
    skipEmptyLines: false,
    dynamicTyping: false,
  });
  return { ...parsed, encoding: decoded.encoding };
}

function selectControl(options, value) {
  return el('select', {}, ...options.map(option =>
    el('option', { value: option.value, selected: option.value === value }, option.label)));
}

function labelledCheckbox(label, checked = false) {
  const input = el('input', { type: 'checkbox', checked });
  const control = el('label', {
    style: { display: 'flex', alignItems: 'flex-start', gap: '.42rem', fontSize: '.84rem', cursor: 'pointer' },
  }, input, el('span', {}, label));
  return { input, control };
}

function showEditor(file, buffer) {
  const encoding = selectControl([
    { value: 'auto', label: 'Auto-detect' },
    { value: 'utf-8', label: 'UTF-8' },
    { value: 'windows-1252', label: 'Windows-1252' },
    { value: 'utf-16le', label: 'UTF-16 LE' },
    { value: 'utf-16be', label: 'UTF-16 BE' },
  ], 'auto');
  const delimiter = selectControl(DELIMITERS, 'auto');

  const trimCells = labelledCheckbox('Trim cell whitespace', true);
  const trimHeaders = labelledCheckbox('Trim column names', true);
  const dropEmptyRows = labelledCheckbox('Drop empty rows', true);
  const dropEmptyCols = labelledCheckbox('Drop empty columns');
  const dedupe = labelledCheckbox('Remove duplicate rows');

  const dedupeFields = new Set();
  const replaceFields = new Set();
  let dedupeInitialised = false;

  const dedupeFieldList = el('div', {
    style: {
      display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(150px,1fr))',
      gap: '.35rem .75rem', maxHeight: '180px', overflow: 'auto', padding: '.4rem 0',
    },
  });
  const replaceFieldList = el('div', {
    style: {
      display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(150px,1fr))',
      gap: '.35rem .75rem', maxHeight: '180px', overflow: 'auto', padding: '.4rem 0',
    },
  });

  const findInput = el('input', { type: 'text', placeholder: 'Text to find', 'aria-label': 'Text to find' });
  const replaceInput = el('input', { type: 'text', placeholder: 'Replace with', 'aria-label': 'Replacement text' });
  const caseSensitive = labelledCheckbox('Match case');
  const wholeCell = labelledCheckbox('Whole cell only');

  const wrap = el('div');
  const stat = el('div', { class: 'gs-mono gs-muted', style: { fontSize: '.78rem', margin: '.65rem 0' }, 'aria-live': 'polite' });
  const warnings = el('div', { style: { display: 'grid', gap: '.5rem', marginBottom: '.6rem' } });
  const operationStatus = el('div', { class: 'gs-mono gs-muted', style: { fontSize: '.73rem', margin: '.35rem 0 .2rem' }, 'aria-live': 'polite' });
  const thead = el('thead');
  const tbody = el('tbody');
  const table = el('div', { style: { overflowX: 'auto', marginTop: '.5rem' } }, el('table', { style: { width: '100%' } }, thead, tbody));

  let parsed;
  let latest = [];
  let latestFields = [];
  let refreshTimer = null;

  function sourceFields() {
    const fields = parsed?.meta?.fields || [];
    return normaliseCsvHeaders(fields, { trim: trimHeaders.input.checked }).fields;
  }

  function syncFieldList(container, selected, fields, { initialiseAll = false } = {}) {
    const existing = new Set([...selected].filter(field => fields.includes(field)));
    if (initialiseAll && !dedupeInitialised) fields.forEach(field => existing.add(field));
    selected.clear();
    existing.forEach(field => selected.add(field));
    container.replaceChildren();

    for (const field of fields) {
      const input = el('input', { type: 'checkbox', checked: selected.has(field) });
      input.addEventListener('change', () => {
        if (input.checked) selected.add(field); else selected.delete(field);
        scheduleRefresh();
      });
      container.append(el('label', {
        style: { display: 'flex', gap: '.35rem', alignItems: 'flex-start', cursor: 'pointer', minWidth: 0 },
      }, input, el('span', { class: 'gs-mono', style: { fontSize: '.7rem', overflowWrap: 'anywhere' } }, field)));
    }
    if (initialiseAll && !dedupeInitialised) dedupeInitialised = true;
  }

  function rebuildFieldControls() {
    const fields = sourceFields();
    syncFieldList(dedupeFieldList, dedupeFields, fields, { initialiseAll: true });
    syncFieldList(replaceFieldList, replaceFields, fields);
  }

  function clean() {
    const result = cleanCsvData(parsed.data, parsed.meta.fields || [], {
      trimCells: trimCells.input.checked,
      trimHeaders: trimHeaders.input.checked,
      dropEmptyRows: dropEmptyRows.input.checked,
      dropEmptyCols: dropEmptyCols.input.checked,
      dedupe: dedupe.input.checked,
      dedupeFields: [...dedupeFields],
      findReplace: {
        find: findInput.value,
        replace: replaceInput.value,
        fields: [...replaceFields],
        caseSensitive: caseSensitive.input.checked,
        wholeCell: wholeCell.input.checked,
      },
    });
    return result;
  }

  function refresh() {
    if (!parsed) return;
    const cleaned = clean();
    latest = cleaned.rows;
    latestFields = cleaned.fields;
    const detectedDelimiter = parsed.meta.delimiter || (delimiter.value === 'auto' ? ',' : delimiter.value);
    const facts = [
      `${parsed.data.length} rows in`, `${latest.length} rows out`, `${latestFields.length} columns`,
      `${delimiterLabel(detectedDelimiter)} delimited`, `decoded as ${parsed.encoding.toUpperCase()}`,
    ];
    if (cleaned.stats.duplicatesRemoved) facts.push(`${cleaned.stats.duplicatesRemoved} duplicate${cleaned.stats.duplicatesRemoved === 1 ? '' : 's'} removed`);
    if (cleaned.stats.replacements) facts.push(`${cleaned.stats.replacements} replacement${cleaned.stats.replacements === 1 ? '' : 's'}`);
    stat.textContent = facts.join(' · ');

    warnings.replaceChildren();
    if (file.size > 25 * 1024 * 1024) warnings.append(errorCard('This is a large file. Processing happens in memory, so changes may take longer to preview.', false));
    if (parsed.errors.length) warnings.append(errorCard(`${parsed.errors.length} parsing warning${parsed.errors.length === 1 ? '' : 's'}. First: ${parsed.errors[0].message}`, false));
    if (parsed.meta.renamedHeaders && Object.keys(parsed.meta.renamedHeaders).length) warnings.append(errorCard('Duplicate source headers were renamed by the CSV parser so values are not overwritten.', false));

    const notices = [];
    if (dedupe.input.checked && !dedupeFields.size) notices.push('Choose at least one dedupe key column; no rows are being deduplicated yet.');
    if (findInput.value && !replaceFields.size) notices.push('Choose at least one find/replace target column; no replacements are being made yet.');
    operationStatus.textContent = notices.join(' ');

    thead.replaceChildren(el('tr', {}, ...latestFields.map(column => el('th', { scope: 'col' }, column))));
    tbody.replaceChildren();
    for (const row of latest.slice(0, 12)) {
      tbody.append(el('tr', {}, ...latestFields.map(column => el('td', {}, row[column] ?? ''))));
    }
  }

  function scheduleRefresh() {
    clearTimeout(refreshTimer);
    refreshTimer = setTimeout(refresh, 120);
  }

  function reparse() {
    try {
      parsed = parseCsv(buffer, encoding.value, delimiter.value);
      dedupeInitialised = false;
      dedupeFields.clear();
      replaceFields.clear();
      rebuildFieldControls();
      refresh();
    } catch (err) {
      warnings.replaceChildren(errorCard('Could not decode or parse the file with those source settings: ' + err.message, false));
    }
  }

  const selectButtons = (selected, fieldsFn, container, isDedupe) => el('div', { class: 'gs-toolbar', style: { margin: '.25rem 0' } },
    el('button', { type: 'button', class: 'gs-btn gs-btn-ghost', onclick: () => {
      selected.clear(); fieldsFn().forEach(field => selected.add(field));
      syncFieldList(container, selected, fieldsFn());
      if (isDedupe) dedupeInitialised = true;
      refresh();
    } }, 'Select all'),
    el('button', { type: 'button', class: 'gs-btn gs-btn-ghost', onclick: () => {
      selected.clear(); syncFieldList(container, selected, fieldsFn()); refresh();
    } }, 'Clear'));

  const basicCard = el('section', { class: 'gs-card', style: { display: 'grid', gap: '.8rem' } },
    el('div', { class: 'gs-toolbar' },
      el('label', {}, el('span', { class: 'gs-label', style: { marginRight: '.45rem' } }, 'source encoding'), encoding),
      el('label', {}, el('span', { class: 'gs-label', style: { marginRight: '.45rem' } }, 'delimiter'), delimiter)),
    el('div', { class: 'gs-toolbar' }, trimCells.control, trimHeaders.control, dropEmptyRows.control, dropEmptyCols.control));

  const dedupeCard = el('details', { class: 'gs-card' },
    el('summary', { style: { cursor: 'pointer', fontFamily: 'var(--fh)' } }, 'Deduplicate by chosen columns'),
    el('div', { style: { marginTop: '.75rem' } },
      dedupe.control,
      el('p', { class: 'gs-muted', style: { fontSize: '.76rem', margin: '.4rem 0' } }, 'Rows with the same values in every selected key column are treated as duplicates. The first row is kept.'),
      selectButtons(dedupeFields, sourceFields, dedupeFieldList, true),
      dedupeFieldList));

  const replaceCard = el('details', { class: 'gs-card' },
    el('summary', { style: { cursor: 'pointer', fontFamily: 'var(--fh)' } }, 'Find & replace'),
    el('div', { style: { display: 'grid', gap: '.7rem', marginTop: '.75rem' } },
      el('div', { style: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(180px,1fr))', gap: '.6rem' } }, findInput, replaceInput),
      el('div', { class: 'gs-toolbar' }, caseSensitive.control, wholeCell.control),
      el('p', { class: 'gs-muted', style: { fontSize: '.76rem', margin: 0 } }, 'Replacement is literal, not a regular expression. Select the columns it is allowed to change; no target columns means no replacement.'),
      selectButtons(replaceFields, sourceFields, replaceFieldList, false),
      replaceFieldList));

  const reactive = [trimCells.input, trimHeaders.input, dropEmptyRows.input, dropEmptyCols.input, dedupe.input, caseSensitive.input, wholeCell.input];
  for (const control of reactive) {
    control.addEventListener('change', () => {
      if (control === trimHeaders.input) {
        dedupeInitialised = false;
        dedupeFields.clear();
        replaceFields.clear();
        rebuildFieldControls();
      }
      refresh();
    });
  }
  findInput.addEventListener('input', scheduleRefresh);
  replaceInput.addEventListener('input', scheduleRefresh);
  encoding.addEventListener('change', reparse);
  delimiter.addEventListener('change', reparse);

  const dlCsv = el('button', { class: 'gs-btn gs-btn-primary', onclick: () => {
    refresh();
    const actualDelimiter = parsed.meta.delimiter || (delimiter.value === 'auto' ? ',' : delimiter.value);
    const isTsv = actualDelimiter === '\t';
    const suffix = isTsv ? '-clean.tsv' : '-clean.csv';
    const base = file.name.replace(/\.(csv|tsv)$/i, '');
    const text = Papa.unparse({
      fields: latestFields,
      data: latest.map(row => latestFields.map(field => row[field] ?? '')),
    }, { delimiter: actualDelimiter, newline: '\r\n' });
    download(text, base + suffix, isTsv ? 'text/tab-separated-values;charset=utf-8' : 'text/csv;charset=utf-8');
  } }, 'Download clean file');
  const dlJson = el('button', { class: 'gs-btn gs-btn-ghost', onclick: () => {
    refresh();
    download(JSON.stringify(latest, null, 2), file.name.replace(/\.(csv|tsv)$/i, '') + '.json', 'application/json;charset=utf-8');
  } }, 'Download JSON');
  const again = el('button', { class: 'gs-btn gs-btn-ghost', onclick: start }, 'Another file');

  wrap.append(
    header('tool · data', 'CSV cleaner', null),
    el('div', { class: 'gs-mono', style: { fontSize: '.8rem', margin: '.25rem 0 .75rem' } }, file.name + ' · ' + fmtBytes(file.size)),
    basicCard, dedupeCard, replaceCard,
    stat, operationStatus, warnings, table,
    el('div', { class: 'gs-mono gs-muted', style: { fontSize: '.72rem', margin: '.4rem 0' } }, 'preview · first 12 rows · output is UTF-8 and preserves the selected/detected delimiter'),
    el('div', { class: 'gs-toolbar', style: { marginTop: '.5rem' } }, dlCsv, dlJson, again));
  render(wrap);
  reparse();
}

function errorCard(message, includeRetry = true) {
  const card = el('div', { class: 'gs-warn' }, el('span', {}, message));
  if (includeRetry) card.append(el('button', { class: 'gs-btn gs-btn-ghost', style: { marginLeft: 'auto' }, onclick: start }, 'Try another file'));
  return card;
}

start();
