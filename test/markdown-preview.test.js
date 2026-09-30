import test from 'node:test';
import assert from 'node:assert/strict';
import { markdownStats, renderMarkdown } from '../src/lib/markdown-preview.js';

test('renders common markdown blocks and inline formatting', () => {
  const html = renderMarkdown('# Hello\n\n**Bold** and *italic*.\n\n- one\n- two');
  assert.match(html, /<h1>Hello<\/h1>/);
  assert.match(html, /<strong>Bold<\/strong>/);
  assert.match(html, /<em>italic<\/em>/);
  assert.match(html, /<ul>/);
  assert.match(html, /<li>one<\/li>/);
});

test('escapes raw HTML rather than executing it', () => {
  const html = renderMarkdown('<script>alert("x")</script>');
  assert.doesNotMatch(html, /<script>/);
  assert.match(html, /&lt;script&gt;/);
});

test('blocks unsafe link protocols', () => {
  const html = renderMarkdown('[bad](javascript:alert(1))');
  assert.doesNotMatch(html, /href="javascript:/);
});

test('renders fenced code as escaped code', () => {
  const html = renderMarkdown('~~~not-a-fence\n<div>\n\n```html\n<div>safe</div>\n```');
  assert.match(html, /data-language="html"/);
  assert.match(html, /&lt;div&gt;safe&lt;\/div&gt;/);
});

test('reports document stats', () => {
  assert.deepEqual(markdownStats('one two\nthree'), { words: 3, characters: 13, lines: 2 });
});
