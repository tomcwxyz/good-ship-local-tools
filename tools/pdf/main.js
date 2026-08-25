import { chrome, header, assurance, download, el } from '../../src/shell.js';
import * as pdfjsLib from 'pdfjs-dist';
import PdfWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?worker&inline';
import { PDFDocument, degrees } from 'pdf-lib';

pdfjsLib.GlobalWorkerOptions.workerPort = new PdfWorker();

const root = chrome('pdf editor');
const sources = [];   // { name, bytes: Uint8Array }
let pages = [];       // { src, page, rotation, deleted, thumb }
let dragIndex = null;

const box = el('div');
box.append(
  header('tool · documents', 'PDF editor',
    'Merge, reorder, rotate, duplicate and remove pages. Add several PDFs to combine them. All in the browser.'),
  el('div', { style: { margin: '1rem 0 1.25rem' } }, assurance()));

const grid = el('div', { style: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(155px,1fr))', gap: '.75rem', margin: '1rem 0' } });
const bar = el('div', { class: 'gs-toolbar', style: { margin: '1rem 0' } });
const status = el('div', { class: 'gs-mono gs-muted', style: { fontSize: '.78rem' }, 'aria-live': 'polite' });

const input = el('input', { type: 'file', accept: 'application/pdf,.pdf', multiple: true, class: 'gs-visually-hidden' });
input.addEventListener('change', () => addFiles([...input.files]));
const drop = el('div', { class: 'gs-drop', role: 'button', tabIndex: 0, 'aria-label': 'Choose PDF files or drop them here' }, input);
drop.insertAdjacentHTML('afterbegin',
  '<div style="font-family:var(--fh);color:var(--text);font-size:1.1rem;margin-bottom:.25rem">Drop PDF(s), or click to choose</div>' +
  '<div class="gs-mono" style="font-size:.75rem;color:var(--muted)">multiple files merge together · drag page cards to reorder</div>');
drop.addEventListener('click', e => { if (e.target !== input) input.click(); });
drop.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); input.click(); } });
drop.addEventListener('dragover', e => { e.preventDefault(); drop.classList.add('drag'); });
drop.addEventListener('dragleave', () => drop.classList.remove('drag'));
drop.addEventListener('drop', e => { e.preventDefault(); drop.classList.remove('drag'); addFiles([...e.dataTransfer.files]); });

box.append(drop, bar, status, grid);
root.append(box);

async function addFiles(files) {
  for (const f of files) {
    if (!/pdf/i.test(f.type) && !/\.pdf$/i.test(f.name)) continue;
    status.style.color = 'var(--muted)';
    status.textContent = 'Rendering ' + f.name + '…';
    try {
      const bytes = new Uint8Array(await f.arrayBuffer());
      const doc = await pdfjsLib.getDocument({ data: bytes.slice(), enableScripting: false, isEvalSupported: false }).promise;
      const src = sources.push({ name: f.name, bytes }) - 1;
      for (let p = 1; p <= doc.numPages; p++) {
        const page = await doc.getPage(p);
        const vp = page.getViewport({ scale: 0.35 });
        const c = document.createElement('canvas');
        c.width = Math.ceil(vp.width); c.height = Math.ceil(vp.height);
        await page.render({ canvasContext: c.getContext('2d'), viewport: vp }).promise;
        pages.push({ src, page: p - 1, rotation: 0, deleted: false, thumb: c.toDataURL('image/jpeg', .72) });
      }
    } catch (err) {
      status.style.color = 'var(--gold)';
      status.textContent = `Could not add ${f.name}: ${/password/i.test(err?.message || '') ? 'password-protected PDFs need to be unlocked first.' : err.message}`;
    }
  }
  redraw();
}

function move(i, delta) {
  const j = i + delta;
  if (j < 0 || j >= pages.length) return;
  [pages[i], pages[j]] = [pages[j], pages[i]];
  redraw();
}

function moveTo(from, to) {
  if (from == null || from === to || from < 0 || to < 0 || from >= pages.length || to >= pages.length) return;
  const [page] = pages.splice(from, 1);
  pages.splice(to, 0, page);
  redraw();
}

function duplicate(i) {
  pages.splice(i + 1, 0, { ...pages[i] });
  redraw();
}

function redraw() {
  grid.innerHTML = '';
  const live = pages.filter(p => !p.deleted).length;
  if (pages.length && status.style.color !== 'var(--gold)') {
    status.textContent = `${live} page${live === 1 ? '' : 's'} in output · ${sources.length} source file${sources.length === 1 ? '' : 's'}`;
  } else if (!pages.length) status.textContent = '';

  pages.forEach((pg, i) => {
    const card = el('article', {
      class: 'gs-card', draggable: !pg.deleted,
      style: { padding: '.55rem', opacity: pg.deleted ? '.48' : '1', cursor: pg.deleted ? 'default' : 'grab' },
      'aria-label': `${sources[pg.src].name}, page ${pg.page + 1}${pg.deleted ? ', removed' : ''}`,
    });
    const imWrap = el('div', { style: { overflow: 'hidden', borderRadius: '4px', background: 'var(--card-alt)', aspectRatio: '3 / 4', display: 'grid', placeItems: 'center' } });
    const im = el('img', { src: pg.thumb, alt: '', style: { maxWidth: '100%', maxHeight: '100%', transform: `rotate(${pg.rotation}deg)`, transition: '.15s' } });
    imWrap.append(im);
    const lbl = el('div', { class: 'gs-mono', title: sources[pg.src].name, style: { fontSize: '.66rem', color: 'var(--muted)', margin: '.35rem 0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' } }, `${sources[pg.src].name.replace(/\.pdf$/i, '')} · p${pg.page + 1}`);
    const btn = (text, label, fn) => el('button', { class: 'gs-btn gs-btn-ghost', style: { padding: '.25rem .42rem', minHeight: '32px', fontSize: '.72rem' }, 'aria-label': label, title: label, onclick: fn }, text);
    const ctrls = el('div', { class: 'gs-toolbar', style: { gap: '.25rem' } },
      btn('↺', 'Rotate left', () => { pg.rotation = (pg.rotation + 270) % 360; redraw(); }),
      btn('↻', 'Rotate right', () => { pg.rotation = (pg.rotation + 90) % 360; redraw(); }),
      btn('←', 'Move earlier', () => move(i, -1)),
      btn('→', 'Move later', () => move(i, 1)),
      btn('⧉', 'Duplicate page', () => duplicate(i)),
      btn(pg.deleted ? 'Restore' : 'Remove', pg.deleted ? 'Restore page' : 'Remove page', () => { pg.deleted = !pg.deleted; redraw(); }));

    card.addEventListener('dragstart', () => { dragIndex = i; card.style.opacity = '.55'; });
    card.addEventListener('dragend', () => { dragIndex = null; redraw(); });
    card.addEventListener('dragover', e => { if (!pg.deleted) { e.preventDefault(); card.style.borderColor = 'var(--gold)'; } });
    card.addEventListener('dragleave', () => { card.style.borderColor = ''; });
    card.addEventListener('drop', e => { e.preventDefault(); moveTo(dragIndex, i); });
    card.append(imWrap, lbl, ctrls);
    grid.append(card);
  });

  bar.innerHTML = '';
  if (pages.length) {
    const save = el('button', { class: 'gs-btn gs-btn-primary', onclick: exportPdf }, 'Export PDF');
    const add = el('button', { class: 'gs-btn gs-btn-ghost', onclick: () => input.click() }, 'Add more PDFs');
    const reset = el('button', { class: 'gs-btn gs-btn-ghost', onclick: () => { sources.length = 0; pages = []; status.style.color = 'var(--muted)'; redraw(); } }, 'Start over');
    bar.append(save, add, reset);
  }
}

async function exportPdf() {
  const live = pages.filter(p => !p.deleted);
  if (!live.length) { status.style.color = 'var(--gold)'; status.textContent = 'Nothing to export — every page is removed.'; return; }
  status.style.color = 'var(--muted)';
  status.textContent = 'Building PDF…';
  try {
    const out = await PDFDocument.create();
    const libDocs = await Promise.all(sources.map(s => PDFDocument.load(s.bytes)));
    for (const pg of live) {
      const [copied] = await out.copyPages(libDocs[pg.src], [pg.page]);
      if (pg.rotation) copied.setRotation(degrees((copied.getRotation().angle + pg.rotation) % 360));
      out.addPage(copied);
    }
    download(await out.save(), 'edited.pdf', 'application/pdf');
    status.textContent = `${live.length} page${live.length === 1 ? '' : 's'} exported`;
  } catch (err) {
    status.style.color = 'var(--gold)';
    status.textContent = 'Could not export: ' + err.message;
  }
}
