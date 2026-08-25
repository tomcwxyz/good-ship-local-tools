import test from 'node:test';
import assert from 'node:assert/strict';
import {
  hexToRgb, rgbToHex, contrastRatio, isLargeText, textContrastThresholds,
  nearestContrastColour, parseHexColours, simulateColourVision,
} from '../src/lib/colour.js';

test('black on white has the WCAG maximum 21:1 contrast ratio', () => {
  assert.equal(contrastRatio(hexToRgb('#000'), hexToRgb('#fff')), 21);
});

test('hex parser accepts shorthand and rejects invalid input', () => {
  assert.deepEqual(hexToRgb('#abc'), [170, 187, 204]);
  assert.equal(hexToRgb('nope'), null);
  assert.equal(rgbToHex([170, 187, 204]), '#AABBCC');
});

test('large-text thresholds follow WCAG CSS pixel equivalents', () => {
  assert.equal(isLargeText(24, false), true);
  assert.equal(isLargeText(18.7, true), true);
  assert.equal(isLargeText(18, true), false);
  assert.deepEqual(textContrastThresholds(16, false), { large: false, aa: 4.5, aaa: 7 });
  assert.deepEqual(textContrastThresholds(24, false), { large: true, aa: 3, aaa: 4.5 });
});

test('nearest contrast suggestion reaches the requested ratio', () => {
  const bg = hexToRgb('#F5F0E8');
  const start = hexToRgb('#A98225');
  const suggested = nearestContrastColour(start, bg, 4.5);
  assert.ok(suggested);
  assert.ok(contrastRatio(suggested, bg) >= 4.5);
});

test('palette parser extracts unique normalised hex colours', () => {
  assert.deepEqual(parseHexColours('--a:#abc; --b: #AABBCC; --c:#123456;'), ['#AABBCC', '#123456']);
});

test('colour-vision preview keeps values in RGB range', () => {
  for (const mode of ['protanopia', 'deuteranopia', 'tritanopia', 'greyscale']) {
    const out = simulateColourVision([220, 30, 140], mode);
    assert.equal(out.length, 3);
    assert.ok(out.every(v => Number.isInteger(v) && v >= 0 && v <= 255));
  }
});
