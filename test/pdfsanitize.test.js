import test from 'node:test';
import assert from 'node:assert/strict';
import { PDFDocument, PDFName, StandardFonts } from 'pdf-lib';
import { rebuildPdfStructure } from '../src/lib/pdfsanitize.js';

test('structural PDF rebuild keeps visible pages but starts with a fresh document catalog', async () => {
  const source = await PDFDocument.create({ updateMetadata:false });
  const page = source.addPage([320, 240]);
  const font = await source.embedFont(StandardFonts.Helvetica);
  page.drawText('Visible content', { x:20, y:100, size:14, font });
  source.setTitle('Sensitive title');
  source.setAuthor('Named person');
  if (typeof source.addJavaScript === 'function') source.addJavaScript('test', 'app.alert("x")');
  const original = await source.save({ useObjectStreams:false });

  const rebuilt = await rebuildPdfStructure(original);
  const result = await PDFDocument.load(rebuilt.bytes, { updateMetadata:false });
  assert.equal(result.getPageCount(), 1);
  assert.equal(result.getTitle(), undefined);
  assert.equal(result.getAuthor(), undefined);
  const names = result.catalog.get(PDFName.of('Names'));
  assert.equal(names, undefined);
  assert.equal(rebuilt.removedByConstruction.includes('digital signatures'), true);
});

test('structural PDF rebuild preserves a valid blank page with no Contents stream', async () => {
  const source = await PDFDocument.create({ updateMetadata:false });
  const page = source.addPage([300, 400]);
  assert.equal(page.node.has(PDFName.of('Contents')), false);
  const original = await source.save({ useObjectStreams:false });

  const rebuilt = await rebuildPdfStructure(original);
  const result = await PDFDocument.load(rebuilt.bytes, { updateMetadata:false });
  assert.equal(result.getPageCount(), 1);
  assert.deepEqual(result.getPage(0).getSize(), { width:300, height:400 });
});
