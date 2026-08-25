import test from 'node:test';
import assert from 'node:assert/strict';
import { PDFDocument, PDFName } from 'pdf-lib';
import { cleanPdfDocumentMetadata } from '../src/lib/pdfprivacy.js';

test('PDF metadata cleaner removes Info and catalog XMP without replacing page content', async () => {
  const source = await PDFDocument.create({ updateMetadata: false });
  source.addPage([320, 240]);
  source.setTitle('Sensitive title');
  source.setAuthor('Jane Person');
  source.setCreator('Internal workflow');
  const xmp = source.context.stream(new TextEncoder().encode('<x:xmpmeta>secret xmp</x:xmpmeta>'), { Type:'Metadata', Subtype:'XML' });
  const xmpRef = source.context.register(xmp);
  source.catalog.set(PDFName.of('Metadata'), xmpRef);
  const original = await source.save({ useObjectStreams: false });

  const cleaned = await cleanPdfDocumentMetadata(original);
  const result = await PDFDocument.load(cleaned.bytes, { updateMetadata: false });
  assert.equal(result.getPageCount(), 1);
  assert.equal(result.getTitle(), undefined);
  assert.equal(result.getAuthor(), undefined);
  assert.equal(result.getCreator(), undefined);
  assert.equal(result.catalog.get(PDFName.of('Metadata')), undefined);
  assert.equal(new TextDecoder().decode(cleaned.bytes).includes('secret xmp'), false);
  assert.ok(cleaned.removed.length >= 1);
});
