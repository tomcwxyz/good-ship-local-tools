function digestInput(value) {
  if (typeof value === 'string') return new TextEncoder().encode(value);
  if (value instanceof ArrayBuffer) return value;
  if (ArrayBuffer.isView(value)) return value;
  throw new TypeError('SHA-256 input must be text, an ArrayBuffer, or an ArrayBuffer view.');
}

export async function sha256Hex(value) {
  if (!globalThis.crypto?.subtle) throw new Error('SHA-256 is not available in this browser context.');
  const digest = await globalThis.crypto.subtle.digest('SHA-256', digestInput(value));
  return [...new Uint8Array(digest)].map(byte => byte.toString(16).padStart(2, '0')).join('');
}
