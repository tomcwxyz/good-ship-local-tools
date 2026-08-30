import { readdirSync, readFileSync, statSync } from 'node:fs';
import { resolve, relative, sep } from 'node:path';
import { TOOLS } from '../src/tools.js';

const root = resolve('dist-hosted');
const expected = ['index.html', ...TOOLS.map(tool => `tools/${tool.id}/index.html`)];
const errors = [];

for (const rel of expected) {
  const file = resolve(root, rel);
  try {
    if (!statSync(file).isFile()) throw new Error('not a file');
  } catch {
    errors.push(`missing hosted entry: ${rel}`);
    continue;
  }
  const html = readFileSync(file, 'utf8');
  if (!html.includes("connect-src https://plausible.io;")) errors.push(`${rel}: hosted CSP does not limit connect-src to Plausible`);
  const expectedScriptSrc = rel.includes('document-markdown')
    ? "script-src 'self' 'wasm-unsafe-eval' https://good-ship.co.uk https://plausible.io;"
    : "script-src 'self' https://good-ship.co.uk https://plausible.io;";
  if (!html.includes(expectedScriptSrc)) errors.push(`${rel}: hosted CSP does not match the expected script boundary`);
  if (!html.includes("object-src 'none'")) errors.push(`${rel}: CSP does not seal object-src`);
  if (!html.includes("form-action 'none'")) errors.push(`${rel}: CSP does not seal form-action`);
  if (!html.includes('<script async src="https://good-ship.co.uk/analytics/browser.js"></script>')) errors.push(`${rel}: shared Good Ship analytics tracker missing`);
  const externalAssets = [...html.matchAll(/<(?:script|link)[^>]+(?:src|href)=["'](https?:[^"']+)/gi)].map(match => match[1]);
  for (const url of externalAssets) {
    if (url !== "https://good-ship.co.uk/analytics/browser.js") errors.push(`${rel}: unexpected external script/style URL: ${url}`);
  }
  if (/<(?:iframe|object|embed)\b/i.test(html)) errors.push(`${rel}: active embed element found`);
}

function walk(dir) {
  return readdirSync(dir, { withFileTypes:true }).flatMap(entry => {
    const full = resolve(dir, entry.name);
    return entry.isDirectory() ? walk(full) : [full];
  });
}

const files = walk(root);
for (const file of files) {
  const rel = relative(root, file).split(sep).join('/');
  if (rel.endsWith('.map')) errors.push(`source map should not ship: ${rel}`);
}

if (errors.length) {
  console.error(errors.join('\n'));
  process.exit(1);
}

const bytes = files.reduce((sum, file) => sum + statSync(file).size, 0);
console.log(`Verified hosted Sets build: ${expected.length} HTML entries, ${files.length} files, ${(bytes / 1024 / 1024).toFixed(2)} MiB.`);
