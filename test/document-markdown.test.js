import test from 'node:test';
import assert from 'node:assert/strict';
import { describeAnydocError, markdownFilename, markdownStats, MAX_DOCUMENT_BYTES } from '../src/lib/document-markdown.js';

test('markdownFilename replaces the final extension only', () => {
  assert.equal(markdownFilename('annual.report.docx'), 'annual.report.md');
  assert.equal(markdownFilename('README'), 'README.md');
  assert.equal(markdownFilename(''), 'document.md');
});

test('markdownStats reports useful text counts', () => {
  assert.deepEqual(markdownStats('# Title\n\nTwo words'), {
    characters:18,
    lines:3,
    words:4,
  });
});

test('needsOcr errors explain the local-only boundary', () => {
  const message = describeAnydocError({
    code:'needsOcr',
    pages:[2, 5],
    pageCount:7,
  });
  assert.match(message, /Pages 2, 5 of 7 need OCR/u);
  assert.match(message, /will not upload/u);
});

test('known parser errors have user-facing explanations', () => {
  for (const code of ['encrypted', 'unsupported', 'malformed', 'resourceLimit', 'missingPart']) {
    assert.ok(describeAnydocError({ code }).length > 20);
  }
  assert.equal(MAX_DOCUMENT_BYTES, 60 * 1024 * 1024);
});
