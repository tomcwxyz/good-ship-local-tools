import { chrome, header, assurance, download, el } from '../../src/shell.js';
import * as pdfjsLib from 'pdfjs-dist';
import PdfWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?worker&inline';
import { PDFDocument, StandardFonts, degrees, rgb } from 'pdf-lib';
import { cleanPdfDocumentMetadata } from '../../src/lib/pdfprivacy.js';
import { fitRect, normaliseCrop, pageNumberText, pageSize, parsePageSelection } from '../../src/lib/pdfworkbench.js';

pdfjsLib.GlobalWorkerOptions.workerPort = new PdfWorker();

const root = chrome('pdf workbench');
const sources = []; // { name, bytes, fields, signatures, jsActions, annotations }
let pages = []; // pdf | blank | image items
let dragIndex = null;

const box = el('div');
box.append(
  header('tool · documents', 'PDF workbench', 'Merge, extract, reorder and prepare PDF packs locally — including blank/image pages, numbering, watermarks, crop boxes and optional form flattening.'),
  el('div', { style:{ margin:'1rem 0 1.25rem' } }, assurance()),
  el('div', { class:'gs-warn', style:{ marginBottom:'1rem' } }, el('span', {}, 'This edits page structure and overlays. It does not reliably edit existing PDF text. Exporting a signed PDF invalidates its signature. Crop settings change the visible crop box; they do not erase hidden page content.')),
);

const grid = el('div', { style:{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(170px,1fr))', gap:'.75rem', margin:'1rem 0' } });
const bar = el('div', { class:'gs-toolbar', style:{ margin:'1rem 0' } });
const status = el('div', { class:'gs-mono gs-muted', style:{ fontSize:'.78rem' }, 'aria-live':'polite' });

const input = el('input', { type:'file', accept:'application/pdf,.pdf,image/png,image/jpeg,.png,.jpg,.jpeg', multiple:true, class:'gs-visually-hidden' });
input.addEventListener('change', () => addFiles([...input.files]));
const drop = el('div', { class:'gs-drop', role:'button', tabIndex:0, 'aria-label':'Choose PDF or image files, or drop them here' }, input);
drop.insertAdjacentHTML('afterbegin', '<div style="font-family:var(--fh);color:var(--text);font-size:1.1rem;margin-bottom:.25rem">Drop PDF(s) or images, or click to choose</div><div class="gs-mono" style="font-size:.75rem;color:var(--muted)">PDFs merge · JPEG/PNG become printable pages · drag cards to reorder</div>');
drop.addEventListener('click', e => { if (e.target !== input) input.click(); });
drop.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); input.click(); } });
drop.addEventListener('dragover', e => { e.preventDefault(); drop.classList.add('drag'); });
drop.addEventListener('dragleave', () => drop.classList.remove('drag'));
drop.addEventListener('drop', e => { e.preventDefault(); drop.classList.remove('drag'); addFiles([...e.dataTransfer.files]); });

const rangeInput = el('input', { type:'text', placeholder:'e.g. 1-3, 7', 'aria-label':'Page range to select', style:{ minWidth:'10rem' } });
const blankSize = el('select', {}, el('option', { value:'a4' }, 'A4'), el('option', { value:'letter' }, 'Letter'));
const blankOrientation = el('select', {}, el('option', { value:'portrait' }, 'Portrait'), el('option', { value:'landscape' }, 'Landscape'));
const imagePageSize = el('select', {}, el('option', { value:'a4' }, 'A4 image pages'), el('option', { value:'letter' }, 'Letter image pages'));

const numberPages = el('input', { type:'checkbox', id:'number-pages' });
const numberTemplate = el('input', { value:'Page {n} of {total}', 'aria-label':'Page number template' });
const numberStart = el('input', { type:'number', value:1, min:-9999, max:99999, style:{ width:'6rem' }, 'aria-label':'Starting page number' });
const numberPosition = el('select', {},
  el('option', { value:'bottom-center' }, 'Bottom centre'), el('option', { value:'bottom-right' }, 'Bottom right'),
  el('option', { value:'bottom-left' }, 'Bottom left'), el('option', { value:'top-center' }, 'Top centre'),
  el('option', { value:'top-right' }, 'Top right'), el('option', { value:'top-left' }, 'Top left'));
const watermark = el('input', { type:'text', placeholder:'e.g. DRAFT or CONFIDENTIAL', 'aria-label':'Watermark text' });
const flattenForms = el('input', { type:'checkbox', id:'flatten-forms' });
const removeMetadata = el('input', { type:'checkbox', id:'remove-metadata', checked:true });
const metaTitle = el('input', { type:'text', placeholder:'optional title', 'aria-label':'PDF title' });
const metaAuthor = el('input', { type:'text', placeholder:'optional author', 'aria-label':'PDF author' });
const metaSubject = el('input', { type:'text', placeholder:'optional subject', 'aria-label':'PDF subject' });
const metaKeywords = el('input', { type:'text', placeholder:'comma-separated keywords', 'aria-label':'PDF keywords' });
const signatureAck = el('input', { type:'checkbox', id:'signature-ack' });
const cropInputs = Object.fromEntries(['top','right','bottom','left'].map(side => [side, el('input', { type:'number', min:0, value:0, step:1, style:{ width:'5rem' }, 'aria-label':`Crop ${side} points` })]));

function labelled(label, control) {
  return el('label', { style:{ display:'grid', gap:'.2rem', fontSize:'.8rem' } }, el('span', { class:'gs-label' }, label), control);
}

const composeCard = el('details', { class:'gs-card', open:true },
  el('summary', { style:{ cursor:'pointer', fontFamily:'var(--fh)' } }, 'Build the page pack'),
  el('div', { style:{ display:'grid', gap:'.75rem', marginTop:'.8rem' } },
    el('div', { class:'gs-toolbar' },
      el('button', { class:'gs-btn gs-btn-ghost', onclick:() => addBlankPage() }, 'Add blank page'), blankSize, blankOrientation,
      el('span', { class:'gs-muted', style:{ fontSize:'.75rem' } }, 'Images added through the dropzone use'), imagePageSize),
    el('div', { class:'gs-toolbar' },
      el('button', { class:'gs-btn gs-btn-ghost', onclick:() => selectAll(true) }, 'Select all'),
      el('button', { class:'gs-btn gs-btn-ghost', onclick:() => selectAll(false) }, 'Clear selection'),
      rangeInput,
      el('button', { class:'gs-btn gs-btn-ghost', onclick:selectRange }, 'Select range'))));

const overlayCard = el('details', { class:'gs-card' },
  el('summary', { style:{ cursor:'pointer', fontFamily:'var(--fh)' } }, 'Page numbers, watermark & crop'),
  el('div', { style:{ display:'grid', gap:'.8rem', marginTop:'.8rem' } },
    el('label', { for:'number-pages', style:{ display:'flex', gap:'.45rem', alignItems:'center', cursor:'pointer' } }, numberPages, el('span', {}, 'Add page numbers')),
    el('div', { style:{ display:'grid', gridTemplateColumns:'minmax(180px,1.5fr) minmax(90px,.5fr) minmax(150px,1fr)', gap:'.6rem' } }, labelled('template', numberTemplate), labelled('start at', numberStart), labelled('position', numberPosition)),
    labelled('watermark / stamp', watermark),
    el('p', { class:'gs-muted', style:{ fontSize:'.74rem', margin:0 } }, 'Watermarks are drawn diagonally across the centre at low opacity.'),
    el('div', { class:'gs-label' }, 'crop box margins · points'),
    el('div', { class:'gs-toolbar' }, ...Object.entries(cropInputs).map(([side, control]) => labelled(side, control))),
    el('p', { class:'gs-muted', style:{ fontSize:'.74rem', margin:0 } }, 'Crop boxes hide page edges in normal viewers but do not remove the underlying page content. Use redaction for sensitive material.')));

const outputCard = el('details', { class:'gs-card' },
  el('summary', { style:{ cursor:'pointer', fontFamily:'var(--fh)' } }, 'Forms & document metadata'),
  el('div', { style:{ display:'grid', gap:'.75rem', marginTop:'.8rem' } },
    el('label', { for:'flatten-forms', style:{ display:'flex', gap:'.45rem', alignItems:'flex-start', cursor:'pointer', fontSize:'.82rem' } }, flattenForms,
      el('span', {}, el('strong', {}, 'Flatten form fields before copying pages'), ' — makes current field appearances part of the page and removes interactivity from the source copy.')),
    el('label', { for:'remove-metadata', style:{ display:'flex', gap:'.45rem', alignItems:'flex-start', cursor:'pointer', fontSize:'.82rem' } }, removeMetadata,
      el('span', {}, el('strong', {}, 'Remove output document metadata'), ' — default. This strips the final Info dictionary and XMP stream.')),
    el('div', { style:{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(180px,1fr))', gap:'.6rem' } },
      labelled('title', metaTitle), labelled('author', metaAuthor), labelled('subject', metaSubject), labelled('keywords', metaKeywords)),
    el('p', { class:'gs-muted', style:{ fontSize:'.74rem', margin:0 } }, 'Metadata fields are only used when “Remove output document metadata” is switched off. Source metadata is never copied automatically.')));

const signatureWarning = el('div', { class:'gs-warn', style:{ display:'none' } },
  el('label', { for:'signature-ack', style:{ display:'flex', gap:'.5rem', alignItems:'flex-start', cursor:'pointer' } }, signatureAck,
    el('span', {}, 'One or more source PDFs report digital signatures. I understand any exported edited copy will invalidate those signatures.')));

box.append(drop, composeCard, overlayCard, outputCard, signatureWarning, bar, status, grid);
root.append(box);

async function addFiles(files) {
  for (const f of files) {
    if (/pdf/i.test(f.type) || /\.pdf$/i.test(f.name)) await addPdf(f);
    else if (/image\/(png|jpeg)/i.test(f.type) || /\.(png|jpe?g)$/i.test(f.name)) await addImage(f);
  }
  redraw();
}

async function addPdf(file) {
  status.style.color = 'var(--muted)';
  status.textContent = 'Inspecting and rendering ' + file.name + '…';
  try {
    const bytes = new Uint8Array(await file.arrayBuffer());
    if (bytes.length > 180 * 1024 * 1024) throw new Error('PDFs over 180 MB are not opened by this tool.');
    const doc = await pdfjsLib.getDocument({ data:bytes.slice(), enableScripting:false, isEvalSupported:false }).promise;
    const [fields, signatures, jsActions] = await Promise.all([
      doc.getFieldObjects().catch(() => null),
      typeof doc.getSignatures === 'function' ? doc.getSignatures().catch(() => null) : Promise.resolve(null),
      doc.getJSActions().catch(() => null),
    ]);
    let annotationCount = 0;
    const src = sources.push({
      name:file.name, bytes,
      fields:fields ? Object.keys(fields).length : 0,
      signatures:Array.isArray(signatures) ? signatures.length : signatures ? Object.keys(signatures).length : 0,
      jsActions:jsActions ? Object.keys(jsActions).length : 0,
      annotations:0,
    }) - 1;
    for (let p = 1; p <= doc.numPages; p++) {
      const page = await doc.getPage(p);
      const vp = page.getViewport({ scale:.35 });
      const c = document.createElement('canvas');
      c.width = Math.ceil(vp.width); c.height = Math.ceil(vp.height);
      await page.render({ canvasContext:c.getContext('2d'), viewport:vp }).promise;
      const annotations = await page.getAnnotations({ intent:'display' }).catch(() => []);
      annotationCount += annotations.filter(item => item.subtype !== 'Link').length;
      pages.push({ kind:'pdf', src, page:p - 1, rotation:0, deleted:false, selected:false, thumb:c.toDataURL('image/jpeg', .72) });
    }
    sources[src].annotations = annotationCount;
  } catch (err) {
    status.style.color = 'var(--gold)';
    status.textContent = `Could not add ${file.name}: ${/password/i.test(err?.message || '') ? 'password-protected PDFs need to be unlocked first.' : err.message}`;
  }
}

async function addImage(file) {
  try {
    if (file.size > 40 * 1024 * 1024) throw new Error('Images over 40 MB are not opened here.');
    const bytes = new Uint8Array(await file.arrayBuffer());
    const bitmap = await createImageBitmap(file);
    const thumb = await blobToDataUrl(file);
    pages.push({
      kind:'image', name:file.name, bytes, mime:file.type || (/\.png$/i.test(file.name) ? 'image/png' : 'image/jpeg'),
      imageWidth:bitmap.width, imageHeight:bitmap.height, pageSize:imagePageSize.value,
      deleted:false, selected:false, rotation:0, thumb,
    });
    bitmap.close?.();
  } catch (err) {
    status.style.color = 'var(--gold)'; status.textContent = `Could not add ${file.name}: ${err.message}`;
  }
}

function blobToDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader(); reader.onload = () => resolve(reader.result); reader.onerror = () => reject(reader.error); reader.readAsDataURL(blob);
  });
}

function addBlankPage() {
  const [width, height] = pageSize(blankSize.value, blankOrientation.value);
  pages.push({ kind:'blank', width, height, label:`${blankSize.value.toUpperCase()} ${blankOrientation.value}`, deleted:false, selected:false, rotation:0, thumb:null });
  redraw();
}

function move(i, delta) {
  const j = i + delta;
  if (j < 0 || j >= pages.length) return;
  [pages[i], pages[j]] = [pages[j], pages[i]]; redraw();
}
function moveTo(from, to) {
  if (from == null || from === to || from < 0 || to < 0 || from >= pages.length || to >= pages.length) return;
  const [page] = pages.splice(from, 1); pages.splice(to, 0, page); redraw();
}
function duplicate(i) {
  const source = pages[i];
  pages.splice(i + 1, 0, { ...source, bytes:source.bytes?.slice?.() || source.bytes }); redraw();
}
function selectAll(value) { for (const page of pages) if (!page.deleted) page.selected = value; redraw(); }
function selectRange() {
  const selected = parsePageSelection(rangeInput.value, pages.length);
  pages.forEach((page, index) => { page.selected = selected.has(index) && !page.deleted; }); redraw();
}

function sourceSignals() {
  return sources.reduce((acc, src) => {
    acc.fields += src.fields || 0; acc.signatures += src.signatures || 0; acc.jsActions += src.jsActions || 0; acc.annotations += src.annotations || 0;
    return acc;
  }, { fields:0, signatures:0, jsActions:0, annotations:0 });
}

function redraw() {
  grid.replaceChildren();
  const live = pages.filter(p => !p.deleted).length;
  const selected = pages.filter(p => p.selected && !p.deleted).length;
  const signals = sourceSignals();
  signatureWarning.style.display = signals.signatures ? '' : 'none';
  if (!signals.signatures) signatureAck.checked = false;

  if (pages.length && status.style.color !== 'var(--gold)') {
    const notices = [];
    if (signals.fields) notices.push(`${signals.fields} form field group${signals.fields === 1 ? '' : 's'}`);
    if (signals.annotations) notices.push(`${signals.annotations} annotation${signals.annotations === 1 ? '' : 's'}`);
    if (signals.jsActions) notices.push(`${signals.jsActions} JavaScript action group${signals.jsActions === 1 ? '' : 's'} (never executed)`);
    if (signals.signatures) notices.push(`${signals.signatures} digital signature${signals.signatures === 1 ? '' : 's'}`);
    status.textContent = `${live} page${live === 1 ? '' : 's'} in output · ${selected} selected${notices.length ? ' · ' + notices.join(' · ') : ''}`;
  } else if (!pages.length) status.textContent = '';

  pages.forEach((pg, i) => {
    const card = el('article', {
      class:'gs-card', draggable:!pg.deleted,
      style:{ padding:'.55rem', opacity:pg.deleted ? '.48' : '1', cursor:pg.deleted ? 'default' : 'grab', borderColor:pg.selected ? 'var(--gold)' : '' },
      'aria-label':`${pageLabel(pg, i)}${pg.deleted ? ', removed' : ''}${pg.selected ? ', selected' : ''}`,
    });
    const select = el('input', { type:'checkbox', checked:pg.selected && !pg.deleted, disabled:pg.deleted, 'aria-label':`Select ${pageLabel(pg, i)}` });
    select.addEventListener('change', () => { pg.selected = select.checked; redraw(); });
    const top = el('div', { style:{ display:'flex', justifyContent:'space-between', alignItems:'center', gap:'.5rem' } }, select,
      el('span', { class:'gs-mono gs-muted', style:{ fontSize:'.66rem' } }, `output ${i + 1}`));
    const imWrap = el('div', { style:{ overflow:'hidden', borderRadius:'4px', background:'var(--card-alt)', aspectRatio:'3 / 4', display:'grid', placeItems:'center', marginTop:'.35rem' } });
    if (pg.thumb) imWrap.append(el('img', { src:pg.thumb, alt:'', style:{ maxWidth:'100%', maxHeight:'100%', transform:`rotate(${pg.rotation}deg)`, transition:'.15s' } }));
    else imWrap.append(el('div', { class:'gs-mono gs-muted', style:{ fontSize:'.72rem', textAlign:'center', padding:'.5rem' } }, pg.label || 'Blank page'));
    const lbl = el('div', { class:'gs-mono', title:pageLabel(pg, i), style:{ fontSize:'.66rem', color:'var(--muted)', margin:'.35rem 0', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' } }, pageLabel(pg, i));
    const btn = (text, label, fn) => el('button', { class:'gs-btn gs-btn-ghost', style:{ padding:'.25rem .42rem', minHeight:'32px', fontSize:'.72rem' }, 'aria-label':label, title:label, onclick:fn }, text);
    const ctrls = el('div', { class:'gs-toolbar', style:{ gap:'.25rem' } },
      btn('↺', 'Rotate left', () => { pg.rotation = (pg.rotation + 270) % 360; redraw(); }),
      btn('↻', 'Rotate right', () => { pg.rotation = (pg.rotation + 90) % 360; redraw(); }),
      btn('←', 'Move earlier', () => move(i, -1)), btn('→', 'Move later', () => move(i, 1)),
      btn('⧉', 'Duplicate page', () => duplicate(i)),
      btn(pg.deleted ? 'Restore' : 'Remove', pg.deleted ? 'Restore page' : 'Remove page', () => { pg.deleted = !pg.deleted; if (pg.deleted) pg.selected = false; redraw(); }));
    card.addEventListener('dragstart', () => { dragIndex = i; card.style.opacity = '.55'; });
    card.addEventListener('dragend', () => { dragIndex = null; redraw(); });
    card.addEventListener('dragover', e => { if (!pg.deleted) { e.preventDefault(); card.style.borderColor = 'var(--gold)'; } });
    card.addEventListener('dragleave', () => { card.style.borderColor = pg.selected ? 'var(--gold)' : ''; });
    card.addEventListener('drop', e => { e.preventDefault(); moveTo(dragIndex, i); });
    card.append(top, imWrap, lbl, ctrls); grid.append(card);
  });

  bar.replaceChildren();
  if (pages.length) {
    bar.append(
      el('button', { class:'gs-btn gs-btn-primary', onclick:() => exportPdf(pages.filter(p => !p.deleted), 'edited.pdf') }, 'Export PDF'),
      el('button', { class:'gs-btn gs-btn-ghost', disabled:selected === 0, onclick:() => exportPdf(pages.filter(p => p.selected && !p.deleted), 'extracted-pages.pdf') }, `Extract selected${selected ? ` (${selected})` : ''}`),
      el('button', { class:'gs-btn gs-btn-ghost', onclick:() => input.click() }, 'Add files'),
      el('a', { class:'gs-btn gs-btn-ghost', href:'../pdf-inspect/index.html', style:{ textDecoration:'none' } }, 'Inspect a source PDF →'),
      el('button', { class:'gs-btn gs-btn-ghost', onclick:resetAll }, 'Start over'));
  }
}

function pageLabel(pg) {
  if (pg.kind === 'pdf') return `${sources[pg.src].name.replace(/\.pdf$/i, '')} · p${pg.page + 1}`;
  if (pg.kind === 'image') return `${pg.name} · image page`;
  return pg.label || 'Blank page';
}

function resetAll() {
  sources.length = 0; pages = []; status.style.color = 'var(--muted)'; signatureAck.checked = false; redraw();
}

async function exportPdf(items, filename) {
  if (!items.length) { status.style.color = 'var(--gold)'; status.textContent = 'Nothing selected to export.'; return; }
  const signals = sourceSignals();
  if (signals.signatures && !signatureAck.checked) {
    status.style.color = 'var(--gold)'; status.textContent = 'Confirm the digital-signature warning before exporting an edited copy.'; return;
  }
  status.style.color = 'var(--muted)'; status.textContent = 'Building PDF…';
  try {
    const out = await PDFDocument.create();
    const libDocs = [];
    for (const source of sources) {
      const doc = await PDFDocument.load(source.bytes, { updateMetadata:false });
      if (flattenForms.checked && source.fields) {
        try { doc.getForm().flatten(); }
        catch (err) { throw new Error(`Could not flatten forms in ${source.name}: ${err.message}`); }
      }
      libDocs.push(doc);
    }

    const outputPages = [];
    for (const item of items) {
      let page;
      if (item.kind === 'pdf') {
        const [copied] = await out.copyPages(libDocs[item.src], [item.page]);
        if (item.rotation) copied.setRotation(degrees((copied.getRotation().angle + item.rotation) % 360));
        page = out.addPage(copied);
      } else if (item.kind === 'blank') {
        const dims = item.rotation % 180 ? [item.height, item.width] : [item.width, item.height];
        page = out.addPage(dims);
      } else if (item.kind === 'image') {
        const orientation = item.imageWidth >= item.imageHeight ? 'landscape' : 'portrait';
        const dims = pageSize(item.pageSize || 'a4', orientation);
        page = out.addPage(dims);
        const image = item.mime === 'image/png' ? await out.embedPng(item.bytes) : await out.embedJpg(item.bytes);
        const fitted = fitRect(item.imageWidth, item.imageHeight, dims[0], dims[1], 24);
        page.drawImage(image, fitted);
        if (item.rotation) page.setRotation(degrees(item.rotation));
      }
      const crop = normaliseCrop(Object.fromEntries(Object.entries(cropInputs).map(([side, input]) => [side, Number(input.value) || 0])), page.getWidth(), page.getHeight());
      if (crop.left || crop.right || crop.top || crop.bottom) page.setCropBox(crop.x, crop.y, crop.width, crop.height);
      outputPages.push(page);
    }

    if (numberPages.checked || watermark.value.trim()) {
      const font = await out.embedFont(StandardFonts.Helvetica);
      for (let i = 0; i < outputPages.length; i++) {
        const page = outputPages[i];
        if (watermark.value.trim()) drawWatermark(page, watermark.value.trim(), font);
        if (numberPages.checked) drawPageNumber(page, pageNumberText({ index:i, total:outputPages.length, start:Number(numberStart.value) || 1, template:numberTemplate.value }), font, numberPosition.value);
      }
    }

    if (!removeMetadata.checked) {
      if (metaTitle.value.trim()) out.setTitle(metaTitle.value.trim());
      if (metaAuthor.value.trim()) out.setAuthor(metaAuthor.value.trim());
      if (metaSubject.value.trim()) out.setSubject(metaSubject.value.trim());
      const keywords = metaKeywords.value.split(',').map(value => value.trim()).filter(Boolean);
      if (keywords.length) out.setKeywords(keywords);
    }

    let bytes = await out.save({ useObjectStreams:false });
    if (removeMetadata.checked) bytes = (await cleanPdfDocumentMetadata(bytes)).bytes;
    download(bytes, filename, 'application/pdf');
    status.textContent = `${items.length} page${items.length === 1 ? '' : 's'} exported${removeMetadata.checked ? ' · metadata removed' : ''}`;
  } catch (err) {
    status.style.color = 'var(--gold)'; status.textContent = 'Could not export: ' + err.message;
  }
}

function drawWatermark(page, text, font) {
  const size = Math.max(24, Math.min(72, page.getWidth() / 9));
  const width = font.widthOfTextAtSize(text, size);
  page.drawText(text, {
    x:(page.getWidth() - width) / 2, y:page.getHeight() / 2 - size / 2,
    size, font, color:rgb(.32,.32,.32), opacity:.16, rotate:degrees(35),
  });
}

function drawPageNumber(page, text, font, position) {
  const size = 9;
  const width = font.widthOfTextAtSize(text, size);
  const margin = 24;
  const [vertical, horizontal] = position.split('-');
  let x = margin;
  if (horizontal === 'center') x = (page.getWidth() - width) / 2;
  else if (horizontal === 'right') x = page.getWidth() - width - margin;
  const y = vertical === 'top' ? page.getHeight() - size - margin : margin;
  page.drawText(text, { x, y, size, font, color:rgb(.2,.2,.2), opacity:.85 });
}

redraw();
