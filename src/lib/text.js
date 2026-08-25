export function decodeTextBuffer(buffer, requested = 'auto') {
  const bytes = new Uint8Array(buffer);
  let encoding = requested;

  if (requested === 'auto') {
    if (bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf) encoding = 'utf-8';
    else if (bytes[0] === 0xff && bytes[1] === 0xfe) encoding = 'utf-16le';
    else if (bytes[0] === 0xfe && bytes[1] === 0xff) encoding = 'utf-16be';
    else {
      try {
        new TextDecoder('utf-8', { fatal: true }).decode(bytes);
        encoding = 'utf-8';
      } catch {
        encoding = 'windows-1252';
      }
    }
  }

  let text = new TextDecoder(encoding).decode(bytes).replace(/^\uFEFF/, '');
  if (encoding === 'windows-1252') text = normaliseWindows1252Controls(text);
  return { text, encoding };
}

function normaliseWindows1252Controls(text) {
  const table = {
    0x80:'€',0x82:'‚',0x83:'ƒ',0x84:'„',0x85:'…',0x86:'†',0x87:'‡',0x88:'ˆ',0x89:'‰',0x8a:'Š',0x8b:'‹',0x8c:'Œ',
    0x8e:'Ž',0x91:'‘',0x92:'’',0x93:'“',0x94:'”',0x95:'•',0x96:'–',0x97:'—',0x98:'˜',0x99:'™',0x9a:'š',0x9b:'›',0x9c:'œ',0x9e:'ž',0x9f:'Ÿ',
  };
  return text.replace(/[\u0080-\u009f]/g, ch => table[ch.charCodeAt(0)] ?? ch);
}

