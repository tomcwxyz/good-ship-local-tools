import test from 'node:test';
import assert from 'node:assert/strict';
import { normaliseRect, percentRect, pixelRect, usableRect } from '../src/lib/redaction.js';

test('pointer rectangles are stored normalised regardless of canvas resolution', () => {
  const rect = normaliseRect({ x: 200, y: 300 }, { x: 100, y: 100 }, 1000, 800);
  assert.deepEqual(rect, { x: 0.1, y: 0.125, w: 0.1, h: 0.25 });
  assert.deepEqual(pixelRect(rect, 2000, 1600), { x: 200, y: 200, w: 200, h: 400 });
});

test('percentage rectangles are clamped inside a page', () => {
  const clamped = percentRect(90, 95, 30, 20);
  assert.equal(clamped.x, 0.9);
  assert.equal(clamped.y, 0.95);
  assert.ok(Math.abs(clamped.w - 0.1) < 1e-12);
  assert.ok(Math.abs(clamped.h - 0.05) < 1e-12);
  assert.deepEqual(percentRect(-10, -20, 25, 30), { x: 0, y: 0, w: 0.25, h: 0.3 });
});

test('tiny accidental drags can be ignored', () => {
  assert.equal(usableRect({ x: 0, y: 0, w: 0.1, h: 0.1 }), true);
  assert.equal(usableRect({ x: 0, y: 0, w: 0.001, h: 0.1 }), false);
});
