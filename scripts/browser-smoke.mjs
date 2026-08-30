import { readdir } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { chromium, firefox, webkit } from 'playwright';

const distDir = path.resolve(process.argv[2] || 'dist');
const expectedHtmlFiles = 18; // launcher + 17 tools
const smokePdf = Buffer.from('JVBERi0xLjMKJeLjz9MKMSAwIG9iago8PAovUHJvZHVjZXIgKHB5cGRmKQovVGl0bGUgKFNtb2tlIFBERikKPj4KZW5kb2JqCjIgMCBvYmoKPDwKL1R5cGUgL1BhZ2VzCi9Db3VudCAxCi9LaWRzIFsgNCAwIFIgXQo+PgplbmRvYmoKMyAwIG9iago8PAovVHlwZSAvQ2F0YWxvZwovUGFnZXMgMiAwIFIKPj4KZW5kb2JqCjQgMCBvYmoKPDwKL1R5cGUgL1BhZ2UKL1Jlc291cmNlcyA8PAo+PgovTWVkaWFCb3ggWyAwLjAgMC4wIDMwMCA0MDAgXQovUGFyZW50IDIgMCBSCj4+CmVuZG9iagp4cmVmCjAgNQowMDAwMDAwMDAwIDY1NTM1IGYgCjAwMDAwMDAwMTUgMDAwMDAgbiAKMDAwMDAwMDA3MyAwMDAwMCBuIAowMDAwMDAwMTMyIDAwMDAwIG4gCjAwMDAwMDAxODEgMDAwMDAgbiAKdHJhaWxlcgo8PAovU2l6ZSA1Ci9Sb290IDMgMCBSCi9JbmZvIDEgMCBSCj4+CnN0YXJ0eHJlZgoyNzUKJSVFT0YK', 'base64');

async function findHtml(dir) {
  const entries = await readdir(dir, { withFileTypes:true });
  const out = [];
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...await findHtml(full));
    else if (entry.isFile() && entry.name.endsWith('.html')) out.push(full);
  }
  return out.sort();
}

function rel(file) { return path.relative(distDir, file).split(path.sep).join('/'); }
function isNetworkUrl(value) {
  try { return ['http:','https:','ws:','wss:'].includes(new URL(value).protocol); }
  catch { return false; }
}

async function waitForBody(page, predicate, description, timeout = 10_000) {
  try { await page.waitForFunction(predicate, null, { timeout }); }
  catch (error) {
    const body = (await page.locator('body').innerText()).replace(/\s+/g, ' ').trim();
    throw new Error(`${description} did not become ready. Body: ${body.slice(0, 1200)}`, { cause:error });
  }
}

async function smokePage(browser, browserName, file) {
  const page = await browser.newPage();
  const failures = [];
  const networkRequests = [];
  page.on('pageerror', error => failures.push(`page error: ${error.message}`));
  page.on('console', message => { if (message.type() === 'error') failures.push(`console error: ${message.text()}`); });
  page.on('request', request => { if (isNetworkUrl(request.url())) networkRequests.push(request.url()); });

  try {
    await page.goto(pathToFileURL(file).href, { waitUntil:'load', timeout:15_000 });
    await page.waitForTimeout(120);
    const state = await page.evaluate(() => ({
      title:document.title.trim(), text:document.body?.innerText?.trim() || '',
      externalAssets:[...document.querySelectorAll('script[src], link[rel="stylesheet"][href]')].map(node => node.getAttribute('src') || node.getAttribute('href')),
    }));
    if (!state.title) failures.push('document title is empty');
    if (state.text.length < 20) failures.push('page rendered less than 20 characters of visible text');
    if (state.externalAssets.length) failures.push(`external asset elements found: ${state.externalAssets.join(', ')}`);

    const relative = rel(file);
    if (relative === 'tools/document-markdown/index.html') {
      await page.locator('input[type="file"]').setInputFiles({
        name:'people.csv',
        mimeType:'text/csv',
        buffer:Buffer.from('Name,Role\\nAda,Researcher\\nGrace,Engineer\\n'),
      });
      await waitForBody(page, () => {
        const text = document.body?.innerText || '';
        const output = document.querySelector('textarea')?.value || '';
        return text.includes('Converted people.csv') && output.includes('| Name | Role |') && output.includes('| Ada | Researcher |');
      }, `${browserName} Document to Markdown fixture`, 20_000);
    }

    if (relative === 'tools/hash/index.html') {
      await page.locator('input[type="file"]').setInputFiles({ name:'smoke.txt', mimeType:'text/plain', buffer:Buffer.from('sets browser smoke test\n') });
      await waitForBody(page, () => {
        const text = document.body?.innerText || '';
        return text.includes('1 file hashed') && /\b[0-9a-f]{64}\b/i.test(text);
      }, `${browserName} checksum fixture`);
    }

    if (relative === 'tools/secret/index.html') {
      const output = page.locator('#secret-output');
      await page.waitForFunction(() => {
        const value = document.querySelector('#secret-output')?.value || '';
        return value.length >= 40;
      }, null, { timeout:10_000 });
      await page.locator('#secret-format').selectOption('hex');
      await page.locator('#secret-strength').selectOption('256');
      const secretState = await page.evaluate(() => ({
        secret:document.querySelector('#secret-output')?.value || '',
        env:document.querySelector('#secret-env-line')?.value || '',
        command:document.querySelector('#secret-command')?.value || '',
      }));
      if (!/^[0-9a-f]{64}$/.test(secretState.secret)) failures.push(`secret fixture was not 256-bit hex: ${secretState.secret}`);
      if (!secretState.env.endsWith(secretState.secret)) failures.push('secret .env output does not contain the generated value');
      if (secretState.command !== 'openssl rand -hex 32') failures.push(`unexpected secret terminal command: ${secretState.command}`);
    }

    if (relative === 'tools/csv/index.html') {
      await page.locator('input[type="file"]').setInputFiles({ name:'smoke.tsv', mimeType:'text/tab-separated-values', buffer:Buffer.from('Name\tEmail\nAda\tada@example.org\nGrace\tgrace@example.org\n') });
      await waitForBody(page, () => (document.body?.innerText || '').includes('Download clean file'), `${browserName} CSV/TSV editor`);
      const csvState = await page.evaluate(() => ({
        text:document.body?.innerText || '', cells:[...document.querySelectorAll('tbody td')].map(node => node.textContent?.trim() || ''), selectValues:[...document.querySelectorAll('select')].map(node => node.value),
      }));
      for (const expected of ['Ada','ada@example.org','Grace','grace@example.org']) if (!csvState.cells.includes(expected)) failures.push(`TSV fixture cell missing: ${expected}`);
      if (!csvState.text.toLowerCase().includes('tab delimited')) failures.push(`TSV auto-detection did not report tab delimiter (select values: ${JSON.stringify(csvState.selectValues)})`);
    }

    if (relative === 'tools/privacy-find/index.html') {
      const textarea = page.locator('textarea');
      await textarea.fill('Contact ada@example.org at NE1 4ST.');
      await waitForBody(page, () => {
        const text = document.body?.innerText || '';
        return text.includes('Email address') && text.includes('UK postcode') && text.includes('possible match');
      }, `${browserName} personal-data finder fixture`);
    }

    if (relative === 'tools/pseudonymise/index.html') {
      await page.locator('input[type="file"]').setInputFiles({ name:'people.csv', mimeType:'text/csv', buffer:Buffer.from('Name,Email\nAda,ada@example.org\nAda,ada@example.org\n') });
      await waitForBody(page, () => {
        const text = document.body?.innerText || '';
        return text.includes('column actions') && text.includes('Download transformed data');
      }, `${browserName} pseudonymiser fixture`);
    }

    if (relative === 'tools/preflight/index.html') {
      await page.locator('input[type="file"]').setInputFiles({ name:'publish.txt', mimeType:'text/plain', buffer:Buffer.from('Contact ada@example.org before publishing.\n') });
      await waitForBody(page, () => {
        const text = document.body?.innerText || '';
        return text.includes('publish.txt') && text.toLowerCase().includes('possible email address match');
      }, `${browserName} publication preflight fixture`);
    }

    if (relative === 'tools/pdf/index.html') {
      await page.locator('input[type="file"]').setInputFiles({ name:'smoke.pdf', mimeType:'application/pdf', buffer:smokePdf });
      await waitForBody(page, () => {
        const text = document.body?.innerText || '';
        return text.includes('1 page in output') && text.includes('Export PDF');
      }, `${browserName} PDF workbench fixture`, 15_000);
    }

    if (relative === 'tools/pdf-sanitise/index.html') {
      await page.locator('input[type="file"]').setInputFiles({ name:'smoke.pdf', mimeType:'application/pdf', buffer:smokePdf });
      await waitForBody(page, () => {
        const text = document.body?.innerText || '';
        return text.includes('Create structural clean copy') && text.includes('1 page');
      }, `${browserName} PDF sanitiser inspection`, 15_000);

      await page.evaluate(() => {
        window.__setsSmokeDownload = null;
        window.__setsSmokeBlob = null;
        const originalClick = HTMLAnchorElement.prototype.click;
        const originalCreateObjectURL = URL.createObjectURL.bind(URL);
        URL.createObjectURL = function smokeCaptureBlob(blob) {
          window.__setsSmokeBlob = blob;
          return originalCreateObjectURL(blob);
        };
        HTMLAnchorElement.prototype.click = function smokeCaptureClick() {
          if (this.download) {
            window.__setsSmokeDownload = { filename:this.download };
            return;
          }
          return originalClick.call(this);
        };
      });
      await page.locator('#sanitize-ack').check();
      await page.getByRole('button', { name:'Create structural clean copy' }).click();
      await page.waitForFunction(() => (window.__setsSmokeDownload && window.__setsSmokeBlob) || (document.body?.innerText || '').includes('Could not rebuild this PDF'), null, { timeout:15_000 });
      const generated = await page.evaluate(async () => {
        const record = window.__setsSmokeDownload;
        const blob = window.__setsSmokeBlob;
        if (!record || !blob) return null;
        const bytes = new Uint8Array(await blob.arrayBuffer());
        return {
          filename:record.filename,
          size:bytes.length,
          prefix:String.fromCharCode(...bytes.slice(0, 5)),
          status:document.body?.innerText || '',
        };
      });
      if (!generated) failures.push(`PDF sanitiser did not create a blob output: ${(await page.locator('body').innerText()).slice(-500)}`);
      else {
        if (generated.filename !== 'smoke-structural-clean.pdf') failures.push(`unexpected sanitiser download name: ${generated.filename}`);
        if (generated.size < 100) failures.push(`PDF sanitiser output was unexpectedly small: ${generated.size} bytes`);
        if (generated.prefix !== '%PDF-') failures.push(`PDF sanitiser output did not start with %PDF- (got ${JSON.stringify(generated.prefix)})`);
        if (!generated.status.includes('rebuilt into a fresh PDF')) failures.push('PDF sanitiser did not report a successful rebuild.');
      }
    }

    if (networkRequests.length) failures.push(`network request(s): ${[...new Set(networkRequests)].join(', ')}`);
    if (failures.length) throw new Error(`${browserName} · ${relative}\n- ${failures.join('\n- ')}`);
    process.stdout.write(`✓ ${browserName.padEnd(8)} ${relative}\n`);
  } finally { await page.close(); }
}

const htmlFiles = await findHtml(distDir);
if (htmlFiles.length !== expectedHtmlFiles) throw new Error(`Expected ${expectedHtmlFiles} standalone HTML files in ${distDir}; found ${htmlFiles.length}.`);

const engines = [['chromium',chromium],['firefox',firefox],['webkit',webkit]];
for (const [name, engine] of engines) {
  const browser = await engine.launch({ headless:true });
  try { for (const file of htmlFiles) await smokePage(browser, name, file); }
  finally { await browser.close(); }
}
console.log(`Browser smoke passed: ${htmlFiles.length} standalone files × ${engines.length} browser engines.`);