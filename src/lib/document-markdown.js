export const MAX_DOCUMENT_BYTES = 60 * 1024 * 1024;

export function markdownFilename(filename) {
  const name = String(filename || 'document').trim() || 'document';
  const index = name.lastIndexOf('.');
  const base = index > 0 ? name.slice(0, index) : name;
  return `${base || 'document'}.md`;
}

export function markdownStats(markdown) {
  const text = String(markdown || '');
  const lines = text ? text.split(/\r?\n/u).length : 0;
  const words = (text.trim().match(/\S+/gu) || []).length;
  return { characters:text.length, lines, words };
}

export function describeAnydocError(error) {
  const code = error && typeof error === 'object' ? error.code : null;

  if (code === 'needsOcr') {
    const pages = Array.isArray(error.pages) ? error.pages.filter(Number.isInteger) : [];
    const pageCount = Number.isInteger(error.pageCount) ? error.pageCount : null;
    const pageLabel = pages.length ? `Page${pages.length === 1 ? '' : 's'} ${pages.join(', ')}` : 'One or more pages';
    return `${pageLabel}${pageCount ? ` of ${pageCount}` : ''} need OCR. Sets will not upload the PDF for hosted OCR; use a text-based copy or a local OCR workflow instead.`;
  }

  if (code === 'encrypted') return 'This file is encrypted or password-protected. Remove the protection locally before converting it.';
  if (code === 'unsupported') return 'This file format is not supported, or the file does not contain extractable document content.';
  if (code === 'malformed') return 'The document structure is damaged or incomplete enough that a reliable Markdown copy could not be produced.';
  if (code === 'resourceLimit') return 'The document crossed a parser safety limit and was not converted.';
  if (code === 'missingPart') return 'A required part of the document package is missing, so a complete Markdown copy could not be produced.';

  return error instanceof Error && error.message
    ? error.message
    : 'The document could not be converted.';
}
