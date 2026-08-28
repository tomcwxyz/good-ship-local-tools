import test from 'node:test';
import assert from 'node:assert/strict';
import {
  alphanumericLengthForBits,
  bytesForBits,
  bytesToBase64,
  bytesToBase64Url,
  bytesToHex,
  generateSecret,
  randomAlphanumeric,
  randomUuidV4,
  terminalCommand,
} from '../src/lib/secrets.js';

function deterministicCrypto(sequence = [0]) {
  let offset = 0;
  return {
    getRandomValues(bytes) {
      for (let i = 0; i < bytes.length; i += 1) bytes[i] = sequence[offset++ % sequence.length];
      return bytes;
    },
  };
}

test('byte and character sizing meets requested strength', () => {
  assert.equal(bytesForBits(256), 32);
  assert.equal(alphanumericLengthForBits(256), 43);
  assert.throws(() => bytesForBits(255), /multiple of 8/);
});

test('encoders match known bytes', () => {
  const bytes = Uint8Array.from([0xfb, 0xef, 0xff]);
  assert.equal(bytesToHex(bytes), 'fbefff');
  assert.equal(bytesToBase64(bytes), '++//');
  assert.equal(bytesToBase64Url(bytes), '--__');
});

test('hex generation uses the requested number of secure random bytes', () => {
  const cryptoApi = deterministicCrypto([0x00, 0x7f, 0xff]);
  const value = generateSecret({ format:'hex', bits:128 }, cryptoApi);
  assert.equal(value.length, 32);
  assert.match(value, /^[0-9a-f]+$/);
});

test('alphanumeric generation rejects biased byte values and reaches target length', () => {
  const value = randomAlphanumeric(128, deterministicCrypto([248, 249, 0, 1, 247]));
  assert.equal(value.length, 22);
  assert.match(value, /^[A-Za-z0-9]+$/);
});

test('UUID helper sets RFC 4122 version and variant bits', () => {
  const uuid = randomUuidV4(deterministicCrypto([0]));
  assert.equal(uuid, '00000000-0000-4000-8000-000000000000');
});

test('terminal command reflects format and byte length', () => {
  assert.equal(terminalCommand('hex', 256), 'openssl rand -hex 32');
  assert.match(terminalCommand('base64url', 256), /randomBytes\(32\)/);
  assert.match(terminalCommand('uuid'), /randomUUID/);
});
