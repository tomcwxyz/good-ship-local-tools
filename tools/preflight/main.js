import { chrome, header, assurance, dropzoneMulti, download, fmtBytes, el } from '../../src/shell.js';
import { processJPEG, processPNG } from '../../src/lib/metadata.js';
import { inspectZipCentralDirectory, inspectOfficePackage, detectOfficeKind } from '../../src/lib/ooxml.js';
import { decodeTextBuffer } from '../../src/lib/text.js';
import { findPersonalData, groupPersonalData } from '../../src/lib/privacy.js';
import { unzipSync } from 'fflate';
import * as pdfjsLib from 'pdfjs-dist';
import PdfWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?worker&inline';

pdfjsLib.GlobalWorkerOptions.workerPort = new PdfWorker();

const root = chrome('publication preflight');
const results = [];
const wrap = el('div', { style:{ display:'grid', gap:'1rem' } });
const status = el('div', { class:'gs-mono gs-muted', style:{ fontSize:'.76rem' }, 'aria-live':'polite' });
const resultGrid = el('div', { style:{ display:'grid', gap:'.7rem' } });

wrap.append(
  header('tool · privacy', 'Publication preflight', 'Drop a mixed set of files and get one local checklist of things worth inspecting before they leave your machine.'),
  el('div', { style:{ margin:'1rem 0 0' } }, assurance()),
  el('div', { class:'gs-warn' }, el('span', {}, 'Preflight flags signals; it does not certify a file safe to publish. Visible content, context, names and organisation-specific risks still need human review.')),
  dropzoneMulti('.pdf,.docx,.xlsx,.pptx,.docm,.xlsm,.pptm,.jpg,.jpeg,.png,.txt,.md,.csv,.tsv,.json,.yaml,.yml',
    '<div style="font-family:var(--fh);color:var(--text);font-size:1.05rem;margin-bottom:.25rem">Drop files to preflight</div><div class="gs-mono" style="font-size:.72rem;color:var(--muted)">PDF · Office OOXML · JPEG/PNG · text/CSV/TSV/JSON/YAML</div>', inspectFiles),
  status,
  resultGrid,
);
root.append(wrap);

async function inspectFiles(files) {
  const accepted = files.filter(file => file.size <= 180 * 1024 * 1024);
  const total = accepted.reduce((sum, file) => sum + file.size, 0);
  if (total > 400 * 1024 * 1024) {
    status.textContent = 'That selection is over 400 MB. Split it into smaller batches so the browser does not hold too much data at once.';
    return;
  }
  results.length = 0;
  resultGrid.replaceChildren();
  for (let i = 0; i < accepted.length; i++) {
    const file = accepted[i];
    status.textContent = `Inspecting ${i + 1} of ${accepted.length} · ${file.name}`;
    try { results.push(await inspectOne(file)); }
    catch (err) { results.push({ name:file.name, size:file.size, kind:'unknown', severity:'error', findings:[`Could not inspect: ${err.message}`], actions:[] }); }
    renderResults();
  }
  status.textContent = `${results.length} file${results.length === 1 ? '' : 's'} checked locally · ${results.filter(r => r.severity === 'attention').length} need attention`;
}

async function inspectOne(file) {
  const bytes = new Uint8Array(await file.arrayBuffer());
  const lower = file.name.toLowerCase();
  const filenameMatches = groupPersonalData(findPersonalData(file.name));
  const base = { name:file.name, size:file.size, kind:'unknown', severity:'clear', findings:[], actions:[], filenameSignals:filenameMatches.map(item => ({ label:item.label, count:item.count })) };
  if (filenameMatches.length) base.findings.push(`Filename contains ${filenameMatches.map(item => item.label.toLowerCase()).join(', ')} pattern(s).`);

  if (/\.jpe?g$/i.test(lower) || /jpeg/i.test(file.type)) return inspectImage(base, bytes, 'jpeg');
  if (/\.png$/i.test(lower) || /png/i.test(file.type)) return inspectImage(base, bytes, 'png');
  if (/\.(docx|xlsx|pptx|docm|xlsm|pptm)$/i.test(lower)) return inspectOffice(base, bytes);
  if (/\.pdf$/i.test(lower) || file.type === 'application/pdf') return inspectPdf(base, bytes);
  if (/\.(txt|md|csv|tsv|json|ya?ml)$/i.test(lower) || /^text\//.test(file.type)) return inspectText(base, bytes);
  base.findings.push('Unsupported file type: only the filename and file size were checked.');
  return base;
}

function inspectImage(base, bytes, kind) {
  base.kind = kind === 'jpeg' ? 'JPEG image' : 'PNG image';
  const result = kind === 'jpeg' ? processJPEG(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength)) : processPNG(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength));
  if (!result) throw new Error('File signature does not match its image type.');
  if (result.removed.length) base.findings.push(`${result.removed.length} metadata block${result.removed.length === 1 ? '' : 's'} present.`);
  if (result.exif?.gps) base.findings.push('EXIF contains GPS/location information.');
  if (result.exif?.make || result.exif?.model) base.findings.push('EXIF contains camera/device information.');
  if (result.removed.length) base.actions.push('metadata');
  return finish(base);
}

function inspectOffice(base, bytes) {
  const zip = inspectZipCentralDirectory(bytes);
  const files = unzipSync(bytes);
  const kind = detectOfficeKind(files);
  if (!kind) throw new Error('This ZIP does not look like a supported Office OOXML document.');
  base.kind = kind;
  const r = inspectOfficePackage(files);
  const metadataCount = Object.keys(r.core).length + Object.keys(r.app).length + r.custom.length;
  if (metadataCount) base.findings.push(`${metadataCount} document property value${metadataCount === 1 ? '' : 's'} present.`);
  const labels = {
    comments:'comments', trackedChanges:'tracked changes', notes:'presentation notes', hiddenSheets:'hidden sheets', macros:'macros', embeddedFiles:'embedded files', externalLinks:'external links', thumbnail:'document thumbnail',
  };
  for (const [key, label] of Object.entries(labels)) {
    const value = r.signals[key];
    if (value === true || Number(value) > 0) base.findings.push(`${typeof value === 'number' ? value + ' ' : ''}${label} present.`);
  }
  if (metadataCount) base.actions.push('office');
  if (Object.entries(r.signals).some(([, value]) => value === true || Number(value) > 0)) base.actions.push('manual-review');
  base.package = { entries:zip.entries, expandedBytes:zip.totalUncompressed };
  return finish(base);
}

async function inspectPdf(base, bytes) {
  base.kind = 'PDF';
  const doc = await pdfjsLib.getDocument({ data:bytes.slice(), enableScripting:false, isEvalSupported:false }).promise;
  const [metadata, attachments, jsActions, fields, signatures] = await Promise.all([
    doc.getMetadata().catch(() => ({ info:{}, metadata:null })),
    doc.getAttachments().catch(() => null),
    doc.getJSActions().catch(() => null),
    doc.getFieldObjects().catch(() => null),
    typeof doc.getSignatures === 'function' ? doc.getSignatures().catch(() => null) : Promise.resolve(null),
  ]);
  const infoValues = Object.values(metadata.info || {}).filter(value => value != null && value !== '' && typeof value !== 'object').length;
  const xmpValues = Object.keys(metadata.metadata?.getAll?.() || {}).length;
  if (infoValues + xmpValues) base.findings.push(`${infoValues + xmpValues} document metadata field${infoValues + xmpValues === 1 ? '' : 's'} present.`);
  const features = [
    ['attachments', count(attachments)], ['form field groups', count(fields)], ['JavaScript action groups', count(jsActions)], ['digital signatures', Array.isArray(signatures) ? signatures.length : count(signatures)],
  ];
  for (const [label, value] of features) if (value) base.findings.push(`${value} ${label} present.`);
  if (infoValues + xmpValues) base.actions.push('pdf-inspect');
  if (features.some(([, value]) => value)) base.actions.push('manual-review');
  base.pages = doc.numPages;
  return finish(base);
}

function inspectText(base, bytes) {
  base.kind = 'Text / tabular data';
  if (bytes.length > 12 * 1024 * 1024) {
    base.findings.push('Text-like file is over 12 MB, so content pattern scanning was skipped.');
    return finish(base);
  }
  const decoded = decodeTextBuffer(bytes, 'auto');
  const groups = groupPersonalData(findPersonalData(decoded.text, { maxMatches:2000 }));
  for (const group of groups) base.findings.push(`${group.count} possible ${group.label.toLowerCase()} match${group.count === 1 ? '' : 'es'}.`);
  if (groups.length) base.actions.push('privacy-find');
  base.encoding = decoded.encoding;
  return finish(base);
}

function count(value) {
  if (!value) return 0;
  if (Array.isArray(value)) return value.length;
  if (typeof value.size === 'number') return value.size;
  return Object.keys(value).length;
}

function finish(result) {
  if (result.findings.length) result.severity = 'attention';
  return result;
}

function renderResults() {
  resultGrid.replaceChildren();
  for (const result of results) {
    const card = el('section', { class:'gs-card' });
    card.append(
      el('div', { style:{ display:'flex', justifyContent:'space-between', gap:'1rem', flexWrap:'wrap' } },
        el('div', {}, el('strong', {}, result.name), el('div', { class:'gs-muted', style:{ fontSize:'.76rem', marginTop:'.2rem' } }, result.kind)),
        el('div', { class:'gs-mono', style:{ fontSize:'.72rem', color:result.severity === 'attention' || result.severity === 'error' ? 'var(--gold)' : 'var(--muted)' } }, `${fmtBytes(result.size)} · ${result.severity === 'clear' ? 'no selected signals' : result.severity}`)),
    );
    if (!result.findings.length) card.append(el('div', { class:'gs-assurance', style:{ marginTop:'.6rem' } }, el('span', {}, 'No selected preflight signals found. Still review the visible content and context.')));
    else card.append(el('ul', { style:{ margin:'.65rem 0 0', paddingLeft:'1.2rem' } }, ...result.findings.map(item => el('li', { style:{ margin:'.25rem 0', fontSize:'.82rem' } }, item))));
    const actions = el('div', { class:'gs-toolbar', style:{ marginTop:'.7rem' } });
    if (result.actions.includes('metadata')) actions.append(link('../metadata/index.html', 'Strip image metadata →'));
    if (result.actions.includes('office')) actions.append(link('../office/index.html', 'Inspect Office file →'));
    if (result.actions.includes('pdf-inspect')) actions.append(link('../pdf-inspect/index.html', 'Inspect PDF →'));
    if (result.actions.includes('privacy-find')) actions.append(link('../privacy-find/index.html', 'Review possible personal data →'));
    if (actions.childNodes.length) card.append(actions);
    resultGrid.append(card);
  }
  if (results.length) {
    resultGrid.append(el('div', { class:'gs-toolbar' },
      el('button', { class:'gs-btn gs-btn-ghost', onclick:() => download(JSON.stringify({ tool:'publication-preflight', generatedAt:new Date().toISOString(), files:results }, null, 2), 'publication-preflight.json', 'application/json;charset=utf-8') }, 'Download JSON checklist'),
      el('button', { class:'gs-btn gs-btn-ghost', onclick:() => { results.length = 0; resultGrid.replaceChildren(); status.textContent = ''; } }, 'Clear')));
  }
}

function link(href, text) { return el('a', { href, class:'gs-btn gs-btn-ghost', style:{ textDecoration:'none' } }, text); }
