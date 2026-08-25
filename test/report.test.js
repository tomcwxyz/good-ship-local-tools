import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createInspectionReport,
  createInspectionSource,
  inspectionReportFilename,
  inspectionReportJson,
  INSPECTION_REPORT_SCHEMA,
} from '../src/lib/report.js';

test('inspection reports omit sensitive detail values by default', () => {
  const report = createInspectionReport({
    tool: 'office-privacy',
    generatedAt: '2026-08-25T12:00:00.000Z',
    source: { size: 1234, sha256: 'abc' },
    findings: { propertyNames: ['creator'], signals: { comments: 2 } },
    details: { properties: { creator: 'Personal Name' } },
  });
  assert.equal(report.schema, INSPECTION_REPORT_SCHEMA);
  assert.equal(report.details, undefined);
  assert.equal(JSON.stringify(report).includes('Personal Name'), false);
});

test('inspection source omits the filename unless explicitly requested', () => {
  const summary = createInspectionSource({
    name: 'person-case-123.docx',
    size: 1234,
    mediaType: 'application/test',
    sha256: 'a'.repeat(64),
  });
  assert.equal(summary.name, undefined);
  assert.equal(JSON.stringify(summary).includes('person-case-123'), false);
  assert.equal(summary.sha256, 'a'.repeat(64));

  const identified = createInspectionSource({
    name: 'person-case-123.docx',
    includeName: true,
    size: 1234,
  });
  assert.equal(identified.name, 'person-case-123.docx');
});

test('summary report filenames use the fingerprint rather than source filename', () => {
  assert.equal(
    inspectionReportFilename({ sha256: '1234567890abcdef', name: 'secret-case.docx' }),
    'privacy-inspection-1234567890ab.json',
  );
  assert.equal(
    inspectionReportFilename({ sha256: '1234567890abcdef', name: 'secret-case', includeName: true }),
    'secret-case-privacy-report.json',
  );
});

test('full inspection reports include normalised metadata values only when selected', () => {
  const report = createInspectionReport({
    tool: 'pdf-privacy',
    generatedAt: '2026-08-25T12:00:00.000Z',
    source: { name: 'file.pdf' },
    findings: { metadataFields: ['Author'] },
    details: { metadata: { Author: 'A Person', Created: new Date('2026-01-02T03:04:05Z') } },
    includeDetails: true,
  });
  assert.equal(report.details.metadata.Author, 'A Person');
  assert.equal(report.details.metadata.Created, '2026-01-02T03:04:05.000Z');
});

test('inspection reports record selected and completed cleaning actions', () => {
  const report = createInspectionReport({
    tool: 'office-privacy',
    source: { name: 'example.docx' },
    findings: {},
    cleaning: {
      selected: { personal: true, descriptive: false },
      completed: { changed: ['core properties'] },
    },
  });
  assert.deepEqual(report.cleaning.selected, { personal: true, descriptive: false });
  assert.deepEqual(report.cleaning.completed.changed, ['core properties']);
});

test('inspection report JSON is human-readable and newline terminated', () => {
  const text = inspectionReportJson(createInspectionReport({ tool: 'test', source: {}, findings: {} }));
  assert.match(text, /\n  "schema":/);
  assert.equal(text.endsWith('\n'), true);
});
