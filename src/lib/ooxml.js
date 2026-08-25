const decoder = new TextDecoder('utf-8', { fatal: false });
const encoder = new TextEncoder();

const CORE_FIELDS = [
  ['title', 'title'], ['subject', 'subject'], ['creator', 'creator'], ['keywords', 'keywords'],
  ['description', 'description'], ['lastModifiedBy', 'lastModifiedBy'], ['revision', 'revision'],
  ['created', 'created'], ['modified', 'modified'], ['category', 'category'], ['contentStatus', 'contentStatus'],
];

function decodeEntities(value = '') {
  return value
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'").replace(/&amp;/g, '&')
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)));
}

function localTagPattern(name) {
  return `(?:[A-Za-z_][\\w.-]*:)?${name}`;
}

export function xmlValue(xml, name) {
  if (!xml) return '';
  const tag = localTagPattern(name);
  const match = xml.match(new RegExp(`<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${tag}>`, 'i'));
  if (!match) return '';
  return decodeEntities(match[1].replace(/<[^>]+>/g, '').trim());
}

export function removeXmlElements(xml, names) {
  let out = xml;
  for (const name of names) {
    const tag = localTagPattern(name);
    out = out.replace(new RegExp(`\\s*<${tag}(?:\\s[^>]*)?>[\\s\\S]*?<\\/${tag}>`, 'gi'), '');
    out = out.replace(new RegExp(`\\s*<${tag}(?:\\s[^>]*)?\\s*\\/>`, 'gi'), '');
  }
  return out;
}

function parseCustomProperties(xml) {
  if (!xml) return [];
  const props = [];
  const re = /<property\b([^>]*)>([\s\S]*?)<\/property>/gi;
  for (const m of xml.matchAll(re)) {
    const name = /\bname="([^"]*)"/i.exec(m[1])?.[1] || /\bname='([^']*)'/i.exec(m[1])?.[1] || 'Custom property';
    const value = decodeEntities((m[2].match(/<(?:\w+:)?[A-Za-z0-9_.-]+(?:\s[^>]*)?>([\s\S]*?)<\/(?:\w+:)?[A-Za-z0-9_.-]+>/)?.[1] || '').replace(/<[^>]+>/g, '').trim());
    props.push({ name: decodeEntities(name), value });
  }
  return props;
}

function clearCustomProperties(xml) {
  if (!xml) return xml;
  return xml.replace(/(<Properties\b[^>]*>)[\s\S]*?(<\/Properties>)/i, '$1$2');
}

function countMatches(text, re) {
  return (text.match(re) || []).length;
}

function entriesMatching(names, re) {
  return names.filter(name => re.test(name));
}

export function inspectZipCentralDirectory(buffer, {
  maxEntries = 5000,
  maxUncompressedBytes = 256 * 1024 * 1024,
  maxEntryBytes = 96 * 1024 * 1024,
} = {}) {
  const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let eocd = -1;
  const floor = Math.max(0, bytes.length - 65557);
  for (let i = bytes.length - 22; i >= floor; i--) {
    if (view.getUint32(i, true) === 0x06054b50) { eocd = i; break; }
  }
  if (eocd < 0) throw new Error('This does not look like a standard ZIP/Office package.');
  const entries = view.getUint16(eocd + 10, true);
  const centralSize = view.getUint32(eocd + 12, true);
  const centralOffset = view.getUint32(eocd + 16, true);
  if (entries === 0xffff || centralSize === 0xffffffff || centralOffset === 0xffffffff) {
    throw new Error('ZIP64 Office packages are not supported by this tool.');
  }
  if (entries > maxEntries) throw new Error(`Package has too many entries (${entries.toLocaleString()}).`);
  if (centralOffset + centralSize > bytes.length) throw new Error('ZIP directory is malformed.');

  const files = [];
  let offset = centralOffset;
  let totalUncompressed = 0;
  for (let i = 0; i < entries; i++) {
    if (offset + 46 > bytes.length || view.getUint32(offset, true) !== 0x02014b50) throw new Error('ZIP directory is malformed.');
    const compressed = view.getUint32(offset + 20, true);
    const uncompressed = view.getUint32(offset + 24, true);
    const nameLen = view.getUint16(offset + 28, true);
    const extraLen = view.getUint16(offset + 30, true);
    const commentLen = view.getUint16(offset + 32, true);
    if (uncompressed === 0xffffffff || compressed === 0xffffffff) throw new Error('ZIP64 entries are not supported by this tool.');
    if (uncompressed > maxEntryBytes) throw new Error('Package contains an unusually large internal file and was not opened.');
    totalUncompressed += uncompressed;
    if (totalUncompressed > maxUncompressedBytes) throw new Error('Package expands to more than 256 MB and was not opened.');
    const nameStart = offset + 46;
    const nameEnd = nameStart + nameLen;
    if (nameEnd > bytes.length) throw new Error('ZIP filename table is malformed.');
    const name = decoder.decode(bytes.subarray(nameStart, nameEnd));
    const normalised = name.replace(/\\/g, '/');
    if (normalised.startsWith('/') || /^[A-Za-z]:\//.test(normalised) || normalised.split('/').includes('..')) {
      throw new Error('Package contains an unsafe internal path and was not opened.');
    }
    files.push({ name, compressed, uncompressed });
    offset = nameEnd + extraLen + commentLen;
  }
  return { entries, totalUncompressed, files };
}


export function detectOfficeKind(files) {
  if (files['word/document.xml']) return 'Word document';
  if (files['xl/workbook.xml']) return 'Excel workbook';
  if (files['ppt/presentation.xml']) return 'PowerPoint presentation';
  return null;
}

export function inspectOfficePackage(files) {
  const names = Object.keys(files);
  const text = name => files[name] ? decoder.decode(files[name]) : '';
  const coreXml = text('docProps/core.xml');
  const appXml = text('docProps/app.xml');
  const customXml = text('docProps/custom.xml');
  const core = Object.fromEntries(CORE_FIELDS.map(([key, tag]) => [key, xmlValue(coreXml, tag)]).filter(([, v]) => v));
  const app = {};
  for (const key of ['Application', 'AppVersion', 'Company', 'Manager', 'Template', 'TotalTime']) {
    const value = xmlValue(appXml, key);
    if (value) app[key] = value;
  }
  const custom = parseCustomProperties(customXml);

  let trackedChanges = 0;
  let externalLinks = 0;
  let hiddenSheets = 0;
  for (const name of names) {
    if (/\.xml$/i.test(name) && /^(word|xl|ppt)\//i.test(name) && files[name].length < 12 * 1024 * 1024) {
      const xml = text(name);
      trackedChanges += countMatches(xml, /<w:(?:ins|del|moveFrom|moveTo)\b/gi);
      if (/xl\/workbook\.xml$/i.test(name)) hiddenSheets += countMatches(xml, /<sheet\b[^>]*\bstate=["'](?:hidden|veryHidden)["']/gi);
    }
    if (/\.rels$/i.test(name) && files[name].length < 4 * 1024 * 1024) {
      externalLinks += countMatches(text(name), /\bTargetMode=["']External["']/gi);
    }
  }

  return {
    core, app, custom,
    signals: {
      comments: entriesMatching(names, /(?:^|\/)(?:comments?[^\/]*\.xml|commentAuthors\.xml|persons\.xml|threadedComments?[^\/]*\.xml)$/i).length,
      trackedChanges,
      notes: entriesMatching(names, /^ppt\/notesSlides\/notesSlide\d+\.xml$/i).length,
      hiddenSheets,
      macros: entriesMatching(names, /(?:^|\/)vbaProject\.bin$/i).length,
      embeddedFiles: entriesMatching(names, /\/(?:embeddings|embeddedFiles)\//i).length,
      externalLinks,
      thumbnail: Boolean(files['docProps/thumbnail.jpeg'] || files['docProps/thumbnail.jpg'] || files['docProps/thumbnail.png']),
    },
  };
}

export function cleanOfficePackage(files, {
  removeCore = true,
  removeDescriptive = false,
  removeCompany = true,
  removeCustom = true,
  removeThumbnail = true,
} = {}) {
  const out = Object.fromEntries(Object.entries(files).map(([name, bytes]) => [name, bytes.slice()]));
  const changed = [];

  if (removeCore && out['docProps/core.xml']) {
    const xml = decoder.decode(out['docProps/core.xml']);
    const cleaned = removeXmlElements(xml, ['creator', 'lastModifiedBy', 'revision', 'created', 'modified']);
    if (cleaned !== xml) { out['docProps/core.xml'] = encoder.encode(cleaned); changed.push('Author, editor and revision/date properties'); }
  }
  if (removeDescriptive && out['docProps/core.xml']) {
    const xml = decoder.decode(out['docProps/core.xml']);
    const cleaned = removeXmlElements(xml, ['title', 'subject', 'keywords', 'description', 'category', 'contentStatus']);
    if (cleaned !== xml) { out['docProps/core.xml'] = encoder.encode(cleaned); changed.push('Title, subject, description and keyword properties'); }
  }
  if (removeCompany && out['docProps/app.xml']) {
    const xml = decoder.decode(out['docProps/app.xml']);
    const cleaned = removeXmlElements(xml, ['Company', 'Manager', 'Template']);
    if (cleaned !== xml) { out['docProps/app.xml'] = encoder.encode(cleaned); changed.push('Company, manager and template properties'); }
  }
  if (removeCustom && out['docProps/custom.xml']) {
    const xml = decoder.decode(out['docProps/custom.xml']);
    const cleaned = clearCustomProperties(xml);
    if (cleaned !== xml) { out['docProps/custom.xml'] = encoder.encode(cleaned); changed.push('Custom document properties'); }
  }
  if (removeThumbnail) {
    let removedThumbnail = false;
    for (const name of ['docProps/thumbnail.jpeg', 'docProps/thumbnail.jpg', 'docProps/thumbnail.png']) {
      if (out[name]) { delete out[name]; removedThumbnail = true; }
    }
    if (removedThumbnail) {
      if (out['_rels/.rels']) {
        const xml = decoder.decode(out['_rels/.rels']);
        const cleaned = xml.replace(/\s*<Relationship\b(?=[^>]*\bType=["'][^"']*\/metadata\/thumbnail["'])[^>]*\/?>/gi, '');
        out['_rels/.rels'] = encoder.encode(cleaned);
      }
      if (out['[Content_Types].xml']) {
        const xml = decoder.decode(out['[Content_Types].xml']);
        const cleaned = xml.replace(/\s*<Override\b(?=[^>]*\bPartName=["']\/docProps\/thumbnail\.(?:jpe?g|png)["'])[^>]*\/?>/gi, '');
        out['[Content_Types].xml'] = encoder.encode(cleaned);
      }
      changed.push('Embedded document thumbnail');
    }
  }
  return { files: out, changed: [...new Set(changed)] };
}
