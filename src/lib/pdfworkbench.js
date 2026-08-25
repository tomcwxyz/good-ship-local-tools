export const PAGE_SIZES = {
  a4: [595.28, 841.89],
  letter: [612, 792],
};

export function pageSize(name = 'a4', orientation = 'portrait') {
  const base = PAGE_SIZES[name] || PAGE_SIZES.a4;
  return orientation === 'landscape' ? [base[1], base[0]] : [...base];
}

export function fitRect(sourceWidth, sourceHeight, targetWidth, targetHeight, margin = 0) {
  const sw = Math.max(1, Number(sourceWidth) || 1);
  const sh = Math.max(1, Number(sourceHeight) || 1);
  const tw = Math.max(1, (Number(targetWidth) || 1) - margin * 2);
  const th = Math.max(1, (Number(targetHeight) || 1) - margin * 2);
  const scale = Math.min(tw / sw, th / sh);
  const width = sw * scale;
  const height = sh * scale;
  return {
    x: margin + (tw - width) / 2,
    y: margin + (th - height) / 2,
    width,
    height,
    scale,
  };
}

export function normaliseCrop(crop = {}, width, height) {
  const w = Math.max(1, Number(width) || 1);
  const h = Math.max(1, Number(height) || 1);
  const limitX = Math.max(0, w / 2 - 1);
  const limitY = Math.max(0, h / 2 - 1);
  const left = clamp(crop.left, 0, limitX);
  const right = clamp(crop.right, 0, Math.max(0, w - left - 1));
  const bottom = clamp(crop.bottom, 0, limitY);
  const top = clamp(crop.top, 0, Math.max(0, h - bottom - 1));
  return { left, right, top, bottom, x: left, y: bottom, width: w - left - right, height: h - top - bottom };
}

function clamp(value, min, max) {
  const n = Number(value) || 0;
  return Math.min(max, Math.max(min, n));
}

export function pageNumberText({ index, total, start = 1, template = 'Page {n} of {total}' }) {
  const n = Number(start) + Number(index);
  return String(template || '{n}')
    .replaceAll('{n}', String(n))
    .replaceAll('{total}', String(total));
}

export function parsePageSelection(text, total) {
  const max = Math.max(0, Number(total) || 0);
  const selected = new Set();
  const source = String(text ?? '').trim();
  if (!source) return selected;
  for (const token of source.split(',')) {
    const part = token.trim();
    if (!part) continue;
    const range = /^(\d+)\s*-\s*(\d+)$/.exec(part);
    if (range) {
      let a = Number(range[1]), b = Number(range[2]);
      if (a > b) [a, b] = [b, a];
      for (let n = a; n <= b; n++) if (n >= 1 && n <= max) selected.add(n - 1);
      continue;
    }
    if (/^\d+$/.test(part)) {
      const n = Number(part);
      if (n >= 1 && n <= max) selected.add(n - 1);
    }
  }
  return selected;
}
