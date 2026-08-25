import { chrome, header, assurance, dropzone, download, fmtBytes, baseName, el } from '../../src/shell.js';
import { unzipSync, zipSync } from 'fflate';
import { inspectZipCentralDirectory, inspectOfficePackage, cleanOfficePackage, detectOfficeKind } from '../../src/lib/ooxml.js';
import { createInspectionReport, createInspectionSource, inspectionReportFilename, inspectionReportJson } from '../../src/lib/report.js';
import { sha256Hex } from '../../src/lib/digest.js';

const root = chrome('office privacy inspector');
let view;
function render(node) { if (view) view.remove(); view = node; root.append(node); }

const accept = '.docx,.xlsx,.pptx,.docm,.xlsm,.pptm,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.openxmlformats-officedocument.presentationml.presentation';

function start() {
  const box = el('div');
  box.append(
    header('tool · privacy', 'Office privacy inspector',
      'Inspect Word, Excel and PowerPoint files for personal properties and other things worth checking before you share them.'),
    el('div', { style:{ margin:'1rem 0 .75rem' } }, assurance()),
    el('div', { class:'gs-warn', style:{ marginBottom:'1rem' } },
      el('span', {}, 'Cleaning here is deliberately narrow: it removes selected document properties and thumbnails. It does not accept tracked changes, delete comments, remove notes, macros, embedded files or external links.')),
    dropzone(accept,
      '<div style="font-family:var(--fh);color:var(--text);font-size:1.1rem;margin-bottom:.25rem">Drop an Office file, or click to choose</div>' +
      '<div class="gs-mono" style="font-size:.75rem;color:var(--muted)">DOCX · XLSX · PPTX · macro-enabled OOXML</div>', handle),
  );
  render(box);
}

async function handle(file) {
  try {
    const bytes = new Uint8Array(await file.arrayBuffer());
    if (bytes.length > 128 * 1024 * 1024) throw new Error('Files over 128 MB are not opened by this tool.');
    const zipInfo = inspectZipCentralDirectory(bytes);
    const files = unzipSync(bytes);
    const kind = detectOfficeKind(files);
    if (!kind || !files['[Content_Types].xml']) throw new Error('This ZIP does not look like a supported Word, Excel or PowerPoint OOXML file.');
    const inspection = inspectOfficePackage(files);
    showResult(file, bytes, files, zipInfo, kind, inspection);
  } catch (err) {
    showError(err?.message || String(err));
  }
}

function row(label, value, { sensitive = false } = {}) {
  return el('div', { style:{ display:'grid', gridTemplateColumns:'minmax(120px,.8fr) minmax(0,1.4fr)', gap:'.75rem', padding:'.42rem 0', borderBottom:'1px solid var(--border)', fontSize:'.84rem' } },
    el('span', { class:'gs-mono gs-muted', style:{ fontSize:'.72rem' } }, label),
    el('span', { style:{ overflowWrap:'anywhere', fontWeight:sensitive ? '650' : '400' } }, value || '—'));
}

function section(title, rows, emptyText = 'Nothing found.') {
  const card = el('section', { class:'gs-card' });
  card.append(el('div', { class:'gs-label', style:{ marginBottom:'.5rem' } }, title));
  if (!rows.length) card.append(el('div', { class:'gs-muted', style:{ fontSize:'.84rem' } }, emptyText));
  else rows.forEach(r => card.append(r));
  return card;
}

function signal(label, count, explanation, tone = 'normal') {
  const found = typeof count === 'boolean' ? count : count > 0;
  const display = typeof count === 'boolean' ? (count ? 'found' : 'none') : String(count);
  const item = el('div', { style:{ padding:'.55rem 0', borderBottom:'1px solid var(--border)' } });
  item.append(
    el('div', { style:{ display:'flex', justifyContent:'space-between', gap:'.8rem', alignItems:'baseline' } },
      el('strong', { style:{ fontSize:'.86rem' } }, label),
      el('span', { class:'gs-mono', style:{ fontSize:'.72rem', color: found && tone === 'warn' ? 'var(--gold)' : 'var(--muted)' } }, display)),
    el('div', { class:'gs-muted', style:{ fontSize:'.76rem', marginTop:'.18rem' } }, explanation));
  return item;
}

function showResult(file, original, files, zipInfo, kind, r) {
  let lastCleaning = null;
  const wrap = el('div', { style:{ display:'flex', flexDirection:'column', gap:'1rem' } });
  const intro = el('div', { class:'gs-card' });
  intro.append(
    el('div', { style:{ display:'flex', justifyContent:'space-between', gap:'1rem', flexWrap:'wrap' } },
      el('div', {}, el('div', { class:'gs-mono', style:{ fontSize:'.78rem' } }, file.name), el('div', { class:'gs-muted', style:{ fontSize:'.8rem', marginTop:'.2rem' } }, kind)),
      el('div', { class:'gs-mono gs-muted', style:{ fontSize:'.72rem', textAlign:'right' } }, `${fmtBytes(original.length)} · ${zipInfo.entries} internal files · ${fmtBytes(zipInfo.totalUncompressed)} expanded`)),
  );

  const propertyRows = [];
  const labels = { title:'Title', subject:'Subject', creator:'Author / creator', keywords:'Keywords', description:'Description', lastModifiedBy:'Last modified by', revision:'Revision', created:'Created', modified:'Modified', category:'Category', contentStatus:'Content status' };
  for (const [key, value] of Object.entries(r.core)) propertyRows.push(row(labels[key] || key, value, { sensitive:['creator','lastModifiedBy'].includes(key) }));
  for (const [key, value] of Object.entries(r.app)) propertyRows.push(row(key, value, { sensitive:['Company','Manager'].includes(key) }));
  for (const p of r.custom) propertyRows.push(row(`Custom · ${p.name}`, p.value, { sensitive:true }));

  const risks = section('content signals — inspect manually', [
    signal('Comments', r.signals.comments, 'Comments can contain names, discussion and text that is not obvious in the final layout.', 'warn'),
    signal('Tracked changes', r.signals.trackedChanges, 'Tracked insertions/deletions are document content. This tool never accepts or removes them for you.', 'warn'),
    signal('Presentation notes', r.signals.notes, 'Speaker notes may contain material you did not intend to publish.', 'warn'),
    signal('Hidden sheets', r.signals.hiddenSheets, 'Hidden and very-hidden Excel sheets remain part of the workbook.', 'warn'),
    signal('Macros', r.signals.macros, 'Macro code is preserved. Review it separately before sharing macro-enabled files.', 'warn'),
    signal('Embedded files', r.signals.embeddedFiles, 'Embedded objects/files are preserved and may contain their own metadata.', 'warn'),
    signal('External links', r.signals.externalLinks, 'External relationships can reveal internal systems or fetch remote resources when opened.', 'warn'),
    signal('Document thumbnail', r.signals.thumbnail, 'Office may store a preview image separately from the visible document.', 'warn'),
  ]);

  const options = el('section', { class:'gs-card' });
  options.append(el('div', { class:'gs-label', style:{ marginBottom:'.6rem' } }, 'cleaning options'));
  const controls = [
    ['personal', 'Remove author/editor, revision and created/modified properties', true],
    ['descriptive', 'Remove title, subject, description, keywords and category/status properties', false],
    ['company', 'Remove company, manager and template properties', true],
    ['custom', 'Clear custom document properties', true],
    ['thumbnail', 'Remove embedded document thumbnail', true],
  ];
  const inputs = {};
  for (const [id, label, checked] of controls) {
    const input = el('input', { type:'checkbox', id:`office-${id}`, checked });
    inputs[id] = input;
    options.append(el('label', { for:`office-${id}`, style:{ display:'flex', gap:'.55rem', alignItems:'flex-start', padding:'.35rem 0', fontSize:'.84rem', cursor:'pointer' } }, input, el('span', {}, label)));
  }
  options.append(el('p', { class:'gs-muted', style:{ fontSize:'.76rem', marginBottom:0 } }, 'Titles, subjects, descriptions, keywords and visible document content are left alone by default. The cleaned file is rebuilt as a new OOXML ZIP package.'));

  const selectedCleaning = () => ({
    personal: inputs.personal.checked,
    descriptive: inputs.descriptive.checked,
    company: inputs.company.checked,
    custom: inputs.custom.checked,
    thumbnail: inputs.thumbnail.checked,
  });

  const status = el('div', { class:'gs-mono gs-muted', style:{ fontSize:'.75rem' }, 'aria-live':'polite' });
  const clean = el('button', { class:'gs-btn gs-btn-primary', onclick:() => {
    try {
      status.textContent = 'Building cleaned copy…';
      const selected = selectedCleaning();
      const cleaned = cleanOfficePackage(files, {
        removeCore: selected.personal,
        removeDescriptive: selected.descriptive,
        removeCompany: selected.company,
        removeCustom: selected.custom,
        removeThumbnail: selected.thumbnail,
      });
      if (!cleaned.changed.length) { status.textContent = 'Nothing selected was present in this file.'; return; }
      const zipped = zipSync(cleaned.files, { level: 6 });
      download(zipped, `${baseName(file.name)}-clean${file.name.slice(baseName(file.name).length)}`, file.type || 'application/octet-stream');
      lastCleaning = { changed: [...cleaned.changed] };
      status.textContent = `Cleaned copy created · ${cleaned.changed.join(' · ')}`;
    } catch (err) {
      status.textContent = 'Could not build cleaned copy: ' + err.message;
    }
  } }, 'Clean selected properties & download');
  const includeSourceName = el('input', { type:'checkbox', id:'office-report-name' });
  const includeValues = el('input', { type:'checkbox', id:'office-report-values' });
  const reportStatus = el('span', { class:'gs-mono gs-muted', style:{ fontSize:'.72rem' }, 'aria-live':'polite' });
  const report = el('button', { class:'gs-btn gs-btn-ghost', onclick:async () => {
    report.disabled = true;
    reportStatus.textContent = 'Hashing source and building report…';
    try {
      let sha256 = null;
      try { sha256 = await sha256Hex(original); } catch { /* report still works if Web Crypto is unavailable */ }
      const propertyFields = {
        core: Object.keys(r.core),
        application: Object.keys(r.app),
        customCount: r.custom.length,
      };
      const payload = createInspectionReport({
        tool: 'office-privacy-inspector',
        source: createInspectionSource({
          name: file.name,
          includeName: includeSourceName.checked,
          sha256,
          size: original.length,
          mediaType: file.type || null,
          officeKind: kind,
          internalFiles: zipInfo.entries,
          expandedBytes: zipInfo.totalUncompressed,
        }),
        findings: { propertyFields, signals: r.signals },
        details: { properties: { core:r.core, application:r.app, custom:r.custom } },
        includeDetails: includeValues.checked,
        cleaning: { selected:selectedCleaning(), completed:lastCleaning },
        limitations: [
          'Comments, tracked changes, notes, macros, embedded files and external links are reported but not removed by metadata cleaning.',
          'This report does not include visible document content.',
          ...(sha256 ? [] : ['A SHA-256 source fingerprint was unavailable in this browser context.']),
        ],
      });
      download(inspectionReportJson(payload), inspectionReportFilename({
        sha256,
        name: baseName(file.name),
        includeName: includeSourceName.checked,
      }), 'application/json;charset=utf-8');
      const disclosure = includeValues.checked || includeSourceName.checked ? 'Identified report' : 'Summary report';
      reportStatus.textContent = `${disclosure} downloaded.`;
    } catch (err) {
      reportStatus.textContent = 'Could not build report: ' + err.message;
    } finally {
      report.disabled = false;
    }
  } }, 'Download inspection report');
  const reportCard = el('section', { class:'gs-card' },
    el('div', { class:'gs-label', style:{ marginBottom:'.45rem' } }, 'inspection report'),
    el('p', { class:'gs-muted', style:{ fontSize:'.78rem', marginTop:0 } }, 'Summary reports use a SHA-256 source fingerprint, file size/type, metadata field categories and feature counts. They omit the original filename and metadata values by default.'),
    el('label', { for:'office-report-name', style:{ display:'flex', gap:'.5rem', alignItems:'flex-start', fontSize:'.8rem', cursor:'pointer', marginBottom:'.45rem' } }, includeSourceName,
      el('span', {}, el('strong', {}, 'Include source filename'), ' — filenames can themselves contain names, case references or other sensitive information.')),
    el('label', { for:'office-report-values', style:{ display:'flex', gap:'.5rem', alignItems:'flex-start', fontSize:'.8rem', cursor:'pointer' } }, includeValues,
      el('span', {}, el('strong', {}, 'Include metadata values'), ' — this can put names, titles, custom-property names and other personal details into the report itself.')),
    el('div', { class:'gs-toolbar', style:{ marginTop:'.65rem' } }, report, reportStatus));
  const again = el('button', { class:'gs-btn gs-btn-ghost', onclick:start }, 'Another file');

  wrap.append(intro, section('document properties', propertyRows, 'No common document properties were found.'), risks, options, reportCard,
    el('div', { style:{ display:'flex', gap:'.6rem', flexWrap:'wrap', alignItems:'center' } }, clean, again), status);
  render(wrap);
}

function showError(message) {
  const box = el('div', { class:'gs-warn' }, el('div', {}, el('strong', {}, 'Could not inspect this file. '), message),
    el('button', { class:'gs-btn gs-btn-ghost', style:{ marginTop:'.75rem' }, onclick:start }, 'Try another file'));
  render(box);
}

start();
