import { readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { relative, resolve, sep } from 'node:path';
import { TOOLS } from '../src/tools.js';
import { sha256HexText, verifyStandaloneHtml } from './dist-check-lib.mjs';

const root = resolve('dist');
const expected = [
  'index.html',
  ...TOOLS.map(tool => `tools/${tool.id}/index.html`),
].sort();

const files = walk(root).map(path => relative(root, path).split(sep).join('/')).sort();
const unexpected = files.filter(file => !expected.includes(file));
const missing = expected.filter(file => !files.includes(file));
if (missing.length) throw new Error(`Missing production files: ${missing.join(', ')}`);
if (unexpected.length) throw new Error(`Unexpected production files/assets: ${unexpected.join(', ')}`);

const sums = [];
for (const file of expected) {
  const html = readFileSync(resolve(root, file), 'utf8');
  verifyStandaloneHtml(html, file);
  sums.push(`${sha256HexText(html)}  ${file}`);
}
writeFileSync(resolve(root, 'SHA256SUMS.txt'), `${sums.join('\n')}\n`);
console.log(`Verified ${expected.length} self-contained production HTML files.`);
console.log('Wrote dist/SHA256SUMS.txt');

function walk(dir) {
  const output = [];
  for (const entry of readdirSync(dir)) {
    const path = resolve(dir, entry);
    if (statSync(path).isDirectory()) output.push(...walk(path));
    else output.push(path);
  }
  return output;
}
