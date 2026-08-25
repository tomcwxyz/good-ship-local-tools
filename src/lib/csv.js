export function normaliseCsvHeaders(fields, { trim = true } = {}) {
  const used = new Map();
  const renamed = new Map();
  const output = [];

  for (const original of fields || []) {
    const raw = String(original ?? '');
    const base = (trim ? raw.trim() : raw) || 'column';
    const key = base.toLocaleLowerCase('en-GB');
    const count = (used.get(key) || 0) + 1;
    used.set(key, count);
    const next = count === 1 ? base : `${base} (${count})`;
    renamed.set(original, next);
    output.push(next);
  }

  return { fields: output, renamed };
}

export function replaceLiteral(value, find, replacement = '', {
  caseSensitive = false,
  wholeCell = false,
} = {}) {
  if (typeof value !== 'string' || !find) return { value, count: 0 };

  if (wholeCell) {
    const matches = caseSensitive
      ? value === find
      : value.toLocaleLowerCase('en-GB') === find.toLocaleLowerCase('en-GB');
    return matches ? { value: replacement, count: 1 } : { value, count: 0 };
  }

  if (caseSensitive) {
    let count = 0;
    let start = 0;
    let out = '';
    while (true) {
      const index = value.indexOf(find, start);
      if (index < 0) break;
      out += value.slice(start, index) + replacement;
      start = index + find.length;
      count++;
    }
    return count ? { value: out + value.slice(start), count } : { value, count: 0 };
  }

  const escaped = find.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const re = new RegExp(escaped, 'giu');
  let count = 0;
  const next = value.replace(re, () => { count++; return replacement; });
  return { value: next, count };
}

export function cleanCsvData(data, sourceFields, {
  trimCells = true,
  trimHeaders = true,
  dropEmptyRows = true,
  dropEmptyCols = false,
  dedupe = false,
  dedupeFields = [],
  findReplace = null,
} = {}) {
  const source = [...(sourceFields || [])];
  const headerInfo = normaliseCsvHeaders(source, { trim: trimHeaders });
  let fields = headerInfo.fields;
  let rows = (data || []).map(row => Object.fromEntries(
    source.map((field, i) => [fields[i], row?.[field] ?? '']),
  ));

  if (trimCells) {
    rows = rows.map(row => Object.fromEntries(
      fields.map(field => {
        const value = row[field];
        return [field, typeof value === 'string' ? value.trim() : value];
      }),
    ));
  }

  if (dropEmptyRows) {
    rows = rows.filter(row => fields.some(field => row[field] !== '' && row[field] != null));
  }

  if (dropEmptyCols) {
    fields = fields.filter(field => rows.some(row => row[field] !== '' && row[field] != null));
    rows = rows.map(row => Object.fromEntries(fields.map(field => [field, row[field] ?? ''])));
  }

  let replacements = 0;
  if (findReplace?.find) {
    const requested = Array.isArray(findReplace.fields)
      ? new Set(findReplace.fields)
      : new Set(fields);
    const targets = fields.filter(field => requested.has(field));
    rows = rows.map(row => {
      const next = { ...row };
      for (const field of targets) {
        const result = replaceLiteral(next[field], findReplace.find, findReplace.replace ?? '', {
          caseSensitive: Boolean(findReplace.caseSensitive),
          wholeCell: Boolean(findReplace.wholeCell),
        });
        next[field] = result.value;
        replacements += result.count;
      }
      return next;
    });
  }

  let duplicatesRemoved = 0;
  if (dedupe) {
    const keys = Array.isArray(dedupeFields)
      ? dedupeFields.filter(field => fields.includes(field))
      : fields;
    if (keys.length) {
      const seen = new Set();
      rows = rows.filter(row => {
        const key = JSON.stringify(keys.map(field => row[field] ?? ''));
        if (seen.has(key)) { duplicatesRemoved++; return false; }
        seen.add(key);
        return true;
      });
    }
  }

  return {
    rows,
    fields,
    stats: { replacements, duplicatesRemoved },
  };
}

export const DELIMITERS = [
  { value: 'auto', label: 'Auto-detect' },
  { value: ',', label: 'Comma (,)' },
  { value: '\t', label: 'Tab (TSV)' },
  { value: ';', label: 'Semicolon (;)' },
  { value: '|', label: 'Pipe (|)' },
];

export function delimiterLabel(delimiter) {
  if (delimiter === '\t') return 'tab';
  if (delimiter === ',') return 'comma';
  if (delimiter === ';') return 'semicolon';
  if (delimiter === '|') return 'pipe';
  return delimiter || 'unknown';
}
