import test from 'node:test';
import assert from 'node:assert/strict';
import { fitRect, normaliseCrop, pageNumberText, pageSize, parsePageSelection } from '../src/lib/pdfworkbench.js';

test('A4 landscape swaps portrait dimensions', () => {
  assert.deepEqual(pageSize('a4', 'landscape'), [841.89, 595.28]);
});

test('fitRect preserves aspect ratio inside margins', () => {
  const fitted = fitRect(1600, 900, 600, 800, 20);
  assert.equal(Math.round(fitted.width / fitted.height * 1000), Math.round(1600 / 900 * 1000));
  assert(fitted.width <= 560 && fitted.height <= 760);
});

test('crop margins are clamped to leave a positive page area', () => {
  const crop = normaliseCrop({ left:90, right:90, top:50, bottom:50 }, 100, 100);
  assert(crop.width > 0);
  assert(crop.height > 0);
});

test('page numbering supports start values and templates', () => {
  assert.equal(pageNumberText({ index:2, total:8, start:10 }), 'Page 12 of 8');
  assert.equal(pageNumberText({ index:0, total:3, template:'{n}/{total}' }), '1/3');
});

test('page range parser handles reversed ranges and ignores out-of-range pages', () => {
  assert.deepEqual([...parsePageSelection('3-1, 5, 99', 5)].sort((a,b) => a-b), [0,1,2,4]);
});
