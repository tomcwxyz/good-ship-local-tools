import { chrome, header, assurance, dropzone, download, baseName, fmtBytes, el } from '../../src/shell.js';
import { rebuildPdfStructure } from '../../src/lib/pdfsanitize.js';
import * as pdfjsLib from 'pdfjs-dist';
import PdfWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?worker&inline';

pdfjsLib.GlobalWorkerOptions.workerPort = new PdfWorker();

const root = chrome('pdf sanitiser');
let view;
function render(node) { if (view) view.remove(); view = node; root.append(node); }

function start() {
  const wrap = el('div');
  wrap.append(
    header('tool · privacy', 'PDF sanitiser', 'Create a fresh structural copy of a PDF that carries the visible page content forward without the original document-level interactive structure.'),
    el('div', { style:{ margin:'1rem 0 .75rem' } }, assurance()),
    el('div', { class:'gs-warn', style:{ marginBottom:'1rem' } }, el('span', {}, 'Structural rebuilding removes annotations, links, forms, attachments, document JavaScript, metadata and signatures by construction. It does not guarantee invisible/OCR text or other hidden material inside the page content stream is removed. Use raster redaction when that is the requirement.')),
    dropzone('application/pdf,.pdf', '<div style="font-family:var(--fh);color:var(--text);font-size:1.05rem;margin-bottom:.25rem">Drop a PDF, or click to choose</div><div class="gs-mono" style="font-size:.72rem;color:var(--muted)">inspect first · then explicitly rebuild</div>', inspect),
  );
  render(wrap);
}

async function inspect(file) {
  try {
    const bytes = new Uint8Array(await file.arrayBuffer());
    if (bytes.length > 180 * 1024 * 1024) throw new Error('Files over 180 MB are not opened by this tool.');
    const doc = await pdfjsLib.getDocument({ data:bytes.slice(), enableScripting:false, isEvalSupported:false }).promise;
    const [metadata, attachments, jsActions, fields, signatures] = await Promise.all([
      doc.getMetadata().catch(() => ({ info:{}, metadata:null })),
      doc.getAttachments().catch(() => null),
      doc.getJSActions().catch(() => null),
      doc.getFieldObjects().catch(() => null),
      typeof doc.getSignatures === 'function' ? doc.getSignatures().catch(() => null) : Promise.resolve(null),
    ]);
    let annotations = 0;
    for (let i = 1; i <= doc.numPages; i++) {
      const page = await doc.getPage(i);
      annotations += (await page.getAnnotations({ intent:'display' }).catch(() => [])).length;
    }
    showResult(file, bytes, {
      pages:doc.numPages,
      metadata:Object.keys(metadata.info || {}).length + Object.keys(metadata.metadata?.getAll?.() || {}).length,
      attachments:count(attachments), jsActions:count(jsActions), fields:count(fields),
      signatures:Array.isArray(signatures) ? signatures.length : count(signatures), annotations,
    });
  } catch (err) {
    render(el('div', { class:'gs-warn' }, el('strong', {}, 'Could not inspect this PDF. '), err.message,
      el('div', { style:{ marginTop:'.75rem' } }, el('button', { class:'gs-btn gs-btn-ghost', onclick:start }, 'Try another PDF'))));
  }
}

function count(value) {
  if (!value) return 0;
  if (Array.isArray(value)) return value.length;
  if (typeof value.size === 'number') return value.size;
  return Object.keys(value).length;
}

function showResult(file, bytes, signals) {
  const status = el('div', { class:'gs-mono gs-muted', style:{ fontSize:'.76rem' }, 'aria-live':'polite' });
  const acknowledgement = el('input', { type:'checkbox', id:'sanitize-ack' });
  const featureRows = [
    ['Pages', signals.pages], ['Metadata fields', signals.metadata], ['Attachments', signals.attachments], ['Form field groups', signals.fields],
    ['JavaScript action groups', signals.jsActions], ['Annotations / links', signals.annotations], ['Digital signatures', signals.signatures],
  ];
  const card = el('section', { class:'gs-card' },
    el('div', { style:{ display:'flex', justifyContent:'space-between', gap:'1rem', flexWrap:'wrap' } },
      el('div', {}, el('strong', {}, file.name), el('div', { class:'gs-muted', style:{ fontSize:'.76rem', marginTop:'.2rem' } }, `${signals.pages} page${signals.pages === 1 ? '' : 's'}`)),
      el('span', { class:'gs-mono gs-muted', style:{ fontSize:'.72rem' } }, fmtBytes(bytes.length))),
    el('div', { style:{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(170px,1fr))', gap:'.45rem .8rem', marginTop:'.75rem' } },
      ...featureRows.map(([label,value]) => el('div', { style:{ borderTop:'1px solid var(--border)', paddingTop:'.4rem' } },
        el('div', { class:'gs-label' }, label), el('div', { class:'gs-mono', style:{ fontSize:'.8rem', marginTop:'.15rem' } }, String(value))))));

  const explanation = el('section', { class:'gs-card' },
    el('div', { class:'gs-label', style:{ marginBottom:'.5rem' } }, 'what the rebuilt copy does'),
    el('ul', { style:{ margin:'0 0 .8rem', paddingLeft:'1.2rem', fontSize:'.82rem' } },
      el('li', {}, 'Embeds each visible source page into a new PDF page.'),
      el('li', {}, 'Does not copy the source document catalog, forms, annotations/links, attachments, scripts, metadata or signatures.'),
      el('li', {}, 'Keeps page graphics/text as PDF content rather than rasterising them.')),
    el('div', { class:'gs-warn' }, el('span', {}, 'Because page content itself is preserved, invisible OCR text, clipped text or other hidden objects inside that content can remain. For disclosure-safe removal, use raster redaction.')),
    el('label', { for:'sanitize-ack', style:{ display:'flex', gap:'.5rem', alignItems:'flex-start', cursor:'pointer', fontSize:'.82rem', marginTop:'.75rem' } }, acknowledgement,
      el('span', {}, 'I understand this creates a structurally simplified copy and invalidates signatures/interactivity, but is not a substitute for redaction of sensitive page content.')));

  const build = el('button', { class:'gs-btn gs-btn-primary', onclick:async () => {
    if (!acknowledgement.checked) { status.textContent = 'Confirm the structural-rebuild limitation before creating the copy.'; return; }
    build.disabled = true; status.textContent = 'Rebuilding pages into a fresh PDF…';
    try {
      const result = await rebuildPdfStructure(bytes);
      download(result.bytes, `${baseName(file.name)}-structural-clean.pdf`, 'application/pdf');
      status.textContent = `${result.pages} page${result.pages === 1 ? '' : 's'} rebuilt into a fresh PDF.`;
    } catch (err) { status.textContent = 'Could not rebuild this PDF: ' + err.message; }
    finally { build.disabled = false; }
  } }, 'Create structural clean copy');

  const wrap = el('div', { style:{ display:'grid', gap:'1rem' } },
    header('tool · privacy', 'PDF sanitiser', null), card, explanation,
    el('div', { class:'gs-toolbar' }, build,
      el('a', { class:'gs-btn gs-btn-ghost', href:'../redact/index.html', style:{ textDecoration:'none' } }, 'Need stronger redaction? →'),
      el('a', { class:'gs-btn gs-btn-ghost', href:'../pdf-inspect/index.html', style:{ textDecoration:'none' } }, 'Metadata-only inspector →'),
      el('button', { class:'gs-btn gs-btn-ghost', onclick:start }, 'Another PDF')),
    status,
  );
  render(wrap);
}

start();
