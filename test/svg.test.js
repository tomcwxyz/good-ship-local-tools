import test from 'node:test';
import assert from 'node:assert/strict';
import { assertSafeSvgText } from '../src/lib/svg.js';

test('safe self-contained SVG is accepted', () => {
  assert.equal(assertSafeSvgText('<svg xmlns="http://www.w3.org/2000/svg"><rect fill="#123456" width="10" height="10"/></svg>'), true);
});

test('SVG external resources and active content are rejected', () => {
  for (const svg of [
    '<svg><image href="https://example.com/a.png"/></svg>',
    '<svg><style>@import "https://example.com/a.css";</style></svg>',
    '<svg><script>alert(1)</script></svg>',
    '<svg><rect onclick="alert(1)"/></svg>',
    '<svg><foreignObject><iframe src="https://example.com"></iframe></foreignObject></svg>',
  ]) assert.throws(() => assertSafeSvgText(svg));
});
