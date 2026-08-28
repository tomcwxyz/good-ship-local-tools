const ALPHANUMERIC = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
const MIN_BITS = 64;
const MAX_BITS = 4096;

export function normaliseBits(bits) {
  const value = Number(bits);
  if (!Number.isInteger(value) || value < MIN_BITS || value > MAX_BITS || value % 8 !== 0) {
    throw new RangeError(`Secret strength must be a whole multiple of 8 between ${MIN_BITS} and ${MAX_BITS} bits.`);
  }
  return value;
}

export function bytesForBits(bits) {
  return normaliseBits(bits) / 8;
}

export function alphanumericLengthForBits(bits) {
  return Math.ceil(normaliseBits(bits) / Math.log2(ALPHANUMERIC.length));
}

export function randomBytes(length, cryptoApi = globalThis.crypto) {
  if (!Number.isInteger(length) || length < 1 || length > MAX_BITS / 8) {
    throw new RangeError(`Byte length must be between 1 and ${MAX_BITS / 8}.`);
  }
  if (!cryptoApi?.getRandomValues) throw new Error('Secure random generation is not available in this browser context.');
  const bytes = new Uint8Array(length);
  cryptoApi.getRandomValues(bytes);
  return bytes;
}

export function bytesToHex(input) {
  return [...new Uint8Array(input.buffer ?? input, input.byteOffset ?? 0, input.byteLength ?? input.length)]
    .map(byte => byte.toString(16).padStart(2, '0'))
    .join('');
}

export function bytesToBase64(input) {
  const bytes = new Uint8Array(input.buffer ?? input, input.byteOffset ?? 0, input.byteLength ?? input.length);
  let binary = '';
  for (let offset = 0; offset < bytes.length; offset += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + 0x8000));
  }
  if (typeof globalThis.btoa !== 'function') throw new Error('Base64 encoding is not available in this browser context.');
  return globalThis.btoa(binary);
}

export function bytesToBase64Url(input) {
  return bytesToBase64(input).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/u, '');
}

export function randomAlphanumeric(bits, cryptoApi = globalThis.crypto) {
  const length = alphanumericLengthForBits(bits);
  const limit = 256 - (256 % ALPHANUMERIC.length);
  let output = '';
  while (output.length < length) {
    const bytes = randomBytes(Math.min(128, Math.max(16, (length - output.length) * 2)), cryptoApi);
    for (const byte of bytes) {
      if (byte >= limit) continue;
      output += ALPHANUMERIC[byte % ALPHANUMERIC.length];
      if (output.length === length) break;
    }
  }
  return output;
}

export function randomUuidV4(cryptoApi = globalThis.crypto) {
  const bytes = randomBytes(16, cryptoApi);
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = bytesToHex(bytes);
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

export function generateSecret({ format = 'base64url', bits = 256 } = {}, cryptoApi = globalThis.crypto) {
  if (format === 'uuid') return randomUuidV4(cryptoApi);
  if (format === 'alphanumeric') return randomAlphanumeric(bits, cryptoApi);
  const bytes = randomBytes(bytesForBits(bits), cryptoApi);
  if (format === 'hex') return bytesToHex(bytes);
  if (format === 'base64') return bytesToBase64(bytes);
  if (format === 'base64url') return bytesToBase64Url(bytes);
  throw new RangeError(`Unsupported secret format: ${format}`);
}

export function terminalCommand(format, bits = 256) {
  if (format === 'uuid') return `node -e "console.log(require('node:crypto').randomUUID())"`;
  const bytes = bytesForBits(bits);
  if (format === 'hex') return `openssl rand -hex ${bytes}`;
  if (format === 'base64') return `openssl rand -base64 ${bytes} | tr -d '\\n'`;
  if (format === 'base64url') return `node -e "console.log(require('node:crypto').randomBytes(${bytes}).toString('base64url'))"`;
  if (format === 'alphanumeric') {
    const length = alphanumericLengthForBits(bits);
    return `node -e "const {randomInt}=require('node:crypto'),a='${ALPHANUMERIC}';console.log(Array.from({length:${length}},()=>a[randomInt(a.length)]).join(''))"`;
  }
  throw new RangeError(`Unsupported secret format: ${format}`);
}

export function describeSecret(format, bits = 256) {
  if (format === 'uuid') return 'UUID v4 · 122 random bits';
  const normalised = normaliseBits(bits);
  if (format === 'alphanumeric') return `${alphanumericLengthForBits(normalised)} characters · at least ${normalised} bits of random choice space`;
  return `${normalised} bits · ${bytesForBits(normalised)} random bytes`;
}
