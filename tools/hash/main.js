import { chrome, header, assurance, el, fmtBytes, copyText } from '../../src/shell.js';
import { sha256Hex } from '../../src/lib/digest.js';

const root = chrome('file checksum');
root.append(
  header('tool · verify', 'File checksum',
    'Create SHA-256 fingerprints for local files, or compare a fingerprint someone has given you.'),
  el('div', { style: { margin: '1rem 0 1.25rem' } }, assurance('Files are read locally to calculate their SHA-256 checksum. The file contents are not uploaded.')),
);

const input = el('input', { type: 'file', multiple: true, class: 'gs-visually-hidden' });
const drop = el('div', { class: 'gs-drop', role: 'button', tabIndex: 0, 'aria-label': 'Choose files or drop them here' }, input);
drop.insertAdjacentHTML('afterbegin',
  '<div style="font-family:var(--fh);color:var(--text);font-size:1.1rem;margin-bottom:.25rem">Drop file(s), or click to choose</div>' +
  '<div class="gs-mono" style="font-size:.75rem;color:var(--muted)">SHA-256 · any file type</div>');
const results = el('div', { style: { display: 'grid', gap: '.75rem', marginTop: '1rem' } });
const status = el('div', { class: 'gs-mono gs-muted', style: { fontSize: '.78rem', marginTop: '.6rem' }, 'aria-live': 'polite' });
const expected = el('input', { type: 'text', placeholder: 'Paste expected SHA-256…', spellcheck: false, style: { width: 'min(100%, 570px)' }, 'aria-label': 'Expected SHA-256 checksum' });
const checkStatus = el('div', { class: 'gs-mono', style: { fontSize: '.78rem', minHeight: '1.2rem', marginTop: '.35rem' }, 'aria-live': 'polite' });
const hashes = [];

function choose() { input.click(); }
drop.addEventListener('click', e => { if (e.target !== input) choose(); });
drop.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); choose(); } });
input.addEventListener('change', () => addFiles([...input.files]));
drop.addEventListener('dragover', e => { e.preventDefault(); drop.classList.add('drag'); });
drop.addEventListener('dragleave', () => drop.classList.remove('drag'));
drop.addEventListener('drop', e => { e.preventDefault(); drop.classList.remove('drag'); addFiles([...e.dataTransfer.files]); });
expected.addEventListener('input', checkExpected);

async function addFiles(files) {
  if (!globalThis.crypto?.subtle) {
    status.style.color = 'var(--gold)';
    status.textContent = 'SHA-256 is not available in this browser context.';
    return;
  }
  for (const file of files) {
    status.style.color = 'var(--muted)';
    status.textContent = `Hashing ${file.name}…`;
    try {
      const hash = await sha256Hex(await file.arrayBuffer());
      hashes.push({ file, hash });
      results.append(resultCard(file, hash));
    } catch (err) {
      results.append(el('div', { class: 'gs-warn' }, el('span', {}, `Could not hash ${file.name}: ${err.message}`)));
    }
  }
  status.textContent = hashes.length ? `${hashes.length} file${hashes.length === 1 ? '' : 's'} hashed` : '';
  checkExpected();
}

function resultCard(file, hash) {
  const copy = el('button', { class: 'gs-btn gs-btn-ghost', onclick: async () => {
    const ok = await copyText(hash);
    copy.textContent = ok ? 'Copied' : 'Copy unavailable';
    setTimeout(() => { copy.textContent = 'Copy'; }, 1200);
  } }, 'Copy');
  return el('div', { class: 'gs-card' },
    el('div', { style: { display: 'flex', justifyContent: 'space-between', gap: '.75rem', flexWrap: 'wrap' } },
      el('div', {},
        el('div', { style: { color: 'var(--text)', fontWeight: 600 } }, file.name),
        el('div', { class: 'gs-mono gs-muted', style: { fontSize: '.72rem' } }, fmtBytes(file.size))),
      copy),
    el('div', { class: 'gs-mono', style: { fontSize: '.74rem', overflowWrap: 'anywhere', marginTop: '.7rem', color: 'var(--text)' } }, hash));
}

function checkExpected() {
  const value = expected.value.trim().toLowerCase().replace(/^sha256[:\s-]*/i, '').replace(/\s+/g, '');
  if (!value) { checkStatus.textContent = ''; return; }
  if (!/^[0-9a-f]{64}$/.test(value)) {
    checkStatus.style.color = 'var(--gold)';
    checkStatus.textContent = 'Expected SHA-256 should be 64 hexadecimal characters.';
    return;
  }
  const match = hashes.find(x => x.hash === value);
  checkStatus.style.color = match ? 'var(--green-dk)' : 'var(--gold)';
  checkStatus.textContent = match ? `✓ Match: ${match.file.name}` : hashes.length ? 'No loaded file matches that checksum.' : 'Add a file to compare it.';
}

root.append(drop, status,
  el('section', { class: 'gs-card', style: { marginTop: '1rem' } },
    el('div', { class: 'gs-label', style: { marginBottom: '.4rem' } }, 'verify a checksum'),
    expected, checkStatus),
  results,
  el('p', { class: 'gs-mono gs-muted', style: { fontSize: '.72rem' } }, 'Large files are held in memory briefly while the browser calculates the digest.'));
