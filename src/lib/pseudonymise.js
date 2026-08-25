function slug(value) {
  return String(value ?? 'field').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 18) || 'field';
}

export function normaliseColumnActions(fields, actions = {}) {
  return Object.fromEntries(fields.map(field => [field, actions[field] || 'keep']));
}

export function stablePseudonymMaps(rows, fields, actions, { prefix = 'P' } = {}) {
  const maps = new Map();
  for (const field of fields) {
    if (actions[field] !== 'pseudonymise') continue;
    const map = new Map();
    let counter = 1;
    for (const row of rows) {
      const raw = String(row?.[field] ?? '').trim();
      if (!raw || map.has(raw)) continue;
      map.set(raw, `${prefix}-${slug(field)}-${String(counter++).padStart(4, '0')}`);
    }
    maps.set(field, map);
  }
  return maps;
}

export function maskCell(value, { reveal = 4 } = {}) {
  const text = String(value ?? '');
  if (!text) return '';
  const visible = Math.min(Math.max(0, reveal), text.length);
  return `${'•'.repeat(Math.max(1, text.length - visible))}${text.slice(-visible)}`;
}

export async function transformRows(rows, fields, actions, {
  prefix = 'P',
  hashFn = null,
  hashSalt = '',
  hashLength = 16,
} = {}) {
  const resolved = normaliseColumnActions(fields, actions);
  const maps = stablePseudonymMaps(rows, fields, resolved, { prefix });
  const outputFields = fields.filter(field => resolved[field] !== 'remove');
  const mapping = [];

  const transformed = [];
  for (const row of rows) {
    const next = {};
    for (const field of outputFields) {
      const value = String(row?.[field] ?? '');
      const action = resolved[field];
      if (action === 'pseudonymise') {
        const replacement = value.trim() ? maps.get(field)?.get(value.trim()) || '' : '';
        next[field] = replacement;
      } else if (action === 'mask') {
        next[field] = maskCell(value);
      } else if (action === 'hash') {
        if (!hashFn) throw new Error('Hashing is unavailable in this browser context.');
        next[field] = value ? (await hashFn(`${hashSalt}\u0000${value}`)).slice(0, Math.max(8, Math.min(64, hashLength))) : '';
      } else {
        next[field] = value;
      }
    }
    transformed.push(next);
  }

  for (const [field, map] of maps) {
    for (const [original, pseudonym] of map) mapping.push({ field, pseudonym, original });
  }

  return { rows: transformed, fields: outputFields, mapping, actions: resolved };
}

export function mappingRowsToCsvData(mapping) {
  return mapping.map(({ field, pseudonym, original }) => ({ field, pseudonym, original }));
}
