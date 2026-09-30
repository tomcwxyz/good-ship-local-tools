import './style.css';
import { assurance, chrome, copyText, download, el, header } from '../../src/shell.js';
import { markdownStats, renderMarkdown } from '../../src/lib/markdown-preview.js';

const STARTER = `# Markdown editor

Write on the left and preview on the right.

## A useful little local editor

- **Bold**, *italic*, ~~strikethrough~~ and \`inline code\`
- [Links](https://example.com)
- Lists, quotes, tables and fenced code blocks
- Upload an existing Markdown or text file
- Download the edited document as a \`.md\` file

> Everything stays in your browser.
`;

const root = chrome('markdown editor');
root.append(
  header(
    'tool · text',
    'Markdown editor',
    'Open or write Markdown locally, edit it with a live preview, then download the result.',
  ),
  el('div', { style:{ margin:'1rem 0 1rem' } }, assurance(
    'Editing and preview happen entirely in this browser. Uploaded files are read locally and are not sent anywhere.',
  )),
);

let currentName = 'untitled.md';

const uploadInput = el('input', {
  type:'file',
  accept:'.md,.markdown,.mdown,.mkd,.txt,text/markdown,text/plain',
  class:'gs-visually-hidden',
  'aria-label':'Upload Markdown file',
});

const uploadButton = el('button', { class:'gs-btn gs-btn-ghost', type:'button' }, 'Upload');
const downloadButton = el('button', { class:'gs-btn gs-btn-primary', type:'button' }, 'Download .md');
const copyButton = el('button', { class:'gs-btn gs-btn-ghost', type:'button' }, 'Copy');
const newButton = el('button', { class:'gs-btn gs-btn-ghost', type:'button' }, 'New');

const filename = el('input', {
  type:'text',
  class:'md-file-name',
  value:currentName,
  'aria-label':'Download filename',
  spellcheck:false,
});

const stats = el('span', { class:'md-status', 'aria-live':'polite' });
const editor = el('textarea', {
  class:'md-editor',
  value:STARTER,
  spellcheck:true,
  'aria-label':'Markdown source',
  'aria-describedby':'markdown-stats',
});
const preview = el('article', {
  class:'md-preview',
  'aria-label':'Markdown preview',
  'aria-live':'polite',
});
stats.id = 'markdown-stats';

function normaliseFilename(value) {
  const trimmed = String(value || '').trim().replace(/[\\/:*?"<>|]+/g, '-');
  if (!trimmed) return 'untitled.md';
  return /\.md$/i.test(trimmed) ? trimmed : `${trimmed.replace(/\.[^.]+$/, '')}.md`;
}

function update() {
  const value = editor.value;
  preview.innerHTML = value.trim()
    ? renderMarkdown(value)
    : '<p class="md-empty">Your preview will appear here as you type.</p>';

  const s = markdownStats(value);
  stats.textContent = `${s.words.toLocaleString()} words · ${s.characters.toLocaleString()} characters · ${s.lines.toLocaleString()} lines`;
}

async function openFile(file) {
  if (!file) return;
  const maxBytes = 5 * 1024 * 1024;
  if (file.size > maxBytes) {
    stats.textContent = 'That file is over 5 MB. Choose a smaller Markdown or text file.';
    return;
  }
  const text = await file.text();
  editor.value = text.replace(/^\uFEFF/, '');
  currentName = normaliseFilename(file.name);
  filename.value = currentName;
  update();
  editor.focus();
}

uploadButton.addEventListener('click', () => uploadInput.click());
uploadInput.addEventListener('change', () => {
  if (uploadInput.files?.[0]) openFile(uploadInput.files[0]);
  uploadInput.value = '';
});

editor.addEventListener('dragover', event => {
  if (event.dataTransfer?.types?.includes('Files')) event.preventDefault();
});
editor.addEventListener('drop', event => {
  if (!event.dataTransfer?.files?.length) return;
  event.preventDefault();
  openFile(event.dataTransfer.files[0]);
});
editor.addEventListener('input', update);

filename.addEventListener('change', () => {
  currentName = normaliseFilename(filename.value);
  filename.value = currentName;
});

downloadButton.addEventListener('click', () => {
  currentName = normaliseFilename(filename.value);
  filename.value = currentName;
  download(editor.value, currentName, 'text/markdown;charset=utf-8');
});

copyButton.addEventListener('click', async () => {
  const ok = await copyText(editor.value);
  copyButton.textContent = ok ? 'Copied' : 'Copy unavailable';
  setTimeout(() => { copyButton.textContent = 'Copy'; }, 1200);
});

newButton.addEventListener('click', () => {
  editor.value = '';
  currentName = 'untitled.md';
  filename.value = currentName;
  update();
  editor.focus();
});

root.append(
  el('div', { class:'gs-toolbar' },
    uploadInput,
    uploadButton,
    downloadButton,
    copyButton,
    newButton,
    filename,
    stats,
  ),
  el('div', { class:'md-workspace' },
    el('section', { class:'md-pane', 'aria-label':'Editor pane' },
      el('div', { class:'md-pane-head' },
        el('span', {}, 'Markdown'),
        el('span', {}, 'live editing'),
      ),
      editor,
    ),
    el('section', { class:'md-pane', 'aria-label':'Preview pane' },
      el('div', { class:'md-pane-head' },
        el('span', {}, 'Preview'),
        el('span', {}, 'updates as you type'),
      ),
      preview,
    ),
  ),
);

update();
