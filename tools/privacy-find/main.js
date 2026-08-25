import { chrome, header, assurance, dropzone, download, baseName, el } from '../../src/shell.js';
import { decodeTextBuffer } from '../../src/lib/text.js';
import { PERSONAL_DATA_TYPES, findPersonalData, groupPersonalData, redactDetectedText } from '../../src/lib/privacy.js';

const root = chrome('possible personal-data finder');
let sourceName = 'pasted-text';
let sourceText = '';

const wrap = el('div', { style:{ display:'grid', gap:'1rem' } });
const input = el('textarea', {
  rows:12,
  placeholder:'Paste text here, or drop a text/CSV/TSV file below…',
  'aria-label':'Text to scan for possible personal data',
  style:{ width:'100%', resize:'vertical' },
});
const status = el('div', { class:'gs-mono gs-muted', style:{ fontSize:'.75rem' }, 'aria-live':'polite' });
const summary = el('div');
const results = el('div');
const typeControls = new Map();

function typeSelector() {
  const box = el('div', { style:{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(180px,1fr))', gap:'.35rem .8rem' } });
  for (const { type, label } of PERSONAL_DATA_TYPES) {
    const checkbox = el('input', { type:'checkbox', checked:true });
    typeControls.set(type, checkbox);
    checkbox.addEventListener('change', scan);
    box.append(el('label', { style:{ display:'flex', gap:'.4rem', alignItems:'flex-start', cursor:'pointer', fontSize:'.8rem' } }, checkbox, el('span', {}, label)));
  }
  return box;
}

function selectedTypes() {
  return [...typeControls].filter(([, input]) => input.checked).map(([type]) => type);
}

function currentText() {
  return input.value;
}

function scan() {
  const text = currentText();
  sourceText = text;
  const matches = findPersonalData(text, { types:selectedTypes() });
  const grouped = groupPersonalData(matches);
  summary.replaceChildren();
  results.replaceChildren();

  if (!text.trim()) {
    status.textContent = 'Paste or load some text to scan.';
    return;
  }

  status.textContent = `${matches.length} possible match${matches.length === 1 ? '' : 'es'} · ${grouped.length} pattern type${grouped.length === 1 ? '' : 's'}`;
  if (!matches.length) {
    summary.append(el('div', { class:'gs-assurance' }, el('span', {}, 'No selected high-confidence patterns were found. This is not proof that the material contains no personal data.')));
    return;
  }

  const cards = el('div', { style:{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(220px,1fr))', gap:'.7rem' } });
  for (const group of grouped) {
    cards.append(el('section', { class:'gs-card' },
      el('div', { style:{ display:'flex', justifyContent:'space-between', gap:'1rem' } },
        el('strong', {}, group.label),
        el('span', { class:'gs-mono', style:{ fontSize:'.72rem' } }, String(group.count))),
      el('div', { class:'gs-muted gs-mono', style:{ fontSize:'.7rem', marginTop:'.4rem', overflowWrap:'anywhere' } }, group.examples.join(' · '))));
  }
  summary.append(cards);

  const table = el('table', { style:{ width:'100%' } },
    el('thead', {}, el('tr', {}, el('th', { scope:'col' }, 'Type'), el('th', { scope:'col' }, 'Position'), el('th', { scope:'col' }, 'Masked match'))),
    el('tbody', {}, ...matches.slice(0, 100).map(match => el('tr', {},
      el('td', {}, match.label),
      el('td', { class:'gs-mono' }, String(match.index)),
      el('td', { class:'gs-mono' }, groupPersonalData([match])[0]?.examples?.[0] || '')))));
  results.append(el('div', { style:{ overflowX:'auto' } }, table));
  if (matches.length > 100) results.append(el('div', { class:'gs-muted', style:{ fontSize:'.75rem', marginTop:'.4rem' } }, `Showing first 100 of ${matches.length} matches.`));
}

async function loadFile(file) {
  try {
    if (file.size > 30 * 1024 * 1024) throw new Error('Files over 30 MB are not opened here. Use a more targeted tool for very large datasets.');
    const decoded = decodeTextBuffer(await file.arrayBuffer(), 'auto');
    sourceName = file.name;
    input.value = decoded.text;
    status.textContent = `Loaded ${file.name} as ${decoded.encoding.toUpperCase()}`;
    scan();
  } catch (err) {
    status.textContent = 'Could not read that file: ' + err.message;
  }
}

const redactBtn = el('button', { class:'gs-btn gs-btn-primary', onclick:() => {
  const matches = findPersonalData(currentText(), { types:selectedTypes() });
  const redacted = redactDetectedText(currentText(), matches);
  download(redacted, `${baseName(sourceName)}-possible-personal-data-replaced.txt`, 'text/plain;charset=utf-8');
} }, 'Download review copy with matches replaced');

input.addEventListener('input', () => {
  clearTimeout(input._scanTimer);
  input._scanTimer = setTimeout(scan, 180);
});

wrap.append(
  header('tool · privacy', 'Possible personal-data finder', 'Highlight common patterns that may deserve a human check before text or tabular data is shared.'),
  el('div', { style:{ margin:'1rem 0 0' } }, assurance()),
  el('div', { class:'gs-warn' }, el('span', {}, 'This is a pattern finder, not a compliance decision. It does not reliably identify names, free-text context, safeguarding information or every form of personal data. False positives and false negatives are expected.')),
  el('section', { class:'gs-card' }, el('div', { class:'gs-label', style:{ marginBottom:'.5rem' } }, 'patterns to check'), typeSelector()),
  el('section', { class:'gs-card' }, input,
    el('div', { style:{ marginTop:'.65rem' } }, dropzone('.txt,.md,.csv,.tsv,.json,.yaml,.yml,text/plain,text/csv,text/tab-separated-values,application/json',
      '<div style="font-family:var(--fh);color:var(--text);font-size:.95rem">Or drop a text-like file</div><div class="gs-mono" style="font-size:.7rem;color:var(--muted)">decoded locally · no upload</div>', loadFile))),
  status,
  summary,
  results,
  el('div', { class:'gs-toolbar' }, redactBtn,
    el('a', { class:'gs-btn gs-btn-ghost', href:'../pseudonymise/index.html', style:{ textDecoration:'none' } }, 'Open data pseudonymiser →'),
    el('a', { class:'gs-btn gs-btn-ghost', href:'../redact/index.html', style:{ textDecoration:'none' } }, 'Open PDF/image redaction →')),
);
root.append(wrap);
scan();
