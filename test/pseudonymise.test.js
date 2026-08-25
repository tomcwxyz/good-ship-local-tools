import test from 'node:test';
import assert from 'node:assert/strict';
import { stablePseudonymMaps, transformRows, maskCell } from '../src/lib/pseudonymise.js';

test('stable pseudonyms repeat for the same value within a column', () => {
  const rows = [{ Name:'Ada' }, { Name:'Grace' }, { Name:'Ada' }];
  const maps = stablePseudonymMaps(rows, ['Name'], { Name:'pseudonymise' });
  assert.equal(maps.get('Name').get('Ada'), 'P-name-0001');
  assert.equal(maps.get('Name').get('Grace'), 'P-name-0002');
});

test('transformRows can keep, remove, mask and pseudonymise columns', async () => {
  const result = await transformRows([
    { Name:'Ada', Email:'ada@example.org', Team:'North', Secret:'x' },
    { Name:'Ada', Email:'ada@example.org', Team:'South', Secret:'y' },
  ], ['Name','Email','Team','Secret'], {
    Name:'pseudonymise', Email:'mask', Team:'keep', Secret:'remove',
  });
  assert.deepEqual(result.fields, ['Name','Email','Team']);
  assert.equal(result.rows[0].Name, result.rows[1].Name);
  assert.equal(result.rows[0].Email.endsWith('.org'), true);
  assert.equal('Secret' in result.rows[0], false);
  assert.equal(result.mapping.length, 1);
});

test('hash action is salted and truncatable through an injected SHA function', async () => {
  const calls = [];
  const fakeHash = async value => { calls.push(value); return 'abcdef0123456789'.repeat(4); };
  const result = await transformRows([{ ID:'123' }], ['ID'], { ID:'hash' }, {
    hashFn:fakeHash, hashSalt:'local-salt', hashLength:12,
  });
  assert.equal(calls[0], 'local-salt\u0000123');
  assert.equal(result.rows[0].ID, 'abcdef012345');
});

test('maskCell keeps only the chosen suffix visible', () => {
  assert.equal(maskCell('1234567890', { reveal:4 }), '••••••7890');
});
