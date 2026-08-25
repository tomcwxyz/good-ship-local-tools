// Safe, deterministic names for locally-generated ZIP archives.
// Browser File.name should normally be a leaf name, but we still strip path
// components/control characters and handle case-insensitive collisions so an
// archive never silently overwrites one selected file with another.
export function uniqueArchiveName(input, used = new Set()) {
  let name = String(input ?? '')
    .replace(/\\/g, '/')
    .split('/')
    .pop()
    .replace(/[\u0000-\u001f\u007f]/g, '_')
    .trim();

  if (!name || name === '.' || name === '..') name = 'file';

  const dot = name.lastIndexOf('.');
  const hasExt = dot > 0 && dot < name.length - 1;
  const stem = hasExt ? name.slice(0, dot) : name;
  const ext = hasExt ? name.slice(dot) : '';

  let candidate = name;
  let n = 2;
  while (used.has(candidate.toLocaleLowerCase('en-GB'))) {
    candidate = `${stem} (${n++})${ext}`;
  }
  used.add(candidate.toLocaleLowerCase('en-GB'));
  return candidate;
}

export function selectBatchFiles(files, {
  maxFiles = 100,
  maxTotalBytes = 300 * 1024 * 1024,
} = {}) {
  const selected = [];
  const skipped = [];
  let totalBytes = 0;

  for (const file of files) {
    const size = Number(file?.size) || 0;
    if (selected.length >= maxFiles || totalBytes + size > maxTotalBytes) {
      skipped.push(file);
      continue;
    }
    selected.push(file);
    totalBytes += size;
  }

  return { selected, skipped, totalBytes };
}
