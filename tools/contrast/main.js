import { chrome, header, el, copyText } from '../../src/shell.js';
import {
  hexToRgb, rgbToHex, contrastRatio, textContrastThresholds,
  nearestContrastColour, parseHexColours, simulateColourVision,
} from '../../src/lib/colour.js';

const root = chrome('accessibility colour checker');
root.append(header('tool · accessibility', 'Accessibility colour checker',
  'Check text and interface contrast, audit a palette, explore focus indicators and preview common colour-vision deficiencies.'));

const state = { fg: '#2D3E50', bg: '#F5F0E8', fontSize: 16, bold: false };

root.append(el('div', { class: 'gs-assurance', style: { margin: '1rem 0' } },
  el('span', {}, 'Contrast results use WCAG 2.x ratios. Colour-vision previews are design aids, not compliance tests.')));

const pairCard = section('Text & interface contrast',
  'Test the actual size and weight you plan to use. The same pair may pass for large text but fail for normal body copy.');
const pairControls = el('div', { class: 'gs-two-col', style: { marginTop: '.8rem' } });
const colourControls = el('div', { style: { display: 'grid', gap: '.6rem' } });
const contextControls = el('div', { style: { display: 'grid', gap: '.6rem', alignContent: 'start' } });
pairControls.append(colourControls, contextControls);

function swatchRow(key, label) {
  const colour = el('input', { type: 'color', value: state[key], 'aria-label': `${label} colour`, style: { width: '52px', height: '42px', padding: '2px' } });
  const hex = el('input', { type: 'text', value: state[key], 'aria-label': `${label} hex colour`, spellcheck: false, style: { width: '130px' } });
  const error = el('span', { class: 'gs-mono', style: { fontSize: '.68rem', color: '#8A451F' }, 'aria-live': 'polite' });
  const row = el('div');
  row.append(el('label', { class: 'gs-label', for: `${key}-hex` }, label),
    el('div', { class: 'gs-toolbar', style: { marginTop: '.2rem' } }, colour, hex), error);
  hex.id = `${key}-hex`;
  const sync = value => {
    const rgb = hexToRgb(value);
    if (!rgb) { error.textContent = 'Enter a 3- or 6-digit hex colour.'; return false; }
    const normal = rgbToHex(rgb);
    error.textContent = '';
    state[key] = normal;
    colour.value = normal;
    hex.value = normal;
    updatePair();
    return true;
  };
  colour.addEventListener('input', () => sync(colour.value));
  hex.addEventListener('change', () => sync(hex.value));
  hex.addEventListener('keydown', e => { if (e.key === 'Enter') sync(hex.value); });
  colourControls.append(row);
  return { colour, hex, sync };
}

const fg = swatchRow('fg', 'text / foreground');
const bg = swatchRow('bg', 'background');

const sizeInput = el('input', { type: 'number', min: '8', max: '200', step: '1', value: state.fontSize, 'aria-label': 'Font size in pixels' });
sizeInput.addEventListener('input', () => { state.fontSize = Number(sizeInput.value) || 16; updatePair(); });
const boldInput = el('input', { type: 'checkbox', checked: state.bold, id: 'bold-text' });
boldInput.addEventListener('change', () => { state.bold = boldInput.checked; updatePair(); });
contextControls.append(
  labelledControl('Font size', sizeInput, 'px'),
  el('label', { class: 'gs-toolbar', for: 'bold-text' }, boldInput, el('span', {}, 'Bold text (700+)')),
  el('div', { class: 'gs-toolbar' },
    el('button', { class: 'gs-btn gs-btn-ghost', onclick: () => {
      const t = state.fg; state.fg = state.bg; state.bg = t;
      fg.sync(state.fg); bg.sync(state.bg);
    } }, '⇅ Swap colours'),
    el('button', { class: 'gs-btn gs-btn-ghost', onclick: copyCurrentCss }, 'Copy CSS')),
);

const pairResult = el('div', { style: { marginTop: '1rem' } });
pairCard.append(pairControls, pairResult);
root.append(pairCard);

const paletteCard = section('Palette audit',
  'Paste CSS, design tokens or a list of hex values. The audit checks every colour against a selected background and flags normal-text, large-text and UI contrast.');
const paletteInput = el('textarea', { rows: 7, spellcheck: false, 'aria-label': 'Palette CSS or hex colours' });
paletteInput.value = `--bg: #F5F0E8;\n--card: #FFFFFF;\n--navy: #2D3E50;\n--body: #526474;\n--muted: #5B6D7D;\n--green: #3F6855;\n--gold: #8C6815;`;
const paletteBg = el('input', { type: 'color', value: '#F5F0E8', 'aria-label': 'Palette audit background' });
const paletteBgHex = el('input', { type: 'text', value: '#F5F0E8', spellcheck: false, 'aria-label': 'Palette audit background hex', style: { width: '120px' } });
const paletteRun = el('button', { class: 'gs-btn gs-btn-primary', onclick: runPaletteAudit }, 'Audit palette');
const paletteResult = el('div', { style: { marginTop: '.8rem', overflowX: 'auto' }, 'aria-live': 'polite' });
paletteBg.addEventListener('input', () => { paletteBgHex.value = paletteBg.value.toUpperCase(); runPaletteAudit(); });
paletteBgHex.addEventListener('change', () => {
  const rgb = hexToRgb(paletteBgHex.value);
  if (rgb) { paletteBg.value = rgbToHex(rgb); paletteBgHex.value = rgbToHex(rgb); runPaletteAudit(); }
});
paletteCard.append(paletteInput,
  el('div', { class: 'gs-toolbar', style: { marginTop: '.65rem' } }, el('span', { class: 'gs-label' }, 'background'), paletteBg, paletteBgHex, paletteRun),
  paletteResult);
root.append(paletteCard);

const focusCard = section('Focus indicator contrast',
  'Separate WCAG 2.2 adjacent contrast (Non-text Contrast, AA) from the change between focused and unfocused pixels (Focus Appearance, AAA). This checks colour only; indicator area and geometry still need a visual review.');
const focusState = { ring: '#8C6815', surface: '#F5F0E8', component: '#FFFFFF', before: '#F5F0E8' };
const focusControls = el('div', { class: 'gs-toolbar', style: { marginTop: '.7rem' } });
const focusResult = el('div', { style: { marginTop: '.8rem' }, 'aria-live': 'polite' });
for (const [key, label] of [['ring', 'focus indicator'], ['surface', 'adjacent outside'], ['component', 'adjacent component'], ['before', 'same pixels before focus']]) {
  const inp = el('input', { type: 'color', value: focusState[key], 'aria-label': `${label} colour` });
  inp.addEventListener('input', () => { focusState[key] = inp.value; updateFocus(); });
  focusControls.append(el('label', { class: 'gs-toolbar' }, el('span', { class: 'gs-label' }, label), inp));
}
focusCard.append(focusControls, focusResult);
root.append(focusCard);

const visionCard = section('Colour-vision preview',
  'Preview this foreground/background pair under simplified protanopia, deuteranopia, tritanopia and greyscale transformations. Do not treat these previews as a diagnosis or WCAG result.');
const visionGrid = el('div', { style: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(180px,1fr))', gap: '.65rem', marginTop: '.8rem' } });
visionCard.append(visionGrid);
root.append(visionCard);

root.append(el('p', { class: 'gs-mono gs-muted', style: { fontSize: '.72rem', marginTop: '1.2rem' } },
  'WCAG “large text” is at least 24 CSS px regular, or about 18.7 CSS px bold. A 3:1 ratio is commonly required for meaningful UI component boundaries and graphical objects. Contrast alone does not establish full accessibility.'));

function section(title, intro) {
  return el('section', { class: 'gs-card', style: { marginTop: '1rem' } },
    el('h2', { style: { margin: '0 0 .25rem', fontSize: '1.3rem' } }, title),
    el('p', { style: { margin: 0, maxWidth: '720px' } }, intro));
}

function labelledControl(label, control, suffix = '') {
  return el('label', { class: 'gs-toolbar' }, el('span', { class: 'gs-label' }, label), control, suffix ? el('span', { class: 'gs-mono gs-muted', style: { fontSize: '.72rem' } }, suffix) : null);
}

function resultBadge(label, pass, detail = '') {
  return el('div', { class: 'gs-card', style: {
    borderLeftColor: pass ? 'var(--green)' : 'var(--gold)', padding: '.62rem .75rem', boxShadow: 'none',
    display: 'flex', justifyContent: 'space-between', gap: '.5rem', alignItems: 'center' } },
    el('span', {}, label, detail ? el('span', { class: 'gs-mono gs-muted', style: { display: 'block', fontSize: '.65rem' } }, detail) : null),
    el('span', { class: 'gs-pill', style: { background: pass ? 'var(--soft-green)' : 'var(--gold-bg)', color: 'var(--navy-deep)' } }, pass ? 'pass' : 'fail'));
}

function updatePair() {
  const foreground = hexToRgb(state.fg);
  const background = hexToRgb(state.bg);
  if (!foreground || !background) return;
  const ratio = contrastRatio(foreground, background);
  const thresholds = textContrastThresholds(state.fontSize, state.bold);
  const target = thresholds.aa;
  const suggested = nearestContrastColour(foreground, background, target);
  const suggestionHex = suggested ? rgbToHex(suggested) : null;
  const preview = el('div', { style: {
    background: state.bg, color: state.fg, borderRadius: 'var(--r)', border: '1px solid var(--border)',
    padding: '1.2rem', marginTop: '.8rem' } },
    el('div', { style: { fontFamily: 'var(--fh)', fontSize: `${Math.max(state.fontSize, 20)}px`, fontWeight: state.bold ? '700' : '400' } }, 'A readable heading'),
    el('div', { style: { fontSize: `${state.fontSize}px`, fontWeight: state.bold ? '700' : '400', marginTop: '.35rem' } }, 'The quick brown fox jumps over the lazy dog.'));

  const grid = el('div', { style: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(155px,1fr))', gap: '.55rem', marginTop: '.75rem' } },
    resultBadge(`Text · AA ${thresholds.aa}:1`, ratio >= thresholds.aa, thresholds.large ? 'large-text threshold' : 'normal-text threshold'),
    resultBadge(`Text · AAA ${thresholds.aaa}:1`, ratio >= thresholds.aaa),
    resultBadge('UI / graphics · 3:1', ratio >= 3, 'contrast-only check'));

  const summary = el('div', { class: 'gs-toolbar', style: { justifyContent: 'space-between' } },
    el('div', {}, el('div', { class: 'gs-mono', style: { fontSize: '1.7rem', color: 'var(--text)', lineHeight: 1 } }, `${ratio.toFixed(2)} : 1`),
      el('div', { class: 'gs-mono gs-muted', style: { fontSize: '.7rem', marginTop: '.25rem' } }, `${state.fontSize}px ${state.bold ? 'bold' : 'regular'} · ${thresholds.large ? 'large' : 'normal'} text`)));

  if (ratio < target && suggestionHex) {
    const suggestedRatio = contrastRatio(suggested, background);
    const use = el('button', { class: 'gs-btn gs-btn-ghost', onclick: () => fg.sync(suggestionHex) }, `Use ${suggestionHex}`);
    summary.append(el('div', { style: { textAlign: 'right' } },
      el('div', { class: 'gs-mono', style: { fontSize: '.72rem' } }, `Nearest AA suggestion · ${suggestedRatio.toFixed(2)}:1`), use));
  }
  pairResult.replaceChildren(summary, preview, grid);
  updateVision();
}

async function copyCurrentCss() {
  const ratio = contrastRatio(hexToRgb(state.fg), hexToRgb(state.bg));
  const text = `color: ${state.fg};\nbackground-color: ${state.bg};\n/* WCAG contrast ${ratio.toFixed(2)}:1 */`;
  await copyText(text);
}

function runPaletteAudit() {
  const colours = parseHexColours(paletteInput.value);
  const bgRgb = hexToRgb(paletteBgHex.value) || hexToRgb(paletteBg.value);
  if (!colours.length) {
    paletteResult.replaceChildren(el('div', { class: 'gs-warn' }, el('span', {}, 'No valid hex colours found.')));
    return;
  }
  const table = el('table', { style: { width: '100%' } });
  table.append(el('thead', {}, el('tr', {}, ...['Colour', 'Ratio', 'AA text', 'Large text', 'UI / graphics'].map(h => el('th', {}, h)))));
  const body = el('tbody');
  for (const hex of colours) {
    const ratio = contrastRatio(hexToRgb(hex), bgRgb);
    const swatch = el('span', { 'aria-hidden': 'true', style: { display: 'inline-block', width: '1.1rem', height: '1.1rem', borderRadius: '3px', background: hex, border: '1px solid var(--border)', verticalAlign: 'middle', marginRight: '.4rem' } });
    body.append(el('tr', {},
      el('td', {}, swatch, el('code', {}, hex)),
      el('td', { class: 'gs-mono' }, ratio.toFixed(2) + ':1'),
      statusCell(ratio >= 4.5), statusCell(ratio >= 3), statusCell(ratio >= 3)));
  }
  table.append(body);
  paletteResult.replaceChildren(
    el('p', { class: 'gs-mono gs-muted', style: { fontSize: '.7rem', margin: '0 0 .45rem' } }, `${colours.length} unique colour${colours.length === 1 ? '' : 's'} against ${rgbToHex(bgRgb)}`),
    table);
}

function statusCell(pass) {
  return el('td', {}, el('span', { class: 'gs-pill', style: { background: pass ? 'var(--soft-green)' : 'var(--gold-bg)', color: 'var(--navy-deep)' } }, pass ? 'pass' : 'fail'));
}

function updateFocus() {
  const ring = hexToRgb(focusState.ring);
  const surface = hexToRgb(focusState.surface);
  const component = hexToRgb(focusState.component);
  const before = hexToRgb(focusState.before);
  const againstSurface = contrastRatio(ring, surface);
  const againstComponent = contrastRatio(ring, component);
  const focusChange = contrastRatio(ring, before);
  const preview = el('div', { style: { background: focusState.surface, padding: '1.4rem', borderRadius: 'var(--r)', marginTop: '.5rem' } },
    el('button', { style: { background: focusState.component, color: '#1E2D3D', border: '1px solid #748596', borderRadius: '6px', padding: '.55rem .8rem', outline: `3px solid ${focusState.ring}`, outlineOffset: '3px' } }, 'Focused control'));
  focusResult.replaceChildren(preview,
    el('div', { style: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(180px,1fr))', gap: '.55rem', marginTop: '.75rem' } },
      resultBadge('AA · outside adjacent · 3:1', againstSurface >= 3, `${againstSurface.toFixed(2)}:1 · WCAG 1.4.11`),
      resultBadge('AA · component adjacent · 3:1', againstComponent >= 3, `${againstComponent.toFixed(2)}:1 · WCAG 1.4.11`),
      resultBadge('AAA · focused vs unfocused · 3:1', focusChange >= 3, `${focusChange.toFixed(2)}:1 · WCAG 2.4.13`)),
    el('p', { class: 'gs-mono gs-muted', style: { fontSize: '.67rem', margin: '.55rem 0 0' } },
      'For a simple outer outline, the “same pixels before focus” are often the surrounding background. Focus Appearance also has a minimum indicator-area requirement equivalent to a 2 CSS px perimeter, which this colour-only check does not measure.'));
}

function updateVision() {
  const foreground = hexToRgb(state.fg);
  const background = hexToRgb(state.bg);
  const modes = [['original', 'Original'], ['protanopia', 'Protanopia'], ['deuteranopia', 'Deuteranopia'], ['tritanopia', 'Tritanopia'], ['greyscale', 'Greyscale']];
  visionGrid.replaceChildren(...modes.map(([mode, label]) => {
    const f = mode === 'original' ? foreground : simulateColourVision(foreground, mode);
    const b = mode === 'original' ? background : simulateColourVision(background, mode);
    return el('div', { class: 'gs-card', style: { padding: '.75rem', boxShadow: 'none', borderLeftColor: rgbToHex(f) } },
      el('div', { class: 'gs-label', style: { marginBottom: '.35rem' } }, label),
      el('div', { style: { background: rgbToHex(b), color: rgbToHex(f), borderRadius: '6px', padding: '.8rem', border: '1px solid var(--border)' } }, 'Colour should not be the only signal.'),
      el('div', { class: 'gs-mono gs-muted', style: { fontSize: '.65rem', marginTop: '.35rem' } }, `${rgbToHex(f)} on ${rgbToHex(b)}`));
  }));
}

updatePair();
runPaletteAudit();
updateFocus();
