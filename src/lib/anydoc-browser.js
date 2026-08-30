import { initSync, formatFromBytes, formatFromPath, toMarkdownBytes } from '@firecrawl/anydoc-wasm';
import wasmDataUrl from '../../.cache/anydoc/anydoc_wasm_bg.wasm?inline';

let initialised = false;

function decodeDataUrl(dataUrl) {
  const value = String(dataUrl || '');
  const comma = value.indexOf(',');
  if (!value.startsWith('data:') || comma < 0) {
    throw new Error('The local document converter was not bundled as an inline WebAssembly asset.');
  }

  const metadata = value.slice(5, comma);
  const payload = value.slice(comma + 1);
  if (!metadata.includes(';base64')) {
    const decoded = decodeURIComponent(payload);
    return new TextEncoder().encode(decoded);
  }

  const binary = atob(payload);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
}

export function prepareAnydoc() {
  if (initialised) return;
  const module = decodeDataUrl(wasmDataUrl);
  initSync({ module });
  initialised = true;
}

export function convertDocumentBytes(bytes, filename = '') {
  prepareAnydoc();
  const input = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  const detectedFormat = formatFromBytes(input);
  const namedFormat = formatFromPath(filename);
  const format = detectedFormat ?? namedFormat;
  const markdown = toMarkdownBytes(input, format ?? undefined);
  return {
    markdown,
    format:format ?? 'unknown',
    detectedFormat:detectedFormat ?? null,
    namedFormat:namedFormat ?? null,
  };
}
