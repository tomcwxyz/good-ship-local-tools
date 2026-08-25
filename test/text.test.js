import test from 'node:test';
import assert from 'node:assert/strict';
import { decodeTextBuffer } from '../src/lib/text.js';

test('auto-detects UTF-8', () => {
  const buf = new TextEncoder().encode('name\nCafé').buffer;
  const out = decodeTextBuffer(buf);
  assert.equal(out.encoding, 'utf-8');
  assert.match(out.text, /Café/);
});

test('falls back to Windows-1252 for common legacy CSV text', () => {
  const buf = Uint8Array.from([0x6e,0x61,0x6d,0x65,0x0a,0x93,0x48,0x69,0x94]).buffer;
  const out = decodeTextBuffer(buf);
  assert.equal(out.encoding, 'windows-1252');
  assert.equal(out.text, 'name\n“Hi”');
});
