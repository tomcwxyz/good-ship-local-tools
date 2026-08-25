import test from 'node:test';
import assert from 'node:assert/strict';
import { sha256Hex } from '../src/lib/digest.js';

test('SHA-256 helper matches the standard abc test vector', async () => {
  assert.equal(
    await sha256Hex('abc'),
    'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad',
  );
});

test('SHA-256 helper hashes typed-array bytes without changing them', async () => {
  const bytes = new Uint8Array([0, 1, 2, 3, 255]);
  assert.equal(
    await sha256Hex(bytes),
    'ff5d8507b6a72bee2debce2c0054798deaccdc5d8a1b945b6280ce8aa9cba52e',
  );
});
