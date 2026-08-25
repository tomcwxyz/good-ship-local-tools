import { chrome, header, assurance, dropzoneMulti, download, el, fmtBytes, baseName } from '../../src/shell.js';
import { assertSafeSvgFile } from '../../src/lib/svg.js';
import { uniqueArchiveName, selectBatchFiles } from '../../src/lib/archive.js';
import { batchImageSize, imageOutputExtension, imageOutputMime } from '../../src/lib/image.js';
import { zipSync } from 'fflate';

const root = chrome('image converter');
let view;
const render = node => { if (view) view.remove(); view = node; root.append(node); };
const MAX_DIMENSION = 16384;
const MAX_PIXELS = 80_000_000;
const MAX_FILE_BYTES = 80 * 1024 * 1024;
const MAX_BATCH_OUTPUT = 300 * 1024 * 1024;

function start() {
  const box = el('div');
  box.append(
    header('tool · images', 'Image converter',
      'Convert, resize and compress one image or apply the same policy to a batch. SVG, PNG, JPEG and WebP — re-encoded locally.'),
    el('div', { style: { margin: '1rem 0 1.25rem' } }, assurance()),
    dropzoneMulti('image/*,.svg',
      '<div style="font-family:var(--fh);color:var(--text);font-size:1.1rem;margin-bottom:.25rem">Drop image(s), or click to choose</div>' +
      '<div class="gs-mono" style="font-size:.75rem;color:var(--muted)">SVG · PNG · JPEG · WebP · multiple files download as one ZIP</div>',
      handleFiles));
  render(box);
}

async function handleFiles(files) {
  const batch = selectBatchFiles(files);
  if (!batch.selected.length) {
    render(errorCard('This selection exceeds the 300 MB combined input limit. Choose a smaller batch.'));
    return;
  }
  if (batch.selected.length === 1 && !batch.skipped.length) {
    await handleSingle(batch.selected[0]);
    return;
  }
  showBatch(batch.selected, batch.skipped.length);
}

async function handleSingle(file) {
  try {
    if (file.size > MAX_FILE_BYTES) throw new Error('Files over 80 MB are not opened by this tool.');
    const img = await loadImageFile(file);
    setupSingle(file, img);
  } catch (err) {
    render(errorCard(err.message));
  }
}

function errorCard(message) {
  return el('div', { class: 'gs-warn' }, el('span', {}, message),
    el('button', { class: 'gs-btn gs-btn-ghost', style: { marginLeft: 'auto' }, onclick: start }, 'Try again'));
}

function formatSelect(defaultValue = 'png') {
  return el('select', {}, ...['png', 'jpeg', 'webp'].map(format =>
    el('option', { value: format, selected: format === defaultValue }, format.toUpperCase())));
}

function qualityControl(onInput) {
  const input = el('input', {
    type: 'range', min: '0.1', max: '1', step: '0.05', value: '0.85',
    style: { width: '160px' }, 'aria-label': 'Output quality',
  });
  const value = el('span', { class: 'gs-mono gs-muted', style: { fontSize: '.75rem' } }, '85%');
  input.addEventListener('input', () => {
    value.textContent = Math.round(Number(input.value) * 100) + '%';
    onInput?.();
  });
  const wrap = el('label', { class: 'gs-toolbar', style: { fontSize: '.8rem' } },
    el('span', { class: 'gs-label' }, 'quality'), input, value);
  return { input, wrap };
}

function setupSingle(file, img) {
  const natW = img.naturalWidth || 1024;
  const natH = img.naturalHeight || 1024;
  const ratio = natW / natH;
  const fmt = formatSelect('png');
  const w = el('input', { type: 'number', value: natW, min: 1, max: MAX_DIMENSION, inputMode: 'numeric' });
  const h = el('input', { type: 'number', value: natH, min: 1, max: MAX_DIMENSION, inputMode: 'numeric' });
  const lock = el('input', { type: 'checkbox', checked: true });
  const preview = el('img', { alt: 'Converted preview', style: { maxWidth: '100%', maxHeight: '300px', border: '1px solid var(--border)', borderRadius: 'var(--r)', display: 'block' } });
  const stats = el('div', { class: 'gs-mono', style: { fontSize: '.78rem', margin: '.5rem 0', minHeight: '1.2rem' }, 'aria-live': 'polite' });
  let blob = null;
  let previewUrl = null;
  let conversionToken = 0;

  const quality = qualityControl(convert);
  quality.wrap.style.display = 'none';

  w.addEventListener('input', () => { if (lock.checked) h.value = Math.max(1, Math.round((Number(w.value) || 1) / ratio)); convert(); });
  h.addEventListener('input', () => { if (lock.checked) w.value = Math.max(1, Math.round((Number(h.value) || 1) * ratio)); convert(); });
  lock.addEventListener('change', convert);
  fmt.addEventListener('change', () => { quality.wrap.style.display = fmt.value === 'png' ? 'none' : 'flex'; convert(); });

  let timer;
  function convert() {
    clearTimeout(timer);
    timer = setTimeout(doConvert, 120);
  }

  async function doConvert() {
    const token = ++conversionToken;
    const ow = Math.round(Number(w.value) || 0);
    const oh = Math.round(Number(h.value) || 0);
    if (!validOutputSize(ow, oh)) {
      blob = null;
      dl.disabled = true;
      stats.style.color = 'var(--gold)';
      stats.textContent = `Choose dimensions up to ${MAX_DIMENSION.toLocaleString()} px and no more than ${(MAX_PIXELS / 1_000_000).toFixed(0)} megapixels.`;
      return;
    }
    stats.style.color = 'var(--muted)';
    stats.textContent = 'Converting…';
    try {
      const next = await convertImage(img, ow, oh, fmt.value, Number(quality.input.value));
      if (token !== conversionToken) return;
      blob = next;
      dl.disabled = false;
      if (previewUrl) URL.revokeObjectURL(previewUrl);
      previewUrl = URL.createObjectURL(next);
      preview.src = previewUrl;
      const pct = file.size ? ((next.size / file.size) * 100).toFixed(0) : '—';
      stats.textContent = `${ow}×${oh} · ${fmtBytes(next.size)} (${pct}% of original ${fmtBytes(file.size)})`;
      stats.style.color = next.size <= file.size ? 'var(--green-dk)' : 'var(--gold)';
    } catch (err) {
      if (token !== conversionToken) return;
      blob = null;
      dl.disabled = true;
      stats.style.color = 'var(--gold)';
      stats.textContent = err.message;
    }
  }

  const dl = el('button', { class: 'gs-btn gs-btn-primary', disabled: true, onclick: () => {
    if (!blob) return;
    download(blob, `${baseName(file.name)}.${imageOutputExtension(fmt.value)}`, imageOutputMime(fmt.value));
  } }, 'Download');
  const again = el('button', { class: 'gs-btn gs-btn-ghost', onclick: () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    start();
  } }, 'Another image');
  const row = (label, ...children) => el('div', { class: 'gs-toolbar' },
    el('span', { class: 'gs-label', style: { width: '70px' } }, label), ...children);

  const box = el('div');
  box.append(header('tool · images', 'Image converter', null),
    el('div', { class: 'gs-mono', style: { fontSize: '.8rem', margin: '.25rem 0 .75rem' } }, `${file.name} · ${fmtBytes(file.size)}`),
    el('div', { class: 'gs-card', style: { display: 'flex', flexDirection: 'column', gap: '.7rem', maxWidth: '520px' } },
      row('format', fmt),
      row('size', w, el('span', { class: 'gs-muted', 'aria-hidden': 'true' }, '×'), h,
        el('label', { class: 'gs-toolbar', style: { gap: '.3rem', fontSize: '.78rem' } }, lock, 'lock ratio')),
      quality.wrap),
    el('div', { style: { margin: '1rem 0' } }, preview), stats,
    el('div', { class: 'gs-toolbar' }, dl, again));
  render(box);
  doConvert();
}

function showBatch(files, omitted) {
  const fmt = formatSelect('jpeg');
  const maxEdge = el('input', {
    type: 'number', min: '0', max: MAX_DIMENSION, step: '100', value: '1600', inputMode: 'numeric',
    'aria-label': 'Maximum long edge in pixels', style: { width: '9rem' },
  });
  const allowUpscale = el('input', { type: 'checkbox' });
  const quality = qualityControl();
  const status = el('div', { class: 'gs-mono gs-muted', style: { fontSize: '.76rem', minHeight: '1.2rem' }, 'aria-live': 'polite' });
  const results = el('div', { style: { display: 'grid', gap: '.35rem' } });

  function syncQuality() {
    quality.wrap.style.display = fmt.value === 'png' ? 'none' : 'flex';
  }
  fmt.addEventListener('change', syncQuality);
  syncQuality();

  const convert = el('button', { class: 'gs-btn gs-btn-primary', onclick: async () => {
    convert.disabled = true;
    results.replaceChildren();
    try {
      const edge = Math.max(0, Number(maxEdge.value) || 0);
      const outcome = await convertBatch(files, {
        format: fmt.value,
        maxEdge: edge,
        allowUpscale: allowUpscale.checked,
        quality: Number(quality.input.value),
      }, status, results);
      if (outcome.successes.length) {
        const archive = {};
        const used = new Set();
        for (const item of outcome.successes) {
          archive[uniqueArchiveName(item.name, used)] = item.bytes;
        }
        status.textContent = `Packaging ${outcome.successes.length} converted image${outcome.successes.length === 1 ? '' : 's'}…`;
        download(zipSync(archive, { level: 0 }), 'converted-images.zip', 'application/zip');
        status.textContent = `${outcome.successes.length} converted · ${outcome.failures.length} skipped · ${fmtBytes(outcome.totalOutput)} output · ZIP downloaded`;
      } else {
        status.textContent = 'No images could be converted with this policy.';
      }
    } catch (err) {
      status.textContent = err.message;
    } finally {
      convert.disabled = false;
    }
  } }, `Convert ${files.length} images & download ZIP`);

  const sample = el('div', { class: 'gs-card' },
    el('div', { class: 'gs-label', style: { marginBottom: '.4rem' } }, 'selected files'),
    ...files.slice(0, 12).map(file => el('div', { class: 'gs-mono', style: { fontSize: '.72rem', overflowWrap: 'anywhere', padding: '.16rem 0' } }, `${file.name} · ${fmtBytes(file.size)}`)),
    files.length > 12 ? el('div', { class: 'gs-mono gs-muted', style: { fontSize: '.7rem', marginTop: '.3rem' } }, `+ ${files.length - 12} more`) : null);

  const box = el('div');
  box.append(header('tool · images', 'Batch image converter', `${files.length} images · one conversion policy · processed sequentially in this browser.`));
  if (omitted) box.append(el('div', { class: 'gs-warn', style: { marginBottom: '.8rem' } },
    el('span', {}, `${omitted} additional file${omitted === 1 ? '' : 's'} were not opened. A batch is capped at 100 files and 300 MB combined input.`)));
  box.append(
    el('div', { class: 'gs-card', style: { display: 'grid', gap: '.75rem', marginBottom: '.8rem' } },
      el('div', { class: 'gs-toolbar' },
        el('label', {}, el('span', { class: 'gs-label', style: { marginRight: '.4rem' } }, 'format'), fmt),
        el('label', {}, el('span', { class: 'gs-label', style: { marginRight: '.4rem' } }, 'max long edge'), maxEdge, el('span', { class: 'gs-muted', style: { marginLeft: '.3rem', fontSize: '.76rem' } }, 'px · 0 keeps original size')),
        el('label', { class: 'gs-toolbar', style: { gap: '.35rem', fontSize: '.8rem' } }, allowUpscale, 'allow upscaling')),
      quality.wrap,
      el('p', { class: 'gs-muted', style: { margin: 0, fontSize: '.76rem' } }, 'Every image keeps its aspect ratio. Conversion stops before the ZIP exceeds 300 MB of converted image data; individual files over 80 MB are skipped.')),
    sample,
    el('div', { class: 'gs-toolbar', style: { margin: '.8rem 0' } }, convert, el('button', { class: 'gs-btn gs-btn-ghost', onclick: start }, 'Choose another batch')),
    status, results);
  render(box);
}

async function convertBatch(files, policy, status, results) {
  const successes = [];
  const failures = [];
  let totalOutput = 0;

  for (let index = 0; index < files.length; index++) {
    const file = files[index];
    status.textContent = `Converting ${index + 1} of ${files.length} · ${file.name}`;
    if (file.size > MAX_FILE_BYTES) {
      const error = 'input is over the 80 MB per-file limit';
      failures.push({ file, error });
      appendBatchResult(results, file.name, error, false);
      continue;
    }
    try {
      const img = await loadImageFile(file);
      const size = batchImageSize(img.naturalWidth, img.naturalHeight, {
        maxEdge: policy.maxEdge,
        allowUpscale: policy.allowUpscale,
        maxDimension: MAX_DIMENSION,
        maxPixels: MAX_PIXELS,
      });
      const blob = await convertImage(img, size.width, size.height, policy.format, policy.quality);
      if (blob.size > MAX_FILE_BYTES) throw new Error('converted output is over the 80 MB per-file limit');
      if (totalOutput + blob.size > MAX_BATCH_OUTPUT) {
        const remaining = files.length - index;
        const message = `300 MB combined output cap reached; ${remaining} remaining file${remaining === 1 ? '' : 's'} not converted`;
        for (let skipped = index; skipped < files.length; skipped++) {
          failures.push({ file: files[skipped], error: message });
          appendBatchResult(results, files[skipped].name, message, false);
        }
        break;
      }
      const ext = imageOutputExtension(policy.format);
      const bytes = new Uint8Array(await blob.arrayBuffer());
      const name = `${baseName(file.name)}-converted.${ext}`;
      totalOutput += bytes.byteLength;
      successes.push({ file, name, bytes, width: size.width, height: size.height });
      appendBatchResult(results, file.name, `${size.width}×${size.height} · ${fmtBytes(bytes.byteLength)}`, true);
    } catch (err) {
      failures.push({ file, error: err.message });
      appendBatchResult(results, file.name, err.message, false);
    }
  }

  return { successes, failures, totalOutput };
}

function appendBatchResult(container, name, detail, success) {
  container.append(el('div', {
    style: { display: 'grid', gridTemplateColumns: 'minmax(0,1fr) auto', gap: '.8rem', borderBottom: '1px solid var(--border)', padding: '.35rem 0' },
  },
  el('span', { class: 'gs-mono', style: { fontSize: '.72rem', overflowWrap: 'anywhere' } }, name),
  el('span', { class: 'gs-mono', style: { fontSize: '.7rem', color: success ? 'var(--green-dk)' : 'var(--gold)', textAlign: 'right' } }, detail)));
}

async function loadImageFile(file) {
  if (/\.svg$/i.test(file.name) || file.type === 'image/svg+xml') await assertSafeSvgFile(file);
  const url = URL.createObjectURL(file);
  try {
    return await loadImage(url);
  } finally {
    URL.revokeObjectURL(url);
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

function validOutputSize(width, height) {
  return width > 0 && height > 0 && width <= MAX_DIMENSION && height <= MAX_DIMENSION && width * height <= MAX_PIXELS;
}

async function convertImage(img, width, height, format, quality) {
  if (!validOutputSize(width, height)) throw new Error('Output dimensions exceed the browser safety limit.');
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  if (format === 'jpeg') {
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, width, height);
  }
  ctx.drawImage(img, 0, 0, width, height);
  try {
    return await canvasBlob(canvas, imageOutputMime(format), quality);
  } finally {
    canvas.width = 1;
    canvas.height = 1;
  }
}

function canvasBlob(canvas, type, quality) {
  return new Promise((resolve, reject) => canvas.toBlob(blob =>
    blob ? resolve(blob) : reject(new Error('This output format is not supported by your browser.')), type, quality));
}

start();
