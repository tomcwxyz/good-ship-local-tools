import { chrome, header, assurance, dropzone, download, el, baseName } from '../../src/shell.js';
import * as pdfjsLib from 'pdfjs-dist';
import PdfWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?worker&inline';
import { PDFDocument } from 'pdf-lib';
import { assertSafeSvgFile } from '../../src/lib/svg.js';
import { normaliseRect, percentRect, pixelRect, usableRect } from '../../src/lib/redaction.js';

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

function attachRedactor(canvas, baseDraw, rects, onChange = () => {}) {
  const ctx = canvas.getContext('2d');
  let drag = null;

  const pos = e => {
    const bounds = canvas.getBoundingClientRect();
    return {
      x: (e.clientX - bounds.left) * (canvas.width / bounds.width),
      y: (e.clientY - bounds.top) * (canvas.height / bounds.height),
    };
  };

  function drawRect(rect, alpha = 1) {
    const px = pixelRect(rect, canvas.width, canvas.height);
    ctx.fillStyle = alpha === 1 ? '#000' : `rgba(0,0,0,${alpha})`;
    ctx.fillRect(px.x, px.y, px.w, px.h);
  }

  function repaint(preview = null) {
    baseDraw(ctx);
    for (const rect of rects) drawRect(rect);
    if (preview) drawRect(preview, .6);
  }

  function changed() {
    repaint();
    onChange(rects);
  }

  function finish(e) {
    if (!drag) return;
    const rect = normaliseRect(drag, pos(e), canvas.width, canvas.height);
    if (usableRect(rect)) rects.push(rect);
    drag = null;
    changed();
  }

  canvas.style.touchAction = 'none';
  canvas.style.cursor = 'crosshair';
  canvas.tabIndex = 0;
  canvas.setAttribute('aria-label', 'Document page. Drag across an area to redact it. Control or Command plus Z undoes the last box on this page.');
  canvas.addEventListener('pointerdown', e => {
    drag = pos(e);
    canvas.setPointerCapture(e.pointerId);
  });
  canvas.addEventListener('pointermove', e => {
    if (!drag) return;
    repaint(normaliseRect(drag, pos(e), canvas.width, canvas.height));
  });
  canvas.addEventListener('pointerup', finish);
  canvas.addEventListener('pointercancel', () => { drag = null; repaint(); });
  canvas.addEventListener('keydown', e => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
      e.preventDefault();
      rects.pop();
      changed();
    } else if (e.key === 'Escape' && drag) {
      e.preventDefault();
      drag = null;
      repaint();
    }
  });

  repaint();
  return {
    rects,
    repaint,
    undo: () => { rects.pop(); changed(); },
    clear: () => { rects.length = 0; changed(); },
    addPercentRect: (left, top, width, height) => {
      const rect = percentRect(left, top, width, height);
      if (!usableRect(rect)) throw new Error('Width and height must create a visible rectangle.');
      rects.push(rect);
      changed();
    },
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

function zoomControl(onChange) {
  const select = el('select', { 'aria-label': 'Preview zoom' },
    el('option', { value: '100' }, 'Fit width'),
    el('option', { value: '125' }, '125%'),
    el('option', { value: '150' }, '150%'),
    el('option', { value: '200' }, '200%'));
  select.addEventListener('change', () => onChange(Number(select.value)));
  return select;
}

function setCanvasZoom(canvas, percent) {
  canvas.style.width = `${percent}%`;
  canvas.style.maxWidth = 'none';
  canvas.style.height = 'auto';
}

function coordinateControls(getRedactor, onAdded = () => {}) {
  const field = (label, value) => {
    const input = el('input', {
      type: 'number', min: '0', max: '100', step: '0.5', value,
      'aria-label': `${label} percentage`, style: { width: '6.5rem' },
    });
    return { input, control: el('label', {}, el('span', { class: 'gs-label', style: { display: 'block' } }, label), input) };
  };
  const left = field('left %', 10);
  const top = field('top %', 10);
  const width = field('width %', 25);
  const height = field('height %', 10);
  const status = el('span', { class: 'gs-mono gs-muted', style: { fontSize: '.72rem' }, 'aria-live': 'polite' });
  const add = el('button', { type: 'button', class: 'gs-btn gs-btn-ghost', onclick: () => {
    try {
      const redactor = getRedactor();
      if (!redactor) throw new Error('No page is ready yet.');
      redactor.addPercentRect(left.input.value, top.input.value, width.input.value, height.input.value);
      status.textContent = 'Rectangle added.';
      onAdded();
    } catch (err) {
      status.textContent = err.message;
    }
  } }, 'Add rectangle');

  return el('details', { class: 'gs-card', style: { margin: '.7rem 0' } },
    el('summary', { style: { cursor: 'pointer', fontFamily: 'var(--fh)' } }, 'Keyboard rectangle'),
    el('p', { class: 'gs-muted', style: { fontSize: '.76rem', margin: '.65rem 0' } }, 'Add a redaction without drawing: enter its position and size as percentages of the current page.'),
    el('div', { class: 'gs-toolbar' }, left.control, top.control, width.control, height.control, add, status));
}

async function handleImage(file) {
  const url = URL.createObjectURL(file);
  try {
    const img = await loadImage(url);
    const rects = [];
    const canvas = el('canvas');
    canvas.width = img.naturalWidth;
    canvas.height = img.naturalHeight;
    canvas.style.border = '1px solid var(--border)';
    canvas.style.borderRadius = 'var(--r)';
    canvas.style.display = 'block';
    const viewport = el('div', { style: { overflow: 'auto', width: '100%', borderRadius: 'var(--r)' } }, canvas);
    setCanvasZoom(canvas, 100);

    const count = el('span', { class: 'gs-mono gs-muted', style: { fontSize: '.75rem' }, 'aria-live': 'polite' });
    const redactor = attachRedactor(canvas, ctx => ctx.drawImage(img, 0, 0), rects, () => {
      count.textContent = `${rects.length} redaction${rects.length === 1 ? '' : 's'}`;
    });
    count.textContent = '0 redactions';

    const zoom = zoomControl(percent => setCanvasZoom(canvas, percent));
    const output = el('select', { 'aria-label': 'Image output format' },
      el('option', { value: 'png' }, 'PNG · lossless'),
      el('option', { value: 'jpeg-high' }, 'JPEG · high quality'),
      el('option', { value: 'jpeg-compact' }, 'JPEG · compact'));
    const dl = el('button', { class: 'gs-btn gs-btn-primary', onclick: async () => {
      dl.disabled = true;
      try {
        const type = output.value === 'png' ? 'image/png' : 'image/jpeg';
        const quality = output.value === 'jpeg-compact' ? .82 : .94;
        const blob = await safeCanvasBlob(canvas, type, quality);
        const ext = type === 'image/png' ? 'png' : 'jpg';
        download(blob, `${baseName(file.name)}-redacted.${ext}`, type);
      } finally {
        dl.disabled = false;
      }
    } }, 'Flatten & download');

    const box = el('div');
    box.append(header('tool · local-first', 'Redaction', null),
      el('div', { class: 'gs-warn', style: { marginBottom: '1rem' } }, el('span', {}, 'Drag over every area you want to remove. The output is re-encoded with the black pixels baked in. JPEG output uses a white background and lossy compression.')),
      toolbar([
        dl,
        el('label', {}, el('span', { class: 'gs-label', style: { marginRight: '.4rem' } }, 'output'), output),
        el('label', {}, el('span', { class: 'gs-label', style: { marginRight: '.4rem' } }, 'zoom'), zoom),
        count,
        el('button', { class: 'gs-btn gs-btn-ghost', onclick: redactor.undo }, 'Undo last'),
        el('button', { class: 'gs-btn gs-btn-ghost', onclick: redactor.clear }, 'Clear'),
        el('button', { class: 'gs-btn gs-btn-ghost', onclick: start }, 'Another file'),
      ]),
      coordinateControls(() => redactor, () => canvas.focus()),
      viewport);
    render(box);
  } finally {
    URL.revokeObjectURL(url);
  }
}

async function handlePdf(file) {
  render(el('div', { class: 'gs-mono gs-muted', 'aria-live': 'polite' }, 'Opening PDF…'));
  const data = new Uint8Array(await file.arrayBuffer());
  const pdf = await pdfjsLib.getDocument({ data, enableScripting: false, isEvalSupported: false }).promise;
  const pages = [];
  for (let index = 0; index < pdf.numPages; index++) {
    const page = await pdf.getPage(index + 1);
    const viewport = page.getViewport({ scale: 1 });
    pages.push({ number: index + 1, width: viewport.width, height: viewport.height, rects: [], thumbBase: null, thumb: null, thumbButton: null });
  }

  const box = el('div');
  box.append(header('tool · local-first', 'Redaction', null), note());

  const status = el('div', { class: 'gs-mono gs-muted', style: { fontSize: '.78rem', margin: '.45rem 0' }, 'aria-live': 'polite' });
  const thumbStrip = el('div', {
    role: 'navigation', 'aria-label': 'PDF pages',
    style: { display: 'flex', gap: '.5rem', overflowX: 'auto', padding: '.35rem 0 .7rem' },
  });
  const stage = el('div', { style: { overflow: 'auto', width: '100%', minHeight: '240px', borderRadius: 'var(--r)' } });
  const pageCount = el('span', { class: 'gs-mono gs-muted', style: { fontSize: '.75rem' } });
  const totalCount = el('span', { class: 'gs-mono gs-muted', style: { fontSize: '.75rem' } });
  const zoom = zoomControl(percent => {
    if (activeCanvas) setCanvasZoom(activeCanvas, percent);
  });
  const resolution = el('select', { 'aria-label': 'PDF output resolution' },
    el('option', { value: '96' }, '96 dpi · compact'),
    el('option', { value: '120', selected: true }, '120 dpi · standard'),
    el('option', { value: '160' }, '160 dpi · high'));
  const encoding = el('select', { 'aria-label': 'PDF page image encoding' },
    el('option', { value: 'jpeg' }, 'JPEG · smaller PDF'),
    el('option', { value: 'png' }, 'PNG · lossless, larger'));

  let activeIndex = 0;
  let activeCanvas = null;
  let activeRedactor = null;
  let renderToken = 0;

  function redactionTotal() {
    return pages.reduce((sum, page) => sum + page.rects.length, 0);
  }

  function updateCounts() {
    const page = pages[activeIndex];
    pageCount.textContent = `page ${page.number} of ${pages.length} · ${page.rects.length} redaction${page.rects.length === 1 ? '' : 's'}`;
    const total = redactionTotal();
    totalCount.textContent = `${total} total redaction${total === 1 ? '' : 's'}`;
    prev.disabled = activeIndex === 0;
    next.disabled = activeIndex === pages.length - 1;
    for (const meta of pages) {
      if (meta.thumbButton) {
        meta.thumbButton.setAttribute('aria-label', `Page ${meta.number}, ${meta.rects.length} redaction${meta.rects.length === 1 ? '' : 's'}`);
        if (meta.number === activeIndex + 1) {
          meta.thumbButton.setAttribute('aria-current', 'page');
          meta.thumbButton.style.borderColor = 'var(--green-dk)';
        } else {
          meta.thumbButton.removeAttribute('aria-current');
          meta.thumbButton.style.borderColor = 'var(--border)';
        }
      }
      redrawThumb(meta);
    }
  }

  function redrawThumb(meta) {
    if (!meta.thumb || !meta.thumbBase) return;
    const ctx = meta.thumb.getContext('2d');
    ctx.clearRect(0, 0, meta.thumb.width, meta.thumb.height);
    ctx.drawImage(meta.thumbBase, 0, 0);
    ctx.fillStyle = '#000';
    for (const rect of meta.rects) {
      const px = pixelRect(rect, meta.thumb.width, meta.thumb.height);
      ctx.fillRect(px.x, px.y, px.w, px.h);
    }
  }

  async function renderActive() {
    const token = ++renderToken;
    const meta = pages[activeIndex];
    status.textContent = `Rendering page ${meta.number}…`;
    const page = await pdf.getPage(meta.number);
    const viewport = page.getViewport({ scale: 1.5 });
    const clean = document.createElement('canvas');
    clean.width = Math.ceil(viewport.width);
    clean.height = Math.ceil(viewport.height);
    await page.render({ canvasContext: clean.getContext('2d'), viewport, background: '#fff' }).promise;
    if (token !== renderToken) return;

    const canvas = el('canvas');
    canvas.width = clean.width;
    canvas.height = clean.height;
    canvas.style.border = '1px solid var(--border)';
    canvas.style.borderRadius = 'var(--r)';
    canvas.style.display = 'block';
    setCanvasZoom(canvas, Number(zoom.value));
    activeCanvas = canvas;
    activeRedactor = attachRedactor(canvas, ctx => ctx.drawImage(clean, 0, 0), meta.rects, updateCounts);
    stage.replaceChildren(canvas);
    updateCounts();
    status.textContent = `Page ${meta.number} ready · drag to redact, or use the keyboard rectangle controls`;
    canvas.focus();
  }

  function go(delta) {
    const next = Math.min(pages.length - 1, Math.max(0, activeIndex + delta));
    if (next === activeIndex) return;
    activeIndex = next;
    renderActive().catch(err => { status.textContent = `Could not render page: ${err.message}`; });
  }

  const prev = el('button', { class: 'gs-btn gs-btn-ghost', onclick: () => go(-1) }, 'Previous page');
  const next = el('button', { class: 'gs-btn gs-btn-ghost', onclick: () => go(1) }, 'Next page');
  const undo = el('button', { class: 'gs-btn gs-btn-ghost', onclick: () => activeRedactor?.undo() }, 'Undo page');
  const clear = el('button', { class: 'gs-btn gs-btn-ghost', onclick: () => activeRedactor?.clear() }, 'Clear page');

  const dl = el('button', { class: 'gs-btn gs-btn-primary', onclick: async () => {
    dl.disabled = true;
    const old = dl.textContent;
    try {
      const dpi = Number(resolution.value);
      const scale = dpi / 72;
      const usePng = encoding.value === 'png';
      const outPdf = await PDFDocument.create();
      for (let index = 0; index < pages.length; index++) {
        const meta = pages[index];
        dl.textContent = `Building page ${index + 1}/${pages.length}…`;
        const page = await pdf.getPage(meta.number);
        const viewport = page.getViewport({ scale });
        const canvas = document.createElement('canvas');
        canvas.width = Math.ceil(viewport.width);
        canvas.height = Math.ceil(viewport.height);
        const ctx = canvas.getContext('2d');
        await page.render({ canvasContext: ctx, viewport, background: '#fff' }).promise;
        ctx.fillStyle = '#000';
        for (const rect of meta.rects) {
          const px = pixelRect(rect, canvas.width, canvas.height);
          ctx.fillRect(px.x, px.y, px.w, px.h);
        }

        const blob = await safeCanvasBlob(canvas, usePng ? 'image/png' : 'image/jpeg', .92);
        const bytes = new Uint8Array(await blob.arrayBuffer());
        const image = usePng ? await outPdf.embedPng(bytes) : await outPdf.embedJpg(bytes);
        const outPage = outPdf.addPage([meta.width, meta.height]);
        outPage.drawImage(image, { x: 0, y: 0, width: meta.width, height: meta.height });
        canvas.width = 1;
        canvas.height = 1;
      }
      download(await outPdf.save(), baseName(file.name) + '-redacted.pdf', 'application/pdf');
    } finally {
      dl.disabled = false;
      dl.textContent = old;
    }
  } }, 'Flatten & download PDF');

  const mainTools = toolbar([
    prev, next, pageCount, totalCount,
    el('label', {}, el('span', { class: 'gs-label', style: { marginRight: '.4rem' } }, 'zoom'), zoom),
    undo, clear,
  ]);
  const exportTools = toolbar([
    dl,
    el('label', {}, el('span', { class: 'gs-label', style: { marginRight: '.4rem' } }, 'output'), encoding),
    el('label', {}, el('span', { class: 'gs-label', style: { marginRight: '.4rem' } }, 'resolution'), resolution),
    el('button', { class: 'gs-btn gs-btn-ghost', onclick: start }, 'Another file'),
  ]);

  box.append(mainTools, status, thumbStrip, coordinateControls(() => activeRedactor, () => activeCanvas?.focus()), stage, exportTools,
    el('p', { class: 'gs-mono gs-muted', style: { fontSize: '.72rem' } }, 'Preview pages render at a fixed working resolution. Export resolution is separate; normalised redaction coordinates are projected onto the final page render.'));
  render(box);

  await renderActive();
  renderThumbnails(pdf, pages, thumbStrip, index => {
    activeIndex = index;
    renderActive().catch(err => { status.textContent = `Could not render page: ${err.message}`; });
  }, updateCounts).catch(err => {
    status.textContent = `Pages are usable, but thumbnails could not be rendered: ${err.message}`;
  });
}

async function renderThumbnails(pdf, pages, strip, activate, updateCounts) {
  for (let index = 0; index < pages.length; index++) {
    const meta = pages[index];
    const page = await pdf.getPage(meta.number);
    const unit = page.getViewport({ scale: 1 });
    const scale = Math.min(.3, 96 / unit.width);
    const viewport = page.getViewport({ scale });
    const base = document.createElement('canvas');
    base.width = Math.max(1, Math.ceil(viewport.width));
    base.height = Math.max(1, Math.ceil(viewport.height));
    await page.render({ canvasContext: base.getContext('2d'), viewport, background: '#fff' }).promise;

    const canvas = el('canvas');
    canvas.width = base.width;
    canvas.height = base.height;
    canvas.style.display = 'block';
    canvas.style.maxWidth = '96px';
    const button = el('button', {
      type: 'button', class: 'gs-btn gs-btn-ghost',
      style: { flex: '0 0 auto', padding: '.35rem', display: 'grid', gap: '.25rem', justifyItems: 'center' },
      onclick: () => activate(index),
      'aria-label': `Page ${meta.number}, 0 redactions`,
    }, canvas, el('span', { class: 'gs-mono', style: { fontSize: '.68rem' } }, `page ${meta.number}`));
    meta.thumbBase = base;
    meta.thumb = canvas;
    meta.thumbButton = button;
    strip.append(button);
    updateCounts();
  }
}

function loadImage(url) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('The image could not be decoded.'));
    img.src = url;
  });
}

async function safeCanvasBlob(canvas, type, quality) {
  if (type !== 'image/jpeg') return canvasBlob(canvas, type, quality);
  const flat = document.createElement('canvas');
  flat.width = canvas.width;
  flat.height = canvas.height;
  const ctx = flat.getContext('2d');
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, flat.width, flat.height);
  ctx.drawImage(canvas, 0, 0);
  const blob = await canvasBlob(flat, type, quality);
  flat.width = 1;
  flat.height = 1;
  return blob;
}

function canvasBlob(canvas, type, quality) {
  return new Promise((resolve, reject) => canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error('The browser could not create the output image.')), type, quality));
}

start();
