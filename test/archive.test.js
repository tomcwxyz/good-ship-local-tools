import test from 'node:test';
import assert from 'node:assert/strict';
import { uniqueArchiveName, selectBatchFiles } from '../src/lib/archive.js';

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


test('batch selection caps both file count and combined input size', () => {
  const files = [
    { name:'a.jpg', size:60 },
    { name:'b.jpg', size:60 },
    { name:'c.jpg', size:20 },
    { name:'d.jpg', size:10 },
  ];
  const bySize = selectBatchFiles(files, { maxFiles:10, maxTotalBytes:100 });
  assert.deepEqual(bySize.selected.map(f => f.name), ['a.jpg', 'c.jpg', 'd.jpg']);
  assert.deepEqual(bySize.skipped.map(f => f.name), ['b.jpg']);
  assert.equal(bySize.totalBytes, 90);

  const byCount = selectBatchFiles(files, { maxFiles:2, maxTotalBytes:1000 });
  assert.deepEqual(byCount.selected.map(f => f.name), ['a.jpg', 'b.jpg']);
  assert.equal(byCount.skipped.length, 2);
});
