import { chrome, header, assurance, dropzone, download, baseName, fmtBytes, el } from '../../src/shell.js';
import { decodeTextBuffer } from '../../src/lib/text.js';
import { transformRows } from '../../src/lib/pseudonymise.js';
import { sha256Hex } from '../../src/lib/digest.js';
import Papa from 'papaparse';

const root = chrome('data pseudonymiser');
let view;
function render(node) { if (view) view.remove(); view = node; root.append(node); }

function start() {
  const wrap = el('div');
  wrap.append(
    header('tool · privacy', 'Data pseudonymiser', 'Replace, mask, hash or remove selected CSV/TSV columns locally before sharing a dataset.'),
    el('div', { style:{ margin:'1rem 0 1.25rem' } }, assurance()),
    el('div', { class:'gs-warn', style:{ marginBottom:'1rem' } }, el('span', {}, 'Pseudonymised data can still be personal data. A mapping file is especially sensitive because it reverses stable pseudonyms.')),
    dropzone('.csv,.tsv,text/csv,text/tab-separated-values,text/plain',
      '<div style="font-family:var(--fh);color:var(--text);font-size:1.1rem;margin-bottom:.25rem">Drop a CSV or TSV, or click to choose</div>' +
      '<div class="gs-mono" style="font-size:.75rem;color:var(--muted)">stable IDs · masking · salted SHA-256 fingerprints · column removal</div>', handle),
  );
  render(wrap);
}

function parse(buffer) {
  const decoded = decodeTextBuffer(buffer, 'auto');
  const probe = Papa.parse(decoded.text, { header:false, skipEmptyLines:'greedy', dynamicTyping:false });
  const delimiter = probe.meta.delimiter || ',';
  const parsed = Papa.parse(decoded.text, { header:true, delimiter, skipEmptyLines:false, dynamicTyping:false });
  return { ...parsed, delimiter, encoding:decoded.encoding };
}

async function handle(file) {
  try {
    if (file.size > 100 * 1024 * 1024) throw new Error('Files over 100 MB are not opened by this tool. Split the data first.');
    const parsed = parse(await file.arrayBuffer());
    if (!parsed.meta.fields?.length) throw new Error('No header row was found.');
    showEditor(file, parsed);
  } catch (err) {
    render(el('div', { class:'gs-warn' }, el('strong', {}, 'Could not open that data. '), err.message,
      el('div', { style:{ marginTop:'.75rem' } }, el('button', { class:'gs-btn gs-btn-ghost', onclick:start }, 'Try another file'))));
  }
}

function showEditor(file, parsed) {
  const fields = parsed.meta.fields;
  const actions = Object.fromEntries(fields.map(field => [field, 'keep']));
  const prefix = el('input', { value:'P', maxlength:12, 'aria-label':'Pseudonym prefix', style:{ maxWidth:'9rem' } });
  const salt = el('input', { type:'text', value:'', placeholder:'optional local salt', 'aria-label':'Hash salt' });
  const hashLength = el('input', { type:'number', min:8, max:64, value:16, 'aria-label':'Hash output characters', style:{ width:'6rem' } });
  const includeMapping = el('input', { type:'checkbox', id:'include-mapping' });
  const tableBody = el('tbody');
  const status = el('div', { class:'gs-mono gs-muted', style:{ fontSize:'.76rem', margin:'.6rem 0' }, 'aria-live':'polite' });
  const preview = el('tbody');

  const actionOptions = [
    ['keep','Keep unchanged'], ['pseudonymise','Stable pseudonym'], ['mask','Mask value'], ['hash','Salted SHA-256 fingerprint'], ['remove','Remove column'],
  ];

  function actionSelect(field) {
    const select = el('select', { 'aria-label':`Action for ${field}` }, ...actionOptions.map(([value,label]) => el('option', { value, selected:value === actions[field] }, label)));
    select.addEventListener('change', () => { actions[field] = select.value; refreshPreview(); });
    return select;
  }

  for (const field of fields) {
    tableBody.append(el('tr', {},
      el('th', { scope:'row', style:{ textAlign:'left' } }, field),
      el('td', {}, actionSelect(field))));
  }

  async function transform() {
    return transformRows(parsed.data, fields, actions, {
      prefix:prefix.value.trim() || 'P',
      hashFn:sha256Hex,
      hashSalt:salt.value,
      hashLength:Number(hashLength.value) || 16,
    });
  }

  let previewToken = 0;
  async function refreshPreview() {
    const token = ++previewToken;
    status.textContent = 'Updating preview…';
    try {
      const result = await transformRows(parsed.data.slice(0, 8), fields, actions, {
        prefix:prefix.value.trim() || 'P', hashFn:sha256Hex, hashSalt:salt.value, hashLength:Number(hashLength.value) || 16,
      });
      if (token !== previewToken) return;
      preview.replaceChildren();
      for (const row of result.rows.slice(0, 8)) preview.append(el('tr', {}, ...result.fields.map(field => el('td', {}, row[field] ?? ''))));
      previewHead.replaceChildren(el('tr', {}, ...result.fields.map(field => el('th', { scope:'col' }, field))));
      const changed = Object.values(actions).filter(action => action !== 'keep').length;
      status.textContent = `${parsed.data.length} source rows · ${result.fields.length} output columns · ${changed} column action${changed === 1 ? '' : 's'}`;
    } catch (err) { status.textContent = 'Preview unavailable: ' + err.message; }
  }

  const previewHead = el('thead');
  const downloadData = el('button', { class:'gs-btn gs-btn-primary', onclick:async () => {
    downloadData.disabled = true;
    status.textContent = 'Transforming data…';
    try {
      const result = await transform();
      const isTsv = parsed.delimiter === '\t';
      const ext = isTsv ? 'tsv' : 'csv';
      const text = Papa.unparse({ fields:result.fields, data:result.rows.map(row => result.fields.map(field => row[field] ?? '')) }, { delimiter:parsed.delimiter, newline:'\r\n' });
      download(text, `${baseName(file.name)}-pseudonymised.${ext}`, isTsv ? 'text/tab-separated-values;charset=utf-8' : 'text/csv;charset=utf-8');
      if (includeMapping.checked && result.mapping.length) {
        const mappingText = Papa.unparse(result.mapping, { newline:'\r\n' });
        download(mappingText, `${baseName(file.name)}-pseudonym-mapping.csv`, 'text/csv;charset=utf-8');
      }
      status.textContent = includeMapping.checked && result.mapping.length ? 'Transformed data and sensitive mapping file downloaded.' : 'Transformed data downloaded.';
    } catch (err) { status.textContent = 'Could not transform data: ' + err.message; }
    finally { downloadData.disabled = false; }
  } }, 'Download transformed data');

  const mappingLabel = el('label', { for:'include-mapping', style:{ display:'flex', gap:'.5rem', alignItems:'flex-start', cursor:'pointer', fontSize:'.8rem' } }, includeMapping,
    el('span', {}, el('strong', {}, 'Also download reversible mapping'), ' — only stable pseudonym columns are included. Store this separately and securely.'));

  for (const input of [prefix, salt, hashLength]) input.addEventListener('input', () => refreshPreview());

  const wrap = el('div', { style:{ display:'grid', gap:'1rem' } },
    header('tool · privacy', 'Data pseudonymiser', null),
    el('section', { class:'gs-card' },
      el('div', { class:'gs-mono', style:{ fontSize:'.78rem' } }, `${file.name} · ${fmtBytes(file.size)}`),
      el('div', { class:'gs-muted', style:{ fontSize:'.76rem', marginTop:'.25rem' } }, `${parsed.encoding.toUpperCase()} · ${parsed.delimiter === '\t' ? 'tab' : parsed.delimiter === ',' ? 'comma' : parsed.delimiter} delimited`)),
    el('section', { class:'gs-card' },
      el('div', { class:'gs-label', style:{ marginBottom:'.5rem' } }, 'column actions'),
      el('div', { style:{ overflowX:'auto' } }, el('table', { style:{ width:'100%' } }, el('thead', {}, el('tr', {}, el('th', {}, 'Column'), el('th', {}, 'Action'))), tableBody))),
    el('section', { class:'gs-card', style:{ display:'grid', gap:'.65rem' } },
      el('div', { class:'gs-label' }, 'stable / hash settings'),
      el('div', { class:'gs-toolbar' },
        el('label', {}, el('span', { class:'gs-label', style:{ marginRight:'.4rem' } }, 'prefix'), prefix),
        el('label', {}, el('span', { class:'gs-label', style:{ marginRight:'.4rem' } }, 'hash chars'), hashLength)),
      el('label', {}, el('span', { class:'gs-label' }, 'hash salt'), salt,
        el('div', { class:'gs-muted', style:{ fontSize:'.72rem', marginTop:'.2rem' } }, 'A salt makes simple dictionary attacks harder, but hashing predictable values does not make them anonymous.')),
      mappingLabel),
    el('section', { class:'gs-card' },
      el('div', { class:'gs-label', style:{ marginBottom:'.45rem' } }, 'preview · first 8 rows'),
      status,
      el('div', { style:{ overflowX:'auto' } }, el('table', { style:{ width:'100%' } }, previewHead, preview))),
    el('div', { class:'gs-toolbar' }, downloadData, el('button', { class:'gs-btn gs-btn-ghost', onclick:start }, 'Another file')),
  );
  render(wrap);
  refreshPreview();
}

start();
