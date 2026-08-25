import { readdir } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { chromium, firefox, webkit } from 'playwright';

const distDir = path.resolve(process.argv[2] || 'dist');

async function findHtml(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  const out = [];
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...await findHtml(full));
    else if (entry.isFile() && entry.name.endsWith('.html')) out.push(full);
  }
  return out.sort();
}

function rel(file) {
  return path.relative(distDir, file).split(path.sep).join('/');
}

function isNetworkUrl(value) {
  try {
    return ['http:', 'https:', 'ws:', 'wss:'].includes(new URL(value).protocol);
  } catch {
    return false;
  }
}

async function smokePage(browser, browserName, file) {
  const page = await browser.newPage();
  const failures = [];
  const networkRequests = [];

  page.on('pageerror', error => failures.push(`page error: ${error.message}`));
  page.on('console', message => {
    if (message.type() === 'error') failures.push(`console error: ${message.text()}`);
  });
  page.on('request', request => {
    if (isNetworkUrl(request.url())) networkRequests.push(request.url());
  });

  try {
    await page.goto(pathToFileURL(file).href, { waitUntil: 'load', timeout: 15_000 });
    await page.waitForTimeout(120);

    const state = await page.evaluate(() => ({
      title: document.title.trim(),
      text: document.body?.innerText?.trim() || '',
      externalAssets: [
        ...document.querySelectorAll('script[src], link[rel="stylesheet"][href]'),
      ].map(node => node.getAttribute('src') || node.getAttribute('href')),
    }));

    if (!state.title) failures.push('document title is empty');
    if (state.text.length < 20) failures.push('page rendered less than 20 characters of visible text');
    if (state.externalAssets.length) failures.push(`external asset elements found: ${state.externalAssets.join(', ')}`);

    const relative = rel(file);
    if (relative === 'tools/hash/index.html') {
      await page.locator('input[type="file"]').setInputFiles({
        name: 'smoke.txt',
        mimeType: 'text/plain',
        buffer: Buffer.from('good ship local tools browser smoke test\n'),
      });
      await page.waitForFunction(() => {
        const text = document.body?.innerText || '';
        return text.includes('1 file hashed') && /\b[0-9a-f]{64}\b/i.test(text);
      }, null, { timeout: 10_000 });
    }

    if (relative === 'tools/csv/index.html') {
      await page.locator('input[type="file"]').setInputFiles({
        name: 'smoke.tsv',
        mimeType: 'text/tab-separated-values',
        buffer: Buffer.from('Name\tEmail\nAda\tada@example.org\nGrace\tgrace@example.org\n'),
      });
      await page.waitForFunction(() => {
        const text = document.body?.innerText || '';
        return text.includes('Download clean file') && text.toLowerCase().includes('tab delimited');
      }, null, { timeout: 10_000 });
    }

    if (networkRequests.length) failures.push(`network request(s): ${[...new Set(networkRequests)].join(', ')}`);
    if (failures.length) throw new Error(`${browserName} · ${relative}\n- ${failures.join('\n- ')}`);
    process.stdout.write(`✓ ${browserName.padEnd(8)} ${relative}\n`);
  } finally {
    await page.close();
  }
}

const htmlFiles = await findHtml(distDir);
if (htmlFiles.length !== 12) {
  throw new Error(`Expected 12 standalone HTML files in ${distDir}; found ${htmlFiles.length}.`);
}

const engines = [
  ['chromium', chromium],
  ['firefox', firefox],
  ['webkit', webkit],
];

for (const [name, engine] of engines) {
  const browser = await engine.launch({ headless: true });
  try {
    for (const file of htmlFiles) await smokePage(browser, name, file);
  } finally {
    await browser.close();
  }
}

console.log(`Browser smoke passed: ${htmlFiles.length} standalone files × ${engines.length} browser engines.`);
