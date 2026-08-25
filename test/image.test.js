import test from 'node:test';
import assert from 'node:assert/strict';
import { batchImageSize, imageOutputExtension, imageOutputMime } from '../src/lib/image.js';

test('batch sizing fits the long edge while preserving aspect ratio', () => {
  assert.deepEqual(batchImageSize(4000, 3000, { maxEdge: 1600 }), {
    width: 1600, height: 1200, scaled: true,
  });
  assert.deepEqual(batchImageSize(1200, 1600, { maxEdge: 800 }), {
    width: 600, height: 800, scaled: true,
  });
});

test('batch sizing does not upscale unless explicitly allowed', () => {
  assert.deepEqual(batchImageSize(640, 480, { maxEdge: 1600 }), {
    width: 640, height: 480, scaled: false,
  });
  assert.deepEqual(batchImageSize(640, 480, { maxEdge: 1280, allowUpscale: true }), {
    width: 1280, height: 960, scaled: true,
  });
});

test('zero max edge preserves original dimensions', () => {
  assert.deepEqual(batchImageSize(1024, 768, { maxEdge: 0 }), {
    width: 1024, height: 768, scaled: false,
  });
});

test('unsafe output dimensions are rejected', () => {
  assert.throws(() => batchImageSize(20000, 1000, { maxEdge: 0 }), /exceed/);
  assert.throws(() => batchImageSize(10000, 10000, { maxEdge: 0 }), /megapixels/);
});

test('image output names and MIME types are explicit', () => {
  assert.equal(imageOutputExtension('jpeg'), 'jpg');
  assert.equal(imageOutputExtension('webp'), 'webp');
  assert.equal(imageOutputMime('png'), 'image/png');
  assert.throws(() => imageOutputMime('gif'), /Unsupported/);
});
