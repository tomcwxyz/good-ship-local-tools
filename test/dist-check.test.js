import test from 'node:test';
import assert from 'node:assert/strict';
import { sha256HexText, verifyStandaloneHtml } from '../scripts/dist-check-lib.mjs';

const safe = `<!doctype html><html><head>
<meta http-equiv="Content-Security-Policy" content="default-src 'self'; connect-src 'none'; script-src 'self' 'sha256-AbCd='; object-src 'none'; base-uri 'none'; form-action 'none'">
<style>body{margin:0}</style></head><body><script>console.log('local')</script></body></html>`;

test('production HTML verifier accepts an inlined, network-sealed page', () => {
  assert.equal(verifyStandaloneHtml(safe), true);
});

test('production HTML verifier rejects external scripts and permissive connections', () => {
  const unsafe = safe
    .replace("connect-src 'none'", "connect-src 'self'")
    .replace("<script>console.log('local')</script>", '<script src="app.js"></script>');
  assert.throws(() => verifyStandaloneHtml(unsafe), /connect-src|external script/);
});

test('production HTML verifier rejects active embedding elements', () => {
  assert.throws(() => verifyStandaloneHtml(safe.replace('</body>', '<iframe src="x"></iframe></body>')), /iframe/);
});

test('text SHA-256 helper is deterministic', () => {
  assert.equal(sha256HexText('abc'), 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
});
