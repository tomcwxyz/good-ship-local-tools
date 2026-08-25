export function batchImageSize(width, height, {
  maxEdge = 0,
  allowUpscale = false,
  maxDimension = 16384,
  maxPixels = 80_000_000,
} = {}) {
  const sourceWidth = Math.round(Number(width));
  const sourceHeight = Math.round(Number(height));
  if (!(sourceWidth > 0) || !(sourceHeight > 0)) throw new Error('Image dimensions must be positive.');

  const requestedEdge = Math.max(0, Number(maxEdge) || 0);
  let scale = requestedEdge > 0 ? requestedEdge / Math.max(sourceWidth, sourceHeight) : 1;
  if (!allowUpscale) scale = Math.min(1, scale);

  const outputWidth = Math.max(1, Math.round(sourceWidth * scale));
  const outputHeight = Math.max(1, Math.round(sourceHeight * scale));
  if (outputWidth > maxDimension || outputHeight > maxDimension || outputWidth * outputHeight > maxPixels) {
    throw new Error(`Output would exceed ${maxDimension.toLocaleString()} px on one side or ${(maxPixels / 1_000_000).toFixed(0)} megapixels.`);
  }

  return {
    width: outputWidth,
    height: outputHeight,
    scaled: outputWidth !== sourceWidth || outputHeight !== sourceHeight,
  };
}

export function imageOutputExtension(format) {
  if (format === 'jpeg') return 'jpg';
  if (format === 'png' || format === 'webp') return format;
  throw new Error(`Unsupported image format: ${format}`);
}

export function imageOutputMime(format) {
  if (format === 'png') return 'image/png';
  if (format === 'jpeg') return 'image/jpeg';
  if (format === 'webp') return 'image/webp';
  throw new Error(`Unsupported image format: ${format}`);
}
