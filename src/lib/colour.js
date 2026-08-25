export function hexToRgb(value) {
  let h = String(value).replace('#', '').trim();
  if (h.length === 3) h = h.split('').map(c => c + c).join('');
  if (!/^[0-9a-fA-F]{6}$/.test(h)) return null;
  return [0, 2, 4].map(i => parseInt(h.slice(i, i + 2), 16));
}

export function rgbToHex(rgb) {
  if (!Array.isArray(rgb) || rgb.length !== 3 || rgb.some(v => !Number.isFinite(v))) return null;
  return '#' + rgb.map(v => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('').toUpperCase();
}

export function relativeLuminance([r, g, b]) {
  const linear = [r, g, b].map(v => {
    const s = v / 255;
    return s <= 0.04045 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * linear[0] + 0.7152 * linear[1] + 0.0722 * linear[2];
}

export function contrastRatio(a, b) {
  const l1 = relativeLuminance(a);
  const l2 = relativeLuminance(b);
  return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
}

export function isLargeText(fontSizePx, bold = false) {
  const size = Number(fontSizePx);
  return size >= 24 || (bold && size >= (14 * 96 / 72));
}

export function textContrastThresholds(fontSizePx = 16, bold = false) {
  const large = isLargeText(fontSizePx, bold);
  return { large, aa: large ? 3 : 4.5, aaa: large ? 4.5 : 7 };
}

function mixRgb(from, to, amount) {
  return from.map((v, i) => v + (to[i] - v) * amount);
}

// Find the smallest straight-line RGB adjustment towards black or white that
// reaches the requested contrast. This is deterministic and deliberately avoids
// claiming perceptual colour-distance accuracy.
export function nearestContrastColour(foreground, background, target = 4.5) {
  if (contrastRatio(foreground, background) >= target) return [...foreground];
  const endpoints = [[0, 0, 0], [255, 255, 255]];
  let best = null;

  for (const endpoint of endpoints) {
    if (contrastRatio(endpoint, background) < target) continue;
    let lo = 0;
    let hi = 1;
    for (let i = 0; i < 24; i++) {
      const mid = (lo + hi) / 2;
      const candidate = mixRgb(foreground, endpoint, mid);
      if (contrastRatio(candidate, background) >= target) hi = mid;
      else lo = mid;
    }
    const rgb = mixRgb(foreground, endpoint, hi);
    const distance = Math.sqrt(rgb.reduce((sum, v, i) => sum + Math.pow(v - foreground[i], 2), 0));
    if (!best || distance < best.distance) best = { rgb: rgb.map(Math.round), distance };
  }
  return best?.rgb || null;
}

export function parseHexColours(text) {
  const seen = new Set();
  const colours = [];
  const re = /#[0-9a-fA-F]{6}\b|#[0-9a-fA-F]{3}\b/g;
  for (const match of String(text).matchAll(re)) {
    const rgb = hexToRgb(match[0]);
    const hex = rgbToHex(rgb);
    if (hex && !seen.has(hex)) {
      seen.add(hex);
      colours.push(hex);
    }
  }
  return colours;
}

// Lightweight colour-vision deficiency previews. These matrices are useful for
// design exploration, not a clinical simulation and not a WCAG pass/fail test.
const CVD_MATRICES = {
  protanopia: [
    [0.567, 0.433, 0],
    [0.558, 0.442, 0],
    [0, 0.242, 0.758],
  ],
  deuteranopia: [
    [0.625, 0.375, 0],
    [0.7, 0.3, 0],
    [0, 0.3, 0.7],
  ],
  tritanopia: [
    [0.95, 0.05, 0],
    [0, 0.433, 0.567],
    [0, 0.475, 0.525],
  ],
};

export function simulateColourVision(rgb, mode) {
  if (mode === 'greyscale') {
    const y = 0.2126 * rgb[0] + 0.7152 * rgb[1] + 0.0722 * rgb[2];
    return [Math.round(y), Math.round(y), Math.round(y)];
  }
  const matrix = CVD_MATRICES[mode];
  if (!matrix) return [...rgb];
  return matrix.map(row => Math.max(0, Math.min(255, Math.round(row.reduce((sum, value, i) => sum + value * rgb[i], 0)))));
}
