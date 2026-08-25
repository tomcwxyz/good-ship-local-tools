import { chrome, header, assurance, dropzone, download, fmtBytes, el } from '../../src/shell.js';

import { processJPEG, processPNG } from '../../src/lib/metadata.js';

const root = chrome('metadata stripper');
let view;
function render(node) { if (view) view.remove(); view = node; root.append(node); }

function start() {
  const box = el('div');
  box.append(
    header('tool · local-first', 'Metadata stripper',
      'Photos carry hidden data — where they were taken, on what device, by whom. Strip it before you share.'),
    el('div', { style:{ margin:'1rem 0 1.25rem' } }, assurance()),
    dropzone('image/jpeg,image/png',
      '<svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#5B8A72" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 5 17 10"/><line x1="12" y1="5" x2="12" y2="15"/></svg>' +
      '<div style="font-family:var(--fh);color:var(--text);font-size:1.1rem;margin:.5rem 0 .25rem">Drop an image, or click to choose</div>' +
      '<div class="gs-mono" style="font-size:.75rem;color:var(--muted)">JPEG · PNG</div>',
      handle),
  );
  render(box);
}

async function handle(file) {
  try {
    const buf = await file.arrayBuffer();
    let r = null;
    let type = null;
    if (file.type === 'image/jpeg' || /\.jpe?g$/i.test(file.name)) { r = processJPEG(buf); type = 'image/jpeg'; }
    else if (file.type === 'image/png' || /\.png$/i.test(file.name)) { r = processPNG(buf); type = 'image/png'; }
    if (!r) return showError(file, 'This tool strips JPEG and PNG losslessly. Other formats need a re-encode — not offered here so nothing is silently recompressed.');
    showResult(file, { ...r, original: buf.byteLength, type });
  } catch (err) {
    showError(file, 'That file looks malformed or could not be safely processed: ' + err.message);
  }
}

function showError(file, msg) {
  const card = el('div', { class:'gs-warn' });
  card.innerHTML = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>';
  const body = el('div', {}, el('span', {}, msg),
    el('div', { style:{ marginTop:'.6rem' } }, el('button', { class:'gs-btn gs-btn-ghost', onclick:start }, 'Try another file')));
  card.append(body);
  render(card);
}

function showResult(file, r) {
  const wrap = el('div', { style:{ display:'flex', flexDirection:'column', gap:'1rem' } });
  const card = el('div', { class:'gs-card' });
  const name = el('div', { style:{ display:'flex', alignItems:'center', gap:'.5rem', marginBottom:'.75rem' } });
  name.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#5B8A72" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/></svg>';
  name.append(el('span', { class:'gs-mono', style:{ fontSize:'.8rem' } }, file.name),
    el('span', { class:'gs-mono gs-muted', style:{ fontSize:'.72rem' } }, '· ' + fmtBytes(r.original)));
  card.append(name);

  if (r.exif && r.exif.gps) {
    const w = el('div', { class:'gs-warn', style:{ marginBottom:'.85rem' } });
    w.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0z"/><circle cx="12" cy="10" r="3"/></svg>';
    const t = r.exif.gps.lat
      ? `Location data found. This image records where it was taken: ${r.exif.gps.lat}, ${r.exif.gps.lon}.`
      : 'Location data found. This image carries GPS coordinates.';
    w.append(el('div', {}, el('strong', {}, 'Location data found. '), t.replace('Location data found. ','')));
    card.append(w);
  }
  if (r.exif && (r.exif.make || r.exif.dateTime)) {
    const m = el('div', { class:'gs-mono', style:{ fontSize:'.75rem', color:'var(--body)', marginBottom:'.85rem' } });
    if (r.exif.make) m.append(el('div', {}, `device · ${r.exif.make} ${r.exif.model || ''}`));
    if (r.exif.dateTime) m.append(el('div', {}, `captured · ${r.exif.dateTime}`));
    card.append(m);
  }
  card.append(el('div', { class:'gs-label', style:{ marginBottom:'.4rem' } }, 'will be removed'));
  if (!r.removed.length) {
    card.append(el('div', { style:{ fontSize:'.85rem' } }, '✓ Already clean — no metadata found.'));
  } else {
    const ul = el('ul', { style:{ listStyle:'none', padding:0, margin:0, fontSize:'.85rem' } });
    for (const x of r.removed) ul.append(el('li', {
      style:{ display:'flex', justifyContent:'space-between', padding:'.2rem 0', borderBottom:'1px solid var(--border)' } },
      el('span', {}, x.type), el('span', { class:'gs-mono gs-muted' }, fmtBytes(x.size))));
    card.append(ul);
  }

  const strip = el('button', { class:'gs-btn gs-btn-primary', disabled: r.removed.length ? null : 'true',
    onclick:() => {
      const dot = file.name.lastIndexOf('.');
      const fn = (dot > 0 ? file.name.slice(0, dot) : file.name) + '-clean' + (dot > 0 ? file.name.slice(dot) : '');
      download(r.bytes, fn, r.type);
    } },
    r.removed.length ? `Strip & download (${fmtBytes(r.bytes.length)})` : 'Nothing to strip');
  const again = el('button', { class:'gs-btn gs-btn-ghost', onclick:start }, 'Another file');
  wrap.append(card, el('div', { style:{ display:'flex', gap:'.6rem', flexWrap:'wrap' } }, strip, again));
  render(wrap);
}

start();
