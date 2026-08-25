import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { hexToRgb, contrastRatio } from '../src/lib/colour.js';

const css = readFileSync(new URL('../src/brand/brand.css', import.meta.url), 'utf8');
const token = name => {
  const match = css.match(new RegExp(`--${name}:\\s*(#[0-9A-Fa-f]{6})`));
  if (!match) throw new Error(`Missing --${name} token`);
  return match[1];
};

test('shared small-text colour tokens meet AA on cream and white', () => {
  const backgrounds = [token('bg'), token('card')].map(hexToRgb);
  for (const name of ['text', 'body', 'muted', 'green-dk', 'gold']) {
    for (const background of backgrounds) {
      assert.ok(contrastRatio(hexToRgb(token(name)), background) >= 4.5, `${name} should reach 4.5:1`);
    }
  }
});
