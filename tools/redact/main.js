import { chrome, header, assurance, dropzone, download, el, baseName } from '../../src/shell.js';
import * as pdfjsLib from 'pdfjs-dist';
import PdfWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?worker&inline';
import { PDFDocument } from 'pdf-lib';
import { assertSafeSvgFile } from '../../src/lib/svg.js';

pdfjsLib.GlobalWorkerOptions.workerPort = new PdfWorker();

const root = chrome('redaction');
let view;
function render(n) { if (view) view.remove(); view = n; root.append(n); }

function start() {
  const box = el('div');
  box.append(
    header('tool · local-first', 'Redaction',
      'Black out parts of an image or PDF. The downloaded result is flattened so the pixels underneath the boxes are not retained.'),
    el('div', { style: { margin: '1rem 0 1.25rem' } }, assurance()),
    dropzone('image/*,application/pdf',
      '<div style="font-family:var(--fh);color:var(--text);font-size:1.1rem;margin-bottom:.25rem">Drop an image or PDF, or click to choose</div>' +
      '<div class="gs-mono" style="font-size:.75rem;color:var(--muted)">PDF pages are rasterised and rebuilt as image-only pages</div>',
      handle));
  render(box);
}

// Attach draw-to-redact behaviour to a canvas. baseDraw(ctx) repaints clean content.
function attachRedactor(canvas, baseDraw) {
  const ctx = canvas.getContext('2d');
  const rects = [];
  let drag = null;
  const pos = e => {
    const r = canvas.getBoundingClientRect();
    return {
      x: (e.clientX - r.left) * (canvas.width / r.width),
      y: (e.clientY - r.top) * (canvas.height / r.height),
    };
  };
  function repaint(preview) {
    baseDraw(ctx);
    ctx.fillStyle = '#000';
    for (const r of rects) ctx.fillRect(r.x, r.y, r.w, r.h);
    if (preview) {
      ctx.fillStyle = 'rgba(0,0,0,.6)';
      ctx.fillRect(preview.x, preview.y, preview.w, preview.h);
    }
  }
  function finish(e) {
    if (!drag) return;
    const p = pos(e);
    const r = { x: Math.min(drag.x, p.x), y: Math.min(drag.y, p.y), w: Math.abs(p.x - drag.x), h: Math.abs(p.y - drag.y) };
    if (r.w > 3 && r.h > 3) rects.push(r);
    drag = null;
    repaint();
  }

  canvas.style.touchAction = 'none';
  canvas.style.cursor = 'crosshair';
  canvas.setAttribute('aria-label', 'Document page. Drag across an area to redact it.');
  canvas.addEventListener('pointerdown', e => { drag = pos(e); canvas.setPointerCapture(e.pointerId); });
  canvas.addEventListener('pointermove', e => {
    if (!drag) return;
    const p = pos(e);
    repaint({ x: Math.min(drag.x, p.x), y: Math.min(drag.y, p.y), w: Math.abs(p.x - drag.x), h: Math.abs(p.y - drag.y) });
  });
  canvas.addEventListener('pointerup', finish);
  canvas.addEventListener('pointercancel', () => { drag = null; repaint(); });
  repaint();
  return {
    rects,
    undo: () => { rects.pop(); repaint(); },
    clear: () => { rects.length = 0; repaint(); },
  };
}

async function handle(file) {
  try {
    const isPdf = file.type === 'application/pdf' || /\.pdf$/i.test(file.name);
    if (isPdf) await handlePdf(file);
    else {
      if (file.type === 'image/svg+xml' || /\.svg$/i.test(file.name)) await assertSafeSvgFile(file);
      await handleImage(file);
    }
  } catch (err) {
    const msg = /password/i.test(err?.message || '')
      ? 'That PDF appears to be password-protected. Unlock it first, then try again.'
      : 'Could not process that file: ' + (err?.message || 'unknown error');
    render(errorCard(msg));
  }
}

function toolbar(children) {
  return el('div', { class: 'gs-toolbar', style: { margin: '1rem 0' } }, ...children);
}

function note() {
  const d = el('div', { class: 'gs-warn', style: { marginBottom: '1rem' } });
  d.append(el('span', {}, 'PDF output is image-only: selectable text, links, forms, annotations and hidden document data are intentionally not carried across. Check the downloaded file before sharing it.'));
  return d;
}

function errorCard(message) {
  return el('div', { class: 'gs-warn' },
    el('span', {}, message),
    el('button', { class: 'gs-btn gs-btn-ghost', style: { marginLeft: 'auto' }, onclick: start }, 'Try another file'));
}

async function handleImage(file) {
  const url = URL.createObjectURL(file);
  try {
    const img = await loadImage(url);
    const canvas = el('canvas');
    canvas.width = img.naturalWidth;
    canvas.height = img.naturalHeight;
    canvas.style.maxWidth = '100%';
    canvas.style.border = '1px solid var(--border)';
    canvas.style.borderRadius = 'var(--r)';
    const redactor = attachRedactor(canvas, ctx => ctx.drawImage(img, 0, 0));
    const dl = el('button', { class: 'gs-btn gs-btn-primary', onclick: async () => {
      const blob = await canvasBlob(canvas, 'image/png');
      download(blob, baseName(file.name) + '-redacted.png', 'image/png');
    } }, 'Flatten & download PNG');
    const box = el('div');
    box.append(header('tool · local-first', 'Redaction', null),
      el('div', { class: 'gs-warn', style: { marginBottom: '1rem' } }, el('span', {}, 'Drag over every area you want to remove. The result is a new PNG with the black pixels baked in.')),
      toolbar([dl,
        el('button', { class: 'gs-btn gs-btn-ghost', onclick: redactor.undo }, 'Undo last'),
        el('button', { class: 'gs-btn gs-btn-ghost', onclick: redactor.clear }, 'Clear page'),
        el('button', { class: 'gs-btn gs-btn-ghost', onclick: start }, 'Another file')]),
      canvas);
    render(box);
  } finally {
    URL.revokeObjectURL(url);
  }
}

async function handlePdf(file) {
  render(el('div', { class: 'gs-mono gs-muted', 'aria-live': 'polite' }, 'Rendering PDF…'));
  const data = new Uint8Array(await file.arrayBuffer());
  const pdf = await pdfjsLib.getDocument({ data, enableScripting: false, isEvalSupported: false }).promise;
  const pages = [];
  const box = el('div');
  box.append(header('tool · local-first', 'Redaction', null), note());
  const tb = toolbar([]);
  const status = el('div', { class: 'gs-mono gs-muted', style: { fontSize: '.78rem' }, 'aria-live': 'polite' });
  box.append(tb, status);
  render(box);

  for (let p = 1; p <= pdf.numPages; p++) {
    status.textContent = `Rendering page ${p} of ${pdf.numPages}…`;
    const page = await pdf.getPage(p);
    const outputViewport = page.getViewport({ scale: 1 });
    const renderViewport = page.getViewport({ scale: 1.5 });

    const clean = document.createElement('canvas');
    clean.width = Math.ceil(renderViewport.width);
    clean.height = Math.ceil(renderViewport.height);
    await page.render({ canvasContext: clean.getContext('2d'), viewport: renderViewport }).promise;

    const canvas = el('canvas');
    canvas.width = clean.width;
    canvas.height = clean.height;
    canvas.style.maxWidth = '100%';
    canvas.style.border = '1px solid var(--border)';
    canvas.style.borderRadius = 'var(--r)';
    canvas.style.display = 'block';
    const redactor = attachRedactor(canvas, ctx => ctx.drawImage(clean, 0, 0));
    pages.push({ canvas, width: outputViewport.width, height: outputViewport.height, redactor });

    const pageTools = toolbar([
      el('button', { class: 'gs-btn gs-btn-ghost', onclick: redactor.undo }, 'Undo last'),
      el('button', { class: 'gs-btn gs-btn-ghost', onclick: redactor.clear }, 'Clear page'),
    ]);
    pageTools.style.margin = '.4rem 0 .9rem';
    box.append(el('div', { class: 'gs-label', style: { margin: '.8rem 0 .3rem' } }, 'page ' + p), canvas, pageTools);
  }

  status.textContent = `${pdf.numPages} page${pdf.numPages === 1 ? '' : 's'} ready · draw redaction boxes, then export`;
  const dl = el('button', { class: 'gs-btn gs-btn-primary', onclick: async () => {
    dl.disabled = true;
    const old = dl.textContent;
    dl.textContent = 'Building PDF…';
    try {
      const outPdf = await PDFDocument.create();
      for (const page of pages) {
        const pngBytes = new Uint8Array(await (await canvasBlob(page.canvas, 'image/png')).arrayBuffer());
        const png = await outPdf.embedPng(pngBytes);
        // Preserve the original displayed PDF page size; render resolution is independent.
        const pg = outPdf.addPage([page.width, page.height]);
        pg.drawImage(png, { x: 0, y: 0, width: page.width, height: page.height });
      }
      download(await outPdf.save(), baseName(file.name) + '-redacted.pdf', 'application/pdf');
    } finally {
      dl.disabled = false;
      dl.textContent = old;
    }
  } }, 'Flatten & download PDF');
  tb.append(dl, el('button', { class: 'gs-btn gs-btn-ghost', onclick: start }, 'Another file'));
}

function loadImage(url) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('The image could not be decoded.'));
    img.src = url;
  });
}

function canvasBlob(canvas, type, quality) {
  return new Promise((resolve, reject) => canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error('The browser could not create the output image.')), type, quality));
}

start();
