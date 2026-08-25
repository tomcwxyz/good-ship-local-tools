import test from 'node:test';
import assert from 'node:assert/strict';
import { processJPEG, processPNG } from '../src/lib/metadata.js';

const segment = (marker, payload = []) => {
  const len = payload.length + 2;
  return [0xff, marker, len >> 8, len & 0xff, ...payload];
};

test('JPEG strips EXIF/comments but preserves ICC and Adobe markers', () => {
  const jpeg = new Uint8Array([
    0xff,0xd8,
    ...segment(0xe2, [0x49,0x43,0x43]),
    ...segment(0xe1, [0x45,0x78,0x69,0x66,0,0]),
    ...segment(0xee, [0x41,0x64,0x6f,0x62,0x65]),
    ...segment(0xfe, [0x68,0x69]),
    0xff,0xda,0,2, 0xff,0xd9,
  ]);
  const out = processJPEG(jpeg.buffer);
  assert.equal(out.removed.length, 2);
  assert.match(out.removed[0].type, /APP1/);
  assert.match(out.removed[1].type, /Comment/);
  const hex = Buffer.from(out.bytes).toString('hex');
  assert.match(hex, /ffe2/);
  assert.match(hex, /ffee/);
  assert.doesNotMatch(hex, /ffe1/);
  assert.doesNotMatch(hex, /fffe/);
});

test('PNG strips textual metadata and preserves colour profile chunks', () => {
  const chunk = (type, payload = []) => {
    const len = payload.length;
    const t = [...type].map(c => c.charCodeAt(0));
    return [0,0,0,len, ...t, ...payload, 0,0,0,0]; // CRC is not validated by the stripper
  };
  const png = new Uint8Array([
    137,80,78,71,13,10,26,10,
    ...chunk('IHDR', new Array(13).fill(0)),
    ...chunk('iCCP', [1,2,3]),
    ...chunk('tEXt', [65,0,66]),
    ...chunk('IEND'),
  ]);
  const out = processPNG(png.buffer);
  assert.equal(out.removed.length, 1);
  assert.match(Buffer.from(out.bytes).toString('latin1'), /iCCP/);
  assert.doesNotMatch(Buffer.from(out.bytes).toString('latin1'), /tEXt/);
});
