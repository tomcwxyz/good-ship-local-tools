import { chrome, header, assurance, dropzone, download, el, fmtBytes, baseName } from '../../src/shell.js';
import { assertSafeSvgFile } from '../../src/lib/svg.js';

const root = chrome('image converter');
let view;
const render = n => { if (view) view.remove(); view = n; root.append(n); };
const MIME = { png: 'image/png', jpeg: 'image/jpeg', webp: 'image/webp' };
const MAX_DIMENSION = 16384;
const MAX_PIXELS = 80_000_000;

function start() {
  const box = el('div');
  box.append(
    header('tool · images', 'Image converter',
      'Convert between formats, resize, and compress. SVG, PNG, JPEG and WebP — re-encoded in the browser.'),
    el('div', { style: { margin: '1rem 0 1.25rem' } }, assurance()),
    dropzone('image/*,.svg',
      '<div style="font-family:var(--fh);color:var(--text);font-size:1.1rem;margin-bottom:.25rem">Drop an image, or click to choose</div>' +
      '<div class="gs-mono" style="font-size:.75rem;color:var(--muted)">SVG · PNG · JPEG · WebP</div>',
      handle));
  render(box);
}

async function handle(file) {
  try {
    if (/\.svg$/i.test(file.name) || file.type === 'image/svg+xml') await assertSafeSvgFile(file);
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => { setup(file, img); URL.revokeObjectURL(url); };
    img.onerror = () => { URL.revokeObjectURL(url); render(errorCard('Could not load that image.')); };
    img.src = url;
  } catch (err) {
    render(errorCard(err.message));
  }
}

function errorCard(message) {
  return el('div', { class: 'gs-warn' }, el('span', {}, message),
    el('button', { class: 'gs-btn gs-btn-ghost', style: { marginLeft: 'auto' }, onclick: start }, 'Try again'));
}

function setup(file, img) {
  const natW = img.naturalWidth || 1024;
  const natH = img.naturalHeight || 1024;
  const ratio = natW / natH;
  const fmt = el('select', {}, ...['png', 'jpeg', 'webp'].map(f => el('option', { value: f }, f.toUpperCase())));
  const w = el('input', { type: 'number', value: natW, min: 1, max: MAX_DIMENSION, inputMode: 'numeric' });
  const h = el('input', { type: 'number', value: natH, min: 1, max: MAX_DIMENSION, inputMode: 'numeric' });
  const lock = el('input', { type: 'checkbox', checked: true });
  const quality = el('input', { type: 'range', min: '0.1', max: '1', step: '0.05', value: '0.85', style: { width: '160px' }, 'aria-label': 'Output quality' });
  const qualityValue = el('span', { class: 'gs-mono gs-muted', style: { fontSize: '.75rem' } }, '85%');
  const qWrap = el('label', { class: 'gs-toolbar', style: { fontSize: '.8rem' } }, el('span', { class: 'gs-label' }, 'quality'), quality, qualityValue);
  const preview = el('img', { alt: 'Converted preview', style: { maxWidth: '100%', maxHeight: '300px', border: '1px solid var(--border)', borderRadius: 'var(--r)', display: 'block' } });
  const stats = el('div', { class: 'gs-mono', style: { fontSize: '.78rem', margin: '.5rem 0', minHeight: '1.2rem' }, 'aria-live': 'polite' });
  let blob = null;
  let previewUrl = null;

  w.addEventListener('input', () => { if (lock.checked) h.value = Math.max(1, Math.round((+w.value || 1) / ratio)); convert(); });
  h.addEventListener('input', () => { if (lock.checked) w.value = Math.max(1, Math.round((+h.value || 1) * ratio)); convert(); });
  quality.addEventListener('input', () => { qualityValue.textContent = Math.round(+quality.value * 100) + '%'; convert(); });
  lock.addEventListener('change', convert);
  fmt.addEventListener('change', () => { qWrap.style.display = fmt.value === 'png' ? 'none' : 'flex'; convert(); });

  let t;
  function convert() { clearTimeout(t); t = setTimeout(doConvert, 120); }
  function doConvert() {
    const ow = Math.round(+w.value || 0);
    const oh = Math.round(+h.value || 0);
    if (ow < 1 || oh < 1 || ow > MAX_DIMENSION || oh > MAX_DIMENSION || ow * oh > MAX_PIXELS) {
      blob = null;
      dl.disabled = true;
      stats.style.color = 'var(--gold)';
      stats.textContent = `Choose dimensions up to ${MAX_DIMENSION.toLocaleString()} px and no more than ${(MAX_PIXELS / 1_000_000).toFixed(0)} megapixels.`;
      return;
    }
    const c = document.createElement('canvas');
    c.width = ow; c.height = oh;
    const ctx = c.getContext('2d');
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    if (fmt.value === 'jpeg') { ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, ow, oh); }
    ctx.drawImage(img, 0, 0, ow, oh);
    c.toBlob(b => {
      if (!b) { blob = null; dl.disabled = true; stats.textContent = 'This output format is not supported by your browser.'; return; }
      blob = b;
      dl.disabled = false;
      if (previewUrl) URL.revokeObjectURL(previewUrl);
      previewUrl = URL.createObjectURL(b);
      preview.src = previewUrl;
      const pct = file.size ? ((b.size / file.size) * 100).toFixed(0) : '—';
      stats.textContent = `${ow}×${oh} · ${fmtBytes(b.size)} (${pct}% of original ${fmtBytes(file.size)})`;
      stats.style.color = b.size <= file.size ? 'var(--green-dk)' : 'var(--gold)';
    }, MIME[fmt.value], +quality.value);
  }

  const dl = el('button', { class: 'gs-btn gs-btn-primary', disabled: true, onclick: () => blob && download(blob, baseName(file.name) + '.' + fmt.value, MIME[fmt.value]) }, 'Download');
  const again = el('button', { class: 'gs-btn gs-btn-ghost', onclick: () => { if (previewUrl) URL.revokeObjectURL(previewUrl); start(); } }, 'Another image');
  const row = (label, ...kids) => el('div', { class: 'gs-toolbar' }, el('span', { class: 'gs-label', style: { width: '70px' } }, label), ...kids);

  const box = el('div');
  box.append(header('tool · images', 'Image converter', null),
    el('div', { class: 'gs-mono', style: { fontSize: '.8rem', margin: '.25rem 0 .75rem' } }, file.name + ' · ' + fmtBytes(file.size)),
    el('div', { class: 'gs-card', style: { display: 'flex', flexDirection: 'column', gap: '.7rem', maxWidth: '520px' } },
      row('format', fmt),
      row('size', w, el('span', { class: 'gs-muted', 'aria-hidden': 'true' }, '×'), h,
        el('label', { class: 'gs-toolbar', style: { gap: '.3rem', fontSize: '.78rem' } }, lock, 'lock ratio')),
      qWrap),
    el('div', { style: { margin: '1rem 0' } }, preview), stats,
    el('div', { class: 'gs-toolbar' }, dl, again));
  render(box);
  doConvert();
}
start();
