const DEFINITIONS = [
  {
    type: 'email', label: 'Email address',
    re: /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi,
  },
  {
    type: 'uk-postcode', label: 'UK postcode',
    re: /\b(?:GIR\s?0AA|(?:[A-PR-UWYZ][0-9][0-9A-HJKSTUW]?|[A-PR-UWYZ][A-HK-Y][0-9][0-9ABEHMNPRV-Y]?)\s?[0-9][ABD-HJLNP-UW-Z]{2})\b/gi,
  },
  {
    type: 'ni-number', label: 'National Insurance number',
    re: /\b(?!BG|GB|NK|KN|TN|NT|ZZ)[A-CEGHJ-PR-TW-Z]{2}\s?\d{2}\s?\d{2}\s?\d{2}\s?[A-D]\b/gi,
  },
  {
    type: 'url', label: 'Web address',
    re: /\bhttps?:\/\/[^\s<>'"\])}]+/gi,
  },
  {
    type: 'date', label: 'Date-like value',
    re: /\b(?:0?[1-9]|[12]\d|3[01])[\/.-](?:0?[1-9]|1[0-2])[\/.-](?:19|20)\d{2}\b/g,
  },
  {
    type: 'uk-phone', label: 'UK phone-like number',
    re: /(?:\+44\s?(?:\(0\)\s?)?|\b0)(?:\d[\s().-]?){9,10}\d\b/g,
    validate: value => {
      const digits = value.replace(/\D/g, '');
      return digits.startsWith('44') ? digits.length >= 11 && digits.length <= 13 : digits.length >= 10 && digits.length <= 11;
    },
  },
  {
    type: 'ipv4', label: 'IPv4 address',
    re: /\b(?:\d{1,3}\.){3}\d{1,3}\b/g,
    validate: value => value.split('.').every(part => Number(part) >= 0 && Number(part) <= 255),
  },
  {
    type: 'payment-card', label: 'Payment card-like number',
    re: /\b(?:\d[ -]?){13,19}\b/g,
    validate: value => luhn(value.replace(/\D/g, '')),
  },
];

function luhn(digits) {
  if (!/^\d{13,19}$/.test(digits)) return false;
  let sum = 0;
  let doubleIt = false;
  for (let i = digits.length - 1; i >= 0; i--) {
    let n = Number(digits[i]);
    if (doubleIt) { n *= 2; if (n > 9) n -= 9; }
    sum += n;
    doubleIt = !doubleIt;
  }
  return sum % 10 === 0;
}

export const PERSONAL_DATA_TYPES = DEFINITIONS.map(({ type, label }) => ({ type, label }));

export function findPersonalData(text, { types = null, maxMatches = 5000 } = {}) {
  const input = String(text ?? '');
  const enabled = types ? new Set(types) : null;
  const matches = [];
  for (const definition of DEFINITIONS) {
    if (enabled && !enabled.has(definition.type)) continue;
    definition.re.lastIndex = 0;
    for (const match of input.matchAll(definition.re)) {
      const value = match[0];
      if (definition.validate && !definition.validate(value)) continue;
      matches.push({
        type: definition.type,
        label: definition.label,
        value,
        index: match.index ?? 0,
        length: value.length,
      });
      if (matches.length >= maxMatches) return sortAndDedupe(matches);
    }
  }
  return sortAndDedupe(matches);
}

function sortAndDedupe(matches) {
  const seen = new Set();
  return matches
    .sort((a, b) => a.index - b.index || b.length - a.length || a.type.localeCompare(b.type))
    .filter(match => {
      const key = `${match.type}:${match.index}:${match.length}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}

export function groupPersonalData(matches) {
  const grouped = new Map();
  for (const match of matches) {
    if (!grouped.has(match.type)) grouped.set(match.type, { type: match.type, label: match.label, count: 0, examples: [] });
    const bucket = grouped.get(match.type);
    bucket.count++;
    if (bucket.examples.length < 3) bucket.examples.push(maskPersonalValue(match.value, match.type));
  }
  return [...grouped.values()].sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));
}

export function maskPersonalValue(value, type = '') {
  const text = String(value ?? '');
  if (!text) return '';
  if (type === 'email') {
    const at = text.indexOf('@');
    if (at > 0) return `${text[0]}${'•'.repeat(Math.max(2, Math.min(8, at - 1)))}${text.slice(at)}`;
  }
  if (type === 'uk-postcode') return text.replace(/[A-Z0-9](?=.*[A-Z0-9])/gi, '•');
  const visible = Math.min(4, Math.max(1, Math.floor(text.length / 4)));
  return '•'.repeat(Math.max(3, text.length - visible)) + text.slice(-visible);
}

export function redactDetectedText(text, matches, replacement = '[possible personal data]') {
  const input = String(text ?? '');
  if (!matches?.length) return input;
  const spans = [...matches]
    .sort((a, b) => a.index - b.index || b.length - a.length)
    .filter((match, index, all) => index === 0 || match.index >= all[index - 1].index + all[index - 1].length);
  let out = '';
  let cursor = 0;
  for (const match of spans) {
    out += input.slice(cursor, match.index) + replacement;
    cursor = match.index + match.length;
  }
  return out + input.slice(cursor);
}
