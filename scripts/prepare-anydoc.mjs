import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const ANYDOC_WASM_VERSION = '0.2.4';
export const ANYDOC_WASM_URL =
  'https://cdn.jsdelivr.net/npm/@firecrawl/anydoc-wasm@0.2.4/anydoc_wasm_bg.wasm';
export const ANYDOC_WASM_PATH = resolve('src/vendor/anydoc_wasm_bg.wasm');

// Filled after the first CI fetch, then enforced on every build.
export const ANYDOC_WASM_SHA256 = '9f37cd53b17bf4028ac5ae6a2ac4cf625e9c53be511797168780bab495de1a9e';

function digest(bytes) {
  return createHash('sha256').update(bytes).digest('hex');
}

function assertWasm(bytes) {
  if (bytes.length !== 6691779) {
    throw new Error(`Anydoc WASM size mismatch: expected 6691779 bytes, got ${bytes.length}.`);
  }
  if (bytes[0] !== 0x00 || bytes[1] !== 0x61 || bytes[2] !== 0x73 || bytes[3] !== 0x6d) {
    throw new Error('Anydoc WASM download does not start with the WebAssembly magic bytes.');
  }
  const sha256 = digest(bytes);
  if (ANYDOC_WASM_SHA256 && sha256 !== ANYDOC_WASM_SHA256) {
    throw new Error(`Anydoc WASM SHA-256 mismatch: expected ${ANYDOC_WASM_SHA256}, got ${sha256}.`);
  }
  return sha256;
}

export async function ensureAnydocWasm() {
  try {
    const existing = await readFile(ANYDOC_WASM_PATH);
    const sha256 = assertWasm(existing);
    console.log(`Anydoc WASM ready · ${existing.length} bytes · sha256:${sha256}`);
    return;
  } catch (error) {
    if (error?.code !== 'ENOENT') {
      if (ANYDOC_WASM_SHA256) throw error;
    }
  }

  const response = await fetch(ANYDOC_WASM_URL);
  if (!response.ok) {
    throw new Error(`Could not fetch pinned Anydoc WASM: HTTP ${response.status} ${response.statusText}`);
  }
  const bytes = Buffer.from(await response.arrayBuffer());
  const sha256 = assertWasm(bytes);
  await mkdir(dirname(ANYDOC_WASM_PATH), { recursive:true });
  await writeFile(ANYDOC_WASM_PATH, bytes);
  console.log(`Fetched Anydoc WASM ${ANYDOC_WASM_VERSION} · ${bytes.length} bytes · sha256:${sha256}`);
}

const invokedPath = process.argv[1] ? resolve(process.argv[1]) : '';
if (invokedPath && fileURLToPath(import.meta.url) === invokedPath) {
  await ensureAnydocWasm();
}
