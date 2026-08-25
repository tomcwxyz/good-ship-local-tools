import test from 'node:test';
import assert from 'node:assert/strict';
import { inspectOfficePackage, cleanOfficePackage, xmlValue, removeXmlElements } from '../src/lib/ooxml.js';

const enc = new TextEncoder();
const dec = new TextDecoder();

const core = `<?xml version="1.0"?><cp:coreProperties xmlns:cp="x" xmlns:dc="d" xmlns:dcterms="t"><dc:title>Annual report</dc:title><dc:creator>Jane Person</dc:creator><cp:lastModifiedBy>John Person</cp:lastModifiedBy><cp:revision>12</cp:revision><dcterms:created>2026-01-01</dcterms:created></cp:coreProperties>`;
const app = `<?xml version="1.0"?><Properties><Application>Word</Application><Company>Good Org</Company><Manager>Alex</Manager></Properties>`;
const custom = `<?xml version="1.0"?><Properties xmlns="x" xmlns:vt="v"><property fmtid="x" pid="2" name="Case ID"><vt:lpwstr>ABC-001</vt:lpwstr></property></Properties>`;

test('XML helpers read namespaced values and remove complete elements', () => {
  assert.equal(xmlValue(core, 'creator'), 'Jane Person');
  const cleaned = removeXmlElements(core, ['creator', 'lastModifiedBy']);
  assert.equal(cleaned.includes('Jane Person'), false);
  assert.equal(cleaned.includes('John Person'), false);
  assert.equal(cleaned.includes('Annual report'), true);
});

test('Office inspection distinguishes properties from content-risk signals', () => {
  const files = {
    'docProps/core.xml': enc.encode(core),
    'docProps/app.xml': enc.encode(app),
    'docProps/custom.xml': enc.encode(custom),
    'docProps/thumbnail.jpeg': new Uint8Array([1,2,3]),
    'word/document.xml': enc.encode('<w:document><w:ins/><w:del/></w:document>'),
    'word/comments.xml': enc.encode('<w:comments/>'),
    'word/_rels/document.xml.rels': enc.encode('<Relationships><Relationship Target="https://example.org" TargetMode="External"/></Relationships>'),
    'word/embeddings/file.bin': new Uint8Array([4]),
  };
  const r = inspectOfficePackage(files);
  assert.equal(r.core.creator, 'Jane Person');
  assert.equal(r.app.Company, 'Good Org');
  assert.deepEqual(r.custom, [{ name: 'Case ID', value: 'ABC-001' }]);
  assert.equal(r.signals.trackedChanges, 2);
  assert.equal(r.signals.comments, 1);
  assert.equal(r.signals.externalLinks, 1);
  assert.equal(r.signals.embeddedFiles, 1);
  assert.equal(r.signals.thumbnail, true);
});

test('Office cleaner removes personal properties without touching document content', () => {
  const originalDocument = enc.encode('<w:document><w:ins>keep tracked change</w:ins></w:document>');
  const files = {
    'docProps/core.xml': enc.encode(core),
    'docProps/app.xml': enc.encode(app),
    'docProps/custom.xml': enc.encode(custom),
    'docProps/thumbnail.jpeg': new Uint8Array([1,2,3]),
    '_rels/.rels': enc.encode('<Relationships><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/thumbnail" Target="docProps/thumbnail.jpeg"/><Relationship Id="rId2" Type="officeDocument" Target="word/document.xml"/></Relationships>'),
    '[Content_Types].xml': enc.encode('<Types><Override PartName="/docProps/thumbnail.jpeg" ContentType="image/jpeg"/><Override PartName="/word/document.xml" ContentType="application/xml"/></Types>'),
    'word/document.xml': originalDocument,
  };
  const r = cleanOfficePackage(files);
  const cleanedCore = dec.decode(r.files['docProps/core.xml']);
  assert.equal(cleanedCore.includes('Jane Person'), false);
  assert.equal(cleanedCore.includes('Annual report'), true);
  assert.equal(dec.decode(r.files['docProps/app.xml']).includes('Good Org'), false);
  assert.equal(dec.decode(r.files['docProps/custom.xml']).includes('ABC-001'), false);
  assert.equal(r.files['docProps/thumbnail.jpeg'], undefined);
  assert.equal(dec.decode(r.files['_rels/.rels']).includes('metadata/thumbnail'), false);
  assert.equal(dec.decode(r.files['_rels/.rels']).includes('officeDocument'), true);
  assert.equal(dec.decode(r.files['[Content_Types].xml']).includes('/docProps/thumbnail.jpeg'), false);
  assert.deepEqual(r.files['word/document.xml'], originalDocument);
});

function fakeCentralZip({ name = 'word/document.xml', uncompressed = 10, compressed = 8, entries = 1 } = {}) {
  const nameBytes = enc.encode(name);
  const central = new Uint8Array(46 + nameBytes.length);
  const cv = new DataView(central.buffer);
  cv.setUint32(0, 0x02014b50, true);
  cv.setUint32(20, compressed, true);
  cv.setUint32(24, uncompressed, true);
  cv.setUint16(28, nameBytes.length, true);
  central.set(nameBytes, 46);
  const eocd = new Uint8Array(22);
  const ev = new DataView(eocd.buffer);
  ev.setUint32(0, 0x06054b50, true);
  ev.setUint16(8, entries, true);
  ev.setUint16(10, entries, true);
  ev.setUint32(12, central.length, true);
  ev.setUint32(16, 0, true);
  const out = new Uint8Array(central.length + eocd.length);
  out.set(central, 0); out.set(eocd, central.length);
  return out;
}

test('ZIP central-directory inspection reads declared expansion size before unzip', async () => {
  const { inspectZipCentralDirectory } = await import('../src/lib/ooxml.js');
  const r = inspectZipCentralDirectory(fakeCentralZip({ uncompressed: 1234, compressed: 456 }));
  assert.equal(r.entries, 1);
  assert.equal(r.totalUncompressed, 1234);
  assert.equal(r.files[0].name, 'word/document.xml');
});

test('ZIP guard rejects an oversized internal entry before decompression', async () => {
  const { inspectZipCentralDirectory } = await import('../src/lib/ooxml.js');
  assert.throws(() => inspectZipCentralDirectory(fakeCentralZip({ uncompressed: 100 * 1024 * 1024 })), /unusually large internal file/);
});


test('descriptive Office metadata is only removed when explicitly selected', () => {
  const files = { 'docProps/core.xml': enc.encode(core) };
  const defaultClean = cleanOfficePackage(files);
  assert.equal(dec.decode(defaultClean.files['docProps/core.xml']).includes('Annual report'), true);
  const explicitClean = cleanOfficePackage(files, { removeDescriptive: true });
  assert.equal(dec.decode(explicitClean.files['docProps/core.xml']).includes('Annual report'), false);
});
