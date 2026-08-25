export function clamp01(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return 0;
  return Math.min(1, Math.max(0, n));
}

export function normaliseRect(start, end, width, height) {
  if (!(width > 0) || !(height > 0)) throw new Error('Canvas dimensions must be positive.');
  const x1 = clamp01(Math.min(start.x, end.x) / width);
  const y1 = clamp01(Math.min(start.y, end.y) / height);
  const x2 = clamp01(Math.max(start.x, end.x) / width);
  const y2 = clamp01(Math.max(start.y, end.y) / height);
  return { x: x1, y: y1, w: Math.max(0, x2 - x1), h: Math.max(0, y2 - y1) };
}

export function percentRect(left, top, width, height) {
  const x = clamp01(Number(left) / 100);
  const y = clamp01(Number(top) / 100);
  const requestedW = Math.max(0, Number(width) / 100 || 0);
  const requestedH = Math.max(0, Number(height) / 100 || 0);
  return {
    x,
    y,
    w: Math.min(requestedW, 1 - x),
    h: Math.min(requestedH, 1 - y),
  };
}

export function pixelRect(rect, width, height) {
  return {
    x: rect.x * width,
    y: rect.y * height,
    w: rect.w * width,
    h: rect.h * height,
  };
}

export function usableRect(rect, minNormalisedSize = 0.002) {
  return Boolean(rect && rect.w >= minNormalisedSize && rect.h >= minNormalisedSize);
}
