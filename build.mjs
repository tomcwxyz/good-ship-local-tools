import { build } from 'vite';
import { viteSingleFile } from 'vite-plugin-singlefile';
import { resolve } from 'path';
import { rmSync, readFileSync, writeFileSync } from 'fs';
import { createHash } from 'crypto';
import { TOOLS } from './src/tools.js';

const entries = [
  'index.html',
  ...TOOLS.map(tool => `tools/${tool.id}/index.html`),
];

rmSync('dist', { recursive: true, force: true });

for (const html of entries) {
  await build({
    base: './',
    plugins: [viteSingleFile()],
    logLevel: 'warn',
    build: {
      target: 'es2022',
      outDir: 'dist',
      emptyOutDir: false,
      rolldownOptions: { input: resolve(process.cwd(), html) },
    },
  });
  hardenBuiltHtml(resolve('dist', html));
  console.log('built', html);
}
console.log(`\nBuilt launcher + ${TOOLS.length} standalone tools into dist/`);

function hardenBuiltHtml(path) {
  let html = readFileSync(path, 'utf8');
  const hashes = [];
  const scriptRe = /<script\b(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/gi;
  for (const match of html.matchAll(scriptRe)) {
    if (!match[1]) continue;
    const hash = createHash('sha256').update(match[1], 'utf8').digest('base64');
    hashes.push(`'sha256-${hash}'`);
  }
  if (!hashes.length) throw new Error(`No inlined production script found in ${path}`);

  html = html
    .replace("connect-src 'self';", "connect-src 'none';")
    .replace("script-src 'self';", `script-src 'self' ${[...new Set(hashes)].join(' ')};`);
  writeFileSync(path, html);
}
