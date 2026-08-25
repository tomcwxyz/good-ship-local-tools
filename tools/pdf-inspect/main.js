import { chrome, header, assurance, dropzone, download, fmtBytes, baseName, el } from '../../src/shell.js';
import * as pdfjsLib from 'pdfjs-dist';
import PdfWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?worker&inline';
import { cleanPdfDocumentMetadata } from '../../src/lib/pdfprivacy.js';

pdfjsLib.GlobalWorkerOptions.workerPort = new PdfWorker();

const root = chrome('pdf privacy inspector');
let view;
function render(node) { if (view) view.remove(); view = node; root.append(node); }

function start() {
  const box = el('div');
  box.append(
    header('tool · privacy', 'PDF privacy inspector',
      'See document metadata, attachments, forms, JavaScript and signatures before you share a PDF — then remove metadata if that is the job you need.'),
    el('div', { style:{ margin:'1rem 0 .75rem' } }, assurance()),
    el('div', { class:'gs-warn', style:{ marginBottom:'1rem' } }, el('span', {}, 'Metadata cleaning is not full sanitisation. Attachments, forms, scripts and page content are reported separately and are not silently deleted.')),
    dropzone('application/pdf,.pdf',
      '<div style="font-family:var(--fh);color:var(--text);font-size:1.1rem;margin-bottom:.25rem">Drop a PDF, or click to choose</div>' +
      '<div class="gs-mono" style="font-size:.75rem;color:var(--muted)">inspection happens locally · scripting disabled</div>', handle),
  );
  render(box);
}

async function handle(file) {
  try {
    const bytes = new Uint8Array(await file.arrayBuffer());
    if (bytes.length > 180 * 1024 * 1024) throw new Error('Files over 180 MB are not opened by this tool.');
    const doc = await pdfjsLib.getDocument({ data: bytes.slice(), enableScripting:false, isEvalSupported:false }).promise;
    const [metadata, attachments, jsActions, fields, signatures, markInfo, permissions] = await Promise.all([
      doc.getMetadata().catch(() => ({ info:{}, metadata:null })),
      doc.getAttachments().catch(() => null),
      doc.getJSActions().catch(() => null),
      doc.getFieldObjects().catch(() => null),
      typeof doc.getSignatures === 'function' ? doc.getSignatures().catch(() => null) : Promise.resolve(null),
      doc.getMarkInfo().catch(() => null),
      doc.getPermissions().catch(() => null),
    ]);
    const xmp = metadata.metadata?.getAll?.() || {};
    showResult(file, bytes, doc.numPages, metadata.info || {}, xmp, {
      attachments: collectionSize(attachments),
      jsActions: collectionSize(jsActions),
      fields: collectionSize(fields),
      signatures: Array.isArray(signatures) ? signatures.length : collectionSize(signatures),
      tagged: Boolean(markInfo?.Marked),
      permissions: collectionSize(permissions),
    });
  } catch (err) {
    const msg = /password/i.test(err?.message || '') ? 'Password-protected PDFs need to be unlocked first.' : (err?.message || String(err));
    showError(msg);
  }
}

function collectionSize(value) {
  if (!value) return 0;
  if (typeof value.size === 'number') return value.size;
  if (Array.isArray(value)) return value.length;
  return Object.keys(value).length;
}

function displayValue(value) {
  if (value == null || value === '') return '';
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) return value.join(', ');
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}

function propRow(label, value) {
  return el('div', { style:{ display:'grid', gridTemplateColumns:'minmax(120px,.8fr) minmax(0,1.5fr)', gap:'.75rem', padding:'.42rem 0', borderBottom:'1px solid var(--border)', fontSize:'.84rem' } },
    el('span', { class:'gs-mono gs-muted', style:{ fontSize:'.72rem' } }, label),
    el('span', { style:{ overflowWrap:'anywhere' } }, value));
}

function feature(label, count, note, { warn = false } = {}) {
  const found = count > 0;
  const box = el('div', { style:{ padding:'.55rem 0', borderBottom:'1px solid var(--border)' } });
  box.append(
    el('div', { style:{ display:'flex', justifyContent:'space-between', gap:'1rem' } },
      el('strong', { style:{ fontSize:'.86rem' } }, label),
      el('span', { class:'gs-mono', style:{ fontSize:'.72rem', color: found && warn ? 'var(--gold)' : 'var(--muted)' } }, String(count))),
    el('div', { class:'gs-muted', style:{ fontSize:'.76rem', marginTop:'.18rem' } }, note));
  return box;
}

function showResult(file, bytes, pages, info, xmp, signals) {
  const wrap = el('div', { style:{ display:'flex', flexDirection:'column', gap:'1rem' } });
  const intro = el('div', { class:'gs-card', style:{ display:'flex', justifyContent:'space-between', gap:'1rem', flexWrap:'wrap' } },
    el('div', {}, el('div', { class:'gs-mono', style:{ fontSize:'.8rem' } }, file.name), el('div', { class:'gs-muted', style:{ fontSize:'.8rem', marginTop:'.2rem' } }, `${pages} page${pages === 1 ? '' : 's'}`)),
    el('div', { class:'gs-mono gs-muted', style:{ fontSize:'.72rem' } }, fmtBytes(bytes.length)));

  const props = el('section', { class:'gs-card' }, el('div', { class:'gs-label', style:{ marginBottom:'.5rem' } }, 'document metadata'));
  const skipInfo = new Set(['PDFFormatVersion','IsAcroFormPresent','IsXFAPresent','IsCollectionPresent','IsSignaturesPresent']);
  let propCount = 0;
  for (const [key, value] of Object.entries(info)) {
    if (skipInfo.has(key)) continue;
    if (key === 'Custom' && value && typeof value === 'object') {
      for (const [customKey, customValue] of Object.entries(value)) {
        const shown = displayValue(customValue);
        if (!shown) continue;
        props.append(propRow(`Custom · ${customKey}`, shown)); propCount++;
      }
      continue;
    }
    const shown = displayValue(value);
    if (!shown) continue;
    props.append(propRow(key, shown)); propCount++;
  }
  for (const [key, value] of Object.entries(xmp)) {
    const shown = displayValue(value);
    if (!shown) continue;
    props.append(propRow(`XMP · ${key}`, shown)); propCount++;
  }
  if (!propCount) props.append(el('div', { class:'gs-muted', style:{ fontSize:'.84rem' } }, 'No common Info/XMP metadata was reported.'));

  const features = el('section', { class:'gs-card' }, el('div', { class:'gs-label', style:{ marginBottom:'.35rem' } }, 'embedded / active features'));
  features.append(
    feature('Attachments', signals.attachments, 'Files embedded inside the PDF. Metadata cleaning does not remove them.', { warn:true }),
    feature('Form fields', signals.fields, 'Interactive form data can contain personal information and remains in the file.', { warn:true }),
    feature('JavaScript actions', signals.jsActions, 'PDF JavaScript is not executed by this tool and is not removed by metadata cleaning.', { warn:true }),
    feature('Digital signatures', signals.signatures, 'Any rewritten copy will invalidate existing digital signatures.', { warn:true }),
    feature('Permission flags', signals.permissions, 'Viewer permissions are informational and do not guarantee confidentiality.'),
    feature('Tagged PDF', signals.tagged ? 1 : 0, 'Tagged structure supports accessibility and is preserved.'));

  const cleanCard = el('section', { class:'gs-card' });
  cleanCard.append(el('div', { class:'gs-label', style:{ marginBottom:'.45rem' } }, 'metadata cleaning'),
    el('p', { style:{ fontSize:'.84rem', marginTop:0 } }, 'Removes the PDF document information dictionary and document-level XMP metadata stream. Page content and the features listed above are preserved.'));

  let acknowledge = null;
  if (signals.signatures) {
    const id = 'pdf-signature-ack';
    acknowledge = el('input', { type:'checkbox', id });
    cleanCard.append(el('div', { class:'gs-warn', style:{ marginBottom:'.65rem' } },
      el('label', { for:id, style:{ display:'flex', gap:'.55rem', alignItems:'flex-start', cursor:'pointer' } }, acknowledge,
        el('span', {}, 'I understand that creating a cleaned copy will invalidate the existing digital signature(s).'))));
  }
  const status = el('div', { class:'gs-mono gs-muted', style:{ fontSize:'.75rem', marginTop:'.55rem' }, 'aria-live':'polite' });
  const clean = el('button', { class:'gs-btn gs-btn-primary', onclick:async () => {
    if (acknowledge && !acknowledge.checked) { status.textContent = 'Confirm the signature warning before creating a cleaned copy.'; return; }
    try {
      status.textContent = 'Removing document metadata…';
      const result = await cleanPdfDocumentMetadata(bytes);
      if (!result.removed.length) { status.textContent = 'No document Info/XMP metadata was present to remove.'; return; }
      download(result.bytes, `${baseName(file.name)}-metadata-clean.pdf`, 'application/pdf');
      status.textContent = `Cleaned copy created · ${result.removed.join(' · ')}`;
    } catch (err) { status.textContent = 'Could not clean this PDF: ' + err.message; }
  } }, 'Remove metadata & download');
  cleanCard.append(clean, status);

  const stronger = el('div', { class:'gs-warn' }, el('div', {},
    el('strong', {}, 'Need a stronger disclosure-safe copy? '),
    el('span', {}, 'Use the redaction tool to rasterise/flatten pages. That is destructive, but it removes selectable text, forms, links and hidden document structure from the output. '),
    el('a', { href:'../redact/index.html' }, 'Open redaction →')));

  wrap.append(intro, props, features, cleanCard, stronger,
    el('button', { class:'gs-btn gs-btn-ghost', style:{ alignSelf:'flex-start' }, onclick:start }, 'Another PDF'));
  render(wrap);
}

function showError(message) {
  render(el('div', { class:'gs-warn' }, el('div', {}, el('strong', {}, 'Could not inspect this PDF. '), message),
    el('button', { class:'gs-btn gs-btn-ghost', style:{ marginTop:'.75rem' }, onclick:start }, 'Try another PDF')));
}

start();
