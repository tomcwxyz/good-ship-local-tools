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
  if (!html.includes("connect-src 'none'")) errors.push(`${rel}: CSP does not seal connect-src`);
  if (!html.includes("object-src 'none'")) errors.push(`${rel}: CSP does not seal object-src`);
  if (!html.includes("form-action 'none'")) errors.push(`${rel}: CSP does not seal form-action`);
  if (/<(?:script|link)[^>]+(?:src|href)=["']https?:/i.test(html)) errors.push(`${rel}: external script/style URL found`);
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
