import test from 'node:test';
import assert from 'node:assert/strict';
import { uniqueArchiveName } from '../src/lib/archive.js';

test('archive names strip paths and control characters', () => {
  const used = new Set();
  assert.equal(uniqueArchiveName('../../private/photo.jpg', used), 'photo.jpg');
  assert.equal(uniqueArchiveName('folder\\report\u0000.png', used), 'report_.png');
});

test('archive names avoid case-insensitive collisions without dropping extensions', () => {
  const used = new Set();
  assert.equal(uniqueArchiveName('photo-clean.jpg', used), 'photo-clean.jpg');
  assert.equal(uniqueArchiveName('PHOTO-CLEAN.JPG', used), 'PHOTO-CLEAN (2).JPG');
  assert.equal(uniqueArchiveName('photo-clean.jpg', used), 'photo-clean (3).jpg');
});
