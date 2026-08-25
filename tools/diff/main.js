import { chrome, header, assurance, el, copyText } from '../../src/shell.js';
import { decodeTextBuffer } from '../../src/lib/text.js';
import { diffChars, diffLines, diffWords } from 'diff';
import { unzipSync } from 'fflate';
import * as pdfjsLib from 'pdfjs-dist';
import PdfWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?worker&inline';

pdfjsLib.GlobalWorkerOptions.workerPort = new PdfWorker();

const root = chrome('text & document diff');
root.append(
  header('tool · compare', 'Text & document diff', 'Paste text or load TXT/Markdown, DOCX or PDF on either side. The documents are converted to text locally before comparison.'),
  el('div', { style:{ margin:'1rem 0 .75rem' } }, assurance()),
  el('div', { class:'gs-warn' }, el('span', {}, 'Document comparison is based on extracted text, not layout, styles, comments, tracked-change state or images. Use the Office/PDF inspectors when those differences matter.')),
);

const a = el('textarea', { rows:9, placeholder:'Original…', spellcheck:false, 'aria-label':'Original text' });
const b = el('textarea', { rows:9, placeholder:'Changed…', spellcheck:false, 'aria-label':'Changed text' });
const aStatus = el('span', { class:'gs-mono gs-muted', style:{ fontSize:'.7rem' } }, 'pasted text');
const bStatus = el('span', { class:'gs-mono gs-muted', style:{ fontSize:'.7rem' } }, 'pasted text');
const modeSel = el('select', {},
  el('option', { value:'lines' }, 'By line'),
  el('option', { value:'words' }, 'By word'),
  el('option', { value:'chars' }, 'By character'));

const out = el('div', { class:'gs-card', style:{ marginTop:'1rem', whiteSpace:'pre-wrap', overflowWrap:'anywhere', fontFamily:'var(--fm)', fontSize:'.82rem', lineHeight:'1.6', minHeight:'3rem' }, 'aria-live':'polite' });
const stats = el('div', { class:'gs-mono gs-muted', style:{ fontSize:'.75rem', marginTop:'.5rem' } });

function seg(text, kind) {
  const style = kind === 'add' ? { background:'var(--soft-green)', color:'var(--green-dk)' }
    : kind === 'del' ? { background:'var(--gold-bg)', color:'#765b17', textDecoration:'line-through' } : {};
  return el('span', { style }, text);
}

function run() {
  const fn = modeSel.value === 'words' ? diffWords : modeSel.value === 'chars' ? diffChars : diffLines;
  const parts = fn(a.value, b.value);
  out.replaceChildren();
  let add = 0, del = 0;
  for (const p of parts) {
    if (p.added) add += p.count || 1;
    if (p.removed) del += p.count || 1;
    out.append(seg(p.value, p.added ? 'add' : p.removed ? 'del' : 'same'));
  }
  if (!a.value && !b.value) out.textContent = 'Diff appears here.';
  stats.textContent = `+${add} / −${del} (${modeSel.value}) · ${a.value.length.toLocaleString()} → ${b.value.length.toLocaleString()} characters`;
}

async function loadDocument(file, target, label) {
  try {
    if (file.size > 60 * 1024 * 1024) throw new Error('Files over 60 MB are not opened by this comparison tool.');
    label.textContent = `extracting ${file.name}…`;
    const bytes = new Uint8Array(await file.arrayBuffer());
    let text;
    if (/\.pdf$/i.test(file.name) || file.type === 'application/pdf') text = await extractPdf(bytes);
    else if (/\.docx$/i.test(file.name)) text = extractDocx(bytes);
    else text = decodeTextBuffer(bytes, 'auto').text;
    target.value = text;
    label.textContent = `${file.name} · ${text.length.toLocaleString()} extracted characters`;
    run();
  } catch (err) {
    label.textContent = `Could not load ${file.name}: ${err.message}`;
  }
}

async function extractPdf(bytes) {
  const doc = await pdfjsLib.getDocument({ data:bytes.slice(), enableScripting:false, isEvalSupported:false }).promise;
  const pages = [];
  for (let n = 1; n <= doc.numPages; n++) {
    const page = await doc.getPage(n);
    const content = await page.getTextContent();
    let line = '';
    let lastY = null;
    const lines = [];
    for (const item of content.items) {
      if (!('str' in item)) continue;
      const y = item.transform?.[5] ?? null;
      if (lastY != null && y != null && Math.abs(y - lastY) > 4 && line.trim()) { lines.push(line.trim()); line = ''; }
      line += (line ? ' ' : '') + item.str;
      lastY = y;
    }
    if (line.trim()) lines.push(line.trim());
    pages.push(lines.join('\n'));
  }
  return pages.join('\n\n--- page break ---\n\n');
}

function extractDocx(bytes) {
  const files = unzipSync(bytes);
  const xmlBytes = files['word/document.xml'];
  if (!xmlBytes) throw new Error('This DOCX does not contain word/document.xml.');
  let xml = new TextDecoder().decode(xmlBytes);
  xml = xml
    .replace(/<w:tab\b[^>]*\/>/gi, '\t')
    .replace(/<w:br\b[^>]*\/>/gi, '\n')
    .replace(/<\/w:p>/gi, '\n')
    .replace(/<\/w:tr>/gi, '\n')
    .replace(/<\/w:tc>/gi, '\t');
  const chunks = [];
  for (const match of xml.matchAll(/<w:t\b[^>]*>([\s\S]*?)<\/w:t>/gi)) chunks.push(decodeXml(match[1]));
  // Reconstruct paragraph boundaries using a second pass because w:t nodes alone omit them.
  const withBoundaries = xml.replace(/<w:t\b[^>]*>([\s\S]*?)<\/w:t>/gi, (_, text) => decodeXml(text)).replace(/<[^>]+>/g, '');
  return withBoundaries.replace(/\r/g, '').replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim() || chunks.join(' ');
}

function decodeXml(text) {
  return String(text).replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, '&');
}

function loader(target, label, sideName) {
  const input = el('input', { type:'file', accept:'.txt,.md,.docx,.pdf,text/plain,application/pdf', class:'gs-visually-hidden' });
  input.addEventListener('change', () => input.files[0] && loadDocument(input.files[0], target, label));
  return el('div', { class:'gs-toolbar', style:{ marginBottom:'.35rem' } },
    input,
    el('button', { class:'gs-btn gs-btn-ghost', onclick:() => input.click() }, `Load ${sideName} file`),
    label);
}

a.addEventListener('input', () => { aStatus.textContent = 'pasted / edited text'; run(); });
b.addEventListener('input', () => { bStatus.textContent = 'pasted / edited text'; run(); });
modeSel.addEventListener('change', run);

const copyChanged = el('button', { class:'gs-btn gs-btn-ghost', onclick:async () => {
  const ok = await copyText(b.value);
  copyChanged.textContent = ok ? 'Copied changed text' : 'Copy unavailable';
  setTimeout(() => { copyChanged.textContent = 'Copy changed text'; }, 1200);
} }, 'Copy changed text');
const clear = el('button', { class:'gs-btn gs-btn-ghost', onclick:() => { a.value = ''; b.value = ''; aStatus.textContent = 'pasted text'; bStatus.textContent = 'pasted text'; run(); a.focus(); } }, 'Clear');

root.append(
  el('div', { class:'gs-toolbar', style:{ margin:'1rem 0 .6rem' } }, el('label', {}, el('span', { class:'gs-label' }, 'compare '), modeSel), copyChanged, clear),
  el('div', { class:'gs-two-col' },
    el('div', {}, loader(a, aStatus, 'original'), a),
    el('div', {}, loader(b, bStatus, 'changed'), b)),
  stats, out);
run();
