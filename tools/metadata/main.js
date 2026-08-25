import { chrome, header, assurance, dropzoneMulti, download, fmtBytes, baseName, el } from '../../src/shell.js';
import { zipSync } from 'fflate';
import { processJPEG, processPNG } from '../../src/lib/metadata.js';
import { uniqueArchiveName } from '../../src/lib/archive.js';

const root = chrome('metadata stripper');
let view;
function render(node) { if (view) view.remove(); view = node; root.append(node); }

function start() {
  const box = el('div');
  box.append(
    header('tool · local-first', 'Metadata stripper',
      'Photos carry hidden data — where they were taken, on what device, by whom. Inspect and strip one image or a whole batch before you share.'),
    el('div', { style:{ margin:'1rem 0 1.25rem' } }, assurance()),
    dropzoneMulti('image/jpeg,image/png,.jpg,.jpeg,.png',
      '<svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#4F7E68" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 5 17 10"/><line x1="12" y1="5" x2="12" y2="15"/></svg>' +
      '<div style="font-family:var(--fh);color:var(--text);font-size:1.1rem;margin:.5rem 0 .25rem">Drop image(s), or click to choose</div>' +
      '<div class="gs-mono" style="font-size:.75rem;color:var(--muted)">JPEG · PNG · multiple files download as one ZIP</div>',
      handleFiles),
  );
  render(box);
}

async function processFile(file) {
  if (file.size > 80 * 1024 * 1024) return { file, error:'File is over the 80 MB per-image limit.' };
  try {
    const buf = await file.arrayBuffer();
    let r = null; let type = null;
    if (file.type === 'image/jpeg' || /\.jpe?g$/i.test(file.name)) { r = processJPEG(buf); type = 'image/jpeg'; }
    else if (file.type === 'image/png' || /\.png$/i.test(file.name)) { r = processPNG(buf); type = 'image/png'; }
    if (!r) return { file, error:'Only JPEG and PNG can be stripped losslessly here.' };
    return { file, ...r, original:buf.byteLength, type };
  } catch (err) {
    return { file, error:'Malformed or unsupported image: ' + err.message };
  }
}

async function handleFiles(files) {
  const candidates = files.slice(0, 100);
  const status = el('div', { class:'gs-mono gs-muted', 'aria-live':'polite' }, `Inspecting ${candidates.length} file${candidates.length === 1 ? '' : 's'}…`);
  render(status);
  const results = await Promise.all(candidates.map(processFile));
  showResults(results, files.length > candidates.length ? files.length - candidates.length : 0);
}

function showResults(results, omitted) {
  const wrap = el('div', { style:{ display:'flex', flexDirection:'column', gap:'1rem' } });
  wrap.append(header('tool · local-first', 'Metadata stripper', `${results.length} file${results.length === 1 ? '' : 's'} inspected locally.`));
  if (omitted) wrap.append(el('div', { class:'gs-warn' }, el('span', {}, `${omitted} additional files were not opened. Batch processing is capped at 100 files.`)));

  const valid = results.filter(r => !r.error);
  const dirty = valid.filter(r => r.removed.length);
  const gpsCount = valid.filter(r => r.exif?.gps).length;
  const summary = el('div', { class:'gs-card', style:{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(130px,1fr))', gap:'.8rem' } },
    metric('files', results.length), metric('with metadata', dirty.length), metric('with location', gpsCount), metric('already clean', valid.length - dirty.length));
  wrap.append(summary);

  const list = el('div', { class:'gs-card' });
  list.append(el('div', { class:'gs-label', style:{ marginBottom:'.5rem' } }, 'inspection'));
  for (const r of results) {
    const row = el('div', { style:{ display:'grid', gridTemplateColumns:'minmax(0,1fr) auto', gap:'1rem', padding:'.55rem 0', borderBottom:'1px solid var(--border)', alignItems:'start' } });
    const left = el('div', {}, el('div', { class:'gs-mono', style:{ fontSize:'.76rem', overflowWrap:'anywhere' } }, r.file.name));
    if (r.error) left.append(el('div', { style:{ color:'var(--gold)', fontSize:'.76rem' } }, r.error));
    else {
      const detail = [];
      if (r.exif?.gps) detail.push('GPS location');
      if (r.exif?.make || r.exif?.model) detail.push([r.exif.make, r.exif.model].filter(Boolean).join(' '));
      if (r.exif?.dateTime) detail.push(r.exif.dateTime);
      if (r.removed.length) detail.push(`${r.removed.length} metadata block${r.removed.length === 1 ? '' : 's'}`);
      left.append(el('div', { class:'gs-muted', style:{ fontSize:'.74rem', marginTop:'.18rem' } }, detail.length ? detail.join(' · ') : 'No removable metadata found'));
    }
    const right = el('div', { class:'gs-mono', style:{ fontSize:'.7rem', textAlign:'right', color:r.exif?.gps ? 'var(--gold)' : 'var(--muted)' } }, r.error ? 'skipped' : (r.removed.length ? 'will strip' : 'clean'));
    row.append(left, right); list.append(row);
  }
  wrap.append(list);

  const status = el('div', { class:'gs-mono gs-muted', style:{ fontSize:'.75rem' }, 'aria-live':'polite' });
  const dl = el('button', { class:'gs-btn gs-btn-primary', disabled:dirty.length ? null : true, onclick:() => {
    if (dirty.length === 1 && valid.length === 1) {
      const r = dirty[0];
      const ext = /\.png$/i.test(r.file.name) ? '.png' : '.jpg';
      download(r.bytes, `${baseName(r.file.name)}-clean${ext}`, r.type);
      status.textContent = 'Cleaned image downloaded.';
      return;
    }
    const files = {};
    const usedNames = new Set();
    for (const r of valid) {
      const ext = /\.png$/i.test(r.file.name) ? '.png' : '.jpg';
      const preferred = r.removed.length ? `${baseName(r.file.name)}-clean${ext}` : r.file.name;
      const name = uniqueArchiveName(preferred, usedNames);
      files[name] = r.removed.length ? r.bytes : new Uint8Array(r.bytes);
    }
    download(zipSync(files, { level:6 }), 'metadata-clean-images.zip', 'application/zip');
    status.textContent = `${valid.length} image${valid.length === 1 ? '' : 's'} packaged into a ZIP.`;
  } }, valid.length > 1 ? `Download ${valid.length} images as ZIP` : 'Strip & download');
  const again = el('button', { class:'gs-btn gs-btn-ghost', onclick:start }, 'Another batch');
  wrap.append(el('div', { class:'gs-toolbar' }, dl, again), status);
  render(wrap);
}

function metric(label, value) {
  return el('div', {}, el('div', { style:{ fontFamily:'var(--fh)', color:'var(--text)', fontSize:'1.5rem', lineHeight:'1.1' } }, value), el('div', { class:'gs-mono gs-muted', style:{ fontSize:'.68rem', marginTop:'.2rem' } }, label));
}

start();
