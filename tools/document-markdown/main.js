import { assurance, chrome, copyText, download, dropzone, el, fmtBytes, header } from '../../src/shell.js';
import { convertDocumentBytes, prepareAnydoc } from '../../src/lib/anydoc-browser.js';
import { describeAnydocError, markdownFilename, markdownStats, MAX_DOCUMENT_BYTES } from '../../src/lib/document-markdown.js';

const ACCEPT = [
  '.doc', '.docx', '.docm', '.dotx', '.dotm',
  '.odt', '.rtf', '.epub', '.pdf',
  '.ppt', '.pptx', '.pptm', '.ppsx', '.ppsm', '.potx', '.potm',
  '.xls', '.xlsx', '.xlsm', '.xlsb', '.ods', '.odp', '.csv',
].join(',');

const root = chrome('document to markdown');
root.append(
  header(
    'tool · files',
    'Document → Markdown',
    'Turn Word, PowerPoint, spreadsheet, OpenDocument, RTF, EPUB, CSV and text-based PDF files into clean Markdown without uploading the source.',
  ),
  el('div', { style:{ margin:'1rem 0 1.1rem' } }, assurance(
    'Conversion runs locally with Anydoc compiled to WebAssembly. The source file and converted text do not leave this browser.',
  )),
);

const status = el('div', {
  class:'gs-mono gs-muted',
  style:{ fontSize:'.78rem', minHeight:'1.25rem', marginTop:'.65rem' },
  'aria-live':'polite',
});

const details = el('div', {
  class:'gs-mono gs-muted',
  style:{ fontSize:'.72rem', minHeight:'1.1rem', marginTop:'.3rem' },
});

const output = el('textarea', {
  rows:20,
  readOnly:true,
  spellcheck:false,
  'aria-label':'Converted Markdown',
  placeholder:'Converted Markdown appears here…',
});

const copy = el('button', { class:'gs-btn gs-btn-primary', type:'button', disabled:true }, 'Copy Markdown');
const save = el('button', { class:'gs-btn gs-btn-ghost', type:'button', disabled:true }, 'Download .md');
const clear = el('button', { class:'gs-btn gs-btn-ghost', type:'button', disabled:true }, 'Clear');

let currentFile = null;

function reset() {
  currentFile = null;
  output.value = '';
  status.textContent = 'Choose a document to convert.';
  status.style.color = 'var(--muted)';
  details.textContent = '';
  copy.disabled = true;
  save.disabled = true;
  clear.disabled = true;
}

async function handleFile(file) {
  currentFile = null;
  output.value = '';
  copy.disabled = true;
  save.disabled = true;
  clear.disabled = false;
  details.textContent = '';

  if (file.size > MAX_DOCUMENT_BYTES) {
    status.style.color = 'var(--gold)';
    status.textContent = `${file.name} is ${fmtBytes(file.size)}. This tool does not open documents over ${fmtBytes(MAX_DOCUMENT_BYTES)}.`;
    return;
  }

  status.style.color = 'var(--muted)';
  status.textContent = `Converting ${file.name} locally…`;

  try {
    const started = performance.now();
    await new Promise(resolve => setTimeout(resolve, 0));
    const bytes = new Uint8Array(await file.arrayBuffer());
    const result = convertDocumentBytes(bytes, file.name);
    const elapsed = performance.now() - started;
    const stats = markdownStats(result.markdown);

    currentFile = file;
    output.value = result.markdown;
    copy.disabled = !result.markdown;
    save.disabled = !result.markdown;
    status.style.color = 'var(--green-dk)';
    status.textContent = `Converted ${file.name} → ${markdownFilename(file.name)}`;
    details.textContent = [
      String(result.format).toUpperCase(),
      fmtBytes(file.size),
      `${stats.words.toLocaleString()} words`,
      `${stats.lines.toLocaleString()} lines`,
      `${elapsed.toFixed(elapsed < 10 ? 1 : 0)} ms`,
    ].join(' · ');
  } catch (error) {
    status.style.color = 'var(--gold)';
    status.textContent = describeAnydocError(error);
    details.textContent = file.name;
  }
}

copy.addEventListener('click', async () => {
  if (!output.value) return;
  const ok = await copyText(output.value);
  copy.textContent = ok ? 'Copied' : 'Copy unavailable';
  setTimeout(() => { copy.textContent = 'Copy Markdown'; }, 1200);
});

save.addEventListener('click', () => {
  if (!currentFile || !output.value) return;
  download(output.value, markdownFilename(currentFile.name), 'text/markdown;charset=utf-8');
});

clear.addEventListener('click', reset);

root.append(
  dropzone(
    ACCEPT,
    '<strong>Drop a document here</strong><span>or choose Word, PowerPoint, spreadsheet, OpenDocument, RTF, EPUB, CSV or a text-based PDF</span>',
    handleFile,
  ),
  status,
  details,
  el('div', { style:{ marginTop:'1rem' } }, output),
  el('div', { class:'gs-toolbar', style:{ marginTop:'.65rem' } }, copy, save, clear),
  el('div', { class:'gs-warn', style:{ marginTop:'1rem' } },
    el('span', {}, 'Markdown is a structural text conversion, not a visual copy. Layout, page positioning and some embedded objects will not survive. Text-based PDFs convert locally; if a PDF contains scanned/image-only pages, Sets stops and identifies that OCR is needed rather than uploading the file.')),
);

reset();

try {
  prepareAnydoc();
} catch (error) {
  status.style.color = 'var(--gold)';
  status.textContent = `The local converter could not start: ${error.message}`;
}
