import test from 'node:test';
import assert from 'node:assert/strict';
import { normaliseCsvHeaders, replaceLiteral, cleanCsvData, delimiterLabel } from '../src/lib/csv.js';

test('CSV headers are trimmed and made unique case-insensitively', () => {
  assert.deepEqual(
    normaliseCsvHeaders([' Name ', 'name', '', 'Age']).fields,
    ['Name', 'name (2)', 'column', 'Age'],
  );
});

test('literal replacement supports case and whole-cell controls', () => {
  assert.deepEqual(replaceLiteral('North NORTH north', 'north', 'East'), {
    value: 'East East East', count: 3,
  });
  assert.deepEqual(replaceLiteral('North NORTH', 'North', 'East', { caseSensitive: true }), {
    value: 'East NORTH', count: 1,
  });
  assert.deepEqual(replaceLiteral('North East', 'North', 'South', { wholeCell: true }), {
    value: 'North East', count: 0,
  });
});

test('CSV cleaning can find/replace in selected columns and dedupe by chosen keys', () => {
  const data = [
    { Email:' a@example.org ', Team:'North', Note:'North office' },
    { Email:'a@example.org', Team:'NORTH', Note:'Duplicate person' },
    { Email:'b@example.org', Team:'South', Note:'North referral' },
  ];
  const result = cleanCsvData(data, ['Email', 'Team', 'Note'], {
    findReplace: { find:'North', replace:'East', fields:['Team'], caseSensitive:false },
    dedupe: true,
    dedupeFields: ['Email'],
  });
  assert.equal(result.rows.length, 2);
  assert.equal(result.rows[0].Email, 'a@example.org');
  assert.equal(result.rows[0].Team, 'East');
  assert.equal(result.rows[1].Note, 'North referral');
  assert.deepEqual(result.stats, { replacements: 2, duplicatesRemoved: 1 });
});

test('CSV cleaning drops empty rows and optional empty columns', () => {
  const result = cleanCsvData([
    { A:'  ', B:'', C:'x' },
    { A:'', B:'', C:'' },
  ], ['A','B','C'], { dropEmptyCols:true });
  assert.deepEqual(result.fields, ['C']);
  assert.deepEqual(result.rows, [{ C:'x' }]);
});

test('delimiter labels are readable', () => {
  assert.equal(delimiterLabel('\t'), 'tab');
  assert.equal(delimiterLabel(';'), 'semicolon');
});

test('empty selected field lists do not silently mean all columns', () => {
  const data = [
    { A:'same', B:'one' },
    { A:'same', B:'two' },
  ];
  const result = cleanCsvData(data, ['A','B'], {
    dedupe:true,
    dedupeFields:[],
    findReplace:{ find:'same', replace:'changed', fields:[] },
  });
  assert.equal(result.rows.length, 2);
  assert.equal(result.rows[0].A, 'same');
  assert.deepEqual(result.stats, { replacements:0, duplicatesRemoved:0 });
});

test('literal replacement treats regex punctuation as ordinary text', () => {
  assert.deepEqual(replaceLiteral('a+b [x] a+b', 'a+b', 'sum'), {
    value:'sum [x] sum', count:2,
  });
});
