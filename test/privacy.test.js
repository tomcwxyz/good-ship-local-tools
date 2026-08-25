import test from 'node:test';
import assert from 'node:assert/strict';
import { findPersonalData, groupPersonalData, maskPersonalValue, redactDetectedText } from '../src/lib/privacy.js';

test('personal-data finder recognises common UK-oriented patterns', () => {
  const text = 'Email ada@example.org, postcode NE1 4ST, phone 07700 900123, NI QQ123456C, IP 192.168.1.10 and https://example.org/x.';
  const matches = findPersonalData(text);
  const types = new Set(matches.map(match => match.type));
  assert(types.has('email'));
  assert(types.has('uk-postcode'));
  assert(types.has('uk-phone'));
  assert(types.has('ni-number'));
  assert(types.has('ipv4'));
  assert(types.has('url'));
});

test('invalid IPv4 and card-like digit runs are filtered', () => {
  const matches = findPersonalData('999.1.1.1 and 1234 5678 9012 3456');
  assert.equal(matches.some(match => match.type === 'ipv4'), false);
  assert.equal(matches.some(match => match.type === 'payment-card'), false);
});

test('known Luhn-valid payment card test number is detected', () => {
  const matches = findPersonalData('Test only: 4242 4242 4242 4242');
  assert.equal(matches.filter(match => match.type === 'payment-card').length, 1);
});

test('grouping uses masked examples rather than raw values', () => {
  const matches = findPersonalData('ada@example.org and grace@example.org');
  const grouped = groupPersonalData(matches);
  assert.equal(grouped[0].count, 2);
  assert.equal(grouped[0].examples.some(value => value.includes('ada@example.org')), false);
});

test('detected spans can be replaced without exposing matched values', () => {
  const text = 'Contact ada@example.org today.';
  const matches = findPersonalData(text, { types:['email'] });
  assert.equal(redactDetectedText(text, matches), 'Contact [possible personal data] today.');
  assert.match(maskPersonalValue('ada@example.org', 'email'), /@example\.org$/);
});
