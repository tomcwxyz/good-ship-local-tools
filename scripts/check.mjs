import { readdirSync, readFileSync } from 'node:fs';
import { join, extname } from 'node:path';
import { spawnSync } from 'node:child_process';

const roots = ['src', 'tools', 'scripts'];
const js = [];
const html = ['index.html'];

function walk(dir) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === 'node_modules' || entry.name === 'dist') continue;
    const path = join(dir, entry.name);
    if (entry.isDirectory()) walk(path);
    else if (['.js', '.mjs'].includes(extname(path))) js.push(path);
    else if (extname(path) === '.html') html.push(path);
  }
}
for (const root of roots) walk(root);

let failed = false;
for (const file of js) {
  const r = spawnSync(process.execPath, ['--check', file], { encoding: 'utf8' });
  if (r.status !== 0) {
    failed = true;
    console.error(r.stderr || r.stdout);
  }
}

const ownSource = [...js.filter(file => !file.startsWith('scripts/')), ...html, 'src/brand/brand.css'];
const networkApi = /\b(fetch\s*\(|XMLHttpRequest\b|WebSocket\s*\(|EventSource\s*\(|sendBeacon\s*\()/;
for (const file of ownSource) {
  const text = readFileSync(file, 'utf8');
  if (networkApi.test(text)) {
    failed = true;
    console.error(`Network API found in ${file}. Local Tools source should remain network-free.`);
  }
}
for (const file of html) {
  const text = readFileSync(file, 'utf8');
  if (!text.includes('Content-Security-Policy')) {
    failed = true;
    console.error(`Missing Content-Security-Policy in ${file}.`);
  }
  if (text.includes("script-src 'self' 'unsafe-inline'")) {
    failed = true;
    console.error(`Unsafe inline script policy in ${file}. Production scripts must be hash-authorised.`);
  }
}

if (failed) process.exit(1);
console.log(`Checked ${js.length} JavaScript files and ${html.length} HTML entries.`);
console.log('No network APIs in first-party source; every HTML entry has a CSP.');
