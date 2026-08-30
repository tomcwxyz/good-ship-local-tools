import { build } from 'vite';
import { resolve } from 'node:path';
import { rmSync, readFileSync, writeFileSync } from 'node:fs';
import { TOOLS } from './src/tools.js';
import { ensureAnydocWasm } from './scripts/prepare-anydoc.mjs';

await ensureAnydocWasm();

const inputs = {
  launcher: resolve('index.html'),
  ...Object.fromEntries(TOOLS.map(tool => [tool.id, resolve(`tools/${tool.id}/index.html`)])),
};

rmSync('dist-hosted', { recursive:true, force:true });

await build({
  configFile: false,
  base: './',
  logLevel: 'warn',
  build: {
    target: 'es2022',
    outDir: 'dist-hosted',
    emptyOutDir: true,
    rolldownOptions: { input: inputs },
  },
});

for (const html of ['index.html', ...TOOLS.map(tool => `tools/${tool.id}/index.html`)]) {
  const file = resolve('dist-hosted', html);
  let source = readFileSync(file, 'utf8');
  source = source
    .replace('<title>The Good Ship · ', '<title>Sets · ')
    .replace("connect-src 'self';", "connect-src https://plausible.io;")
    .replace("script-src 'self';", "script-src 'self' https://good-ship.co.uk https://plausible.io;")
    .replace(
      '</head>',
      '  <script async src="https://good-ship.co.uk/analytics/browser.js"></script>\n</head>',
    );
  writeFileSync(file, source);
}

console.log(`Built hosted Sets launcher + ${TOOLS.length} tools into dist-hosted/ with shared same-origin assets.`);
