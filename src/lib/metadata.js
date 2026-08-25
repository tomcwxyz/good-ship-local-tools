/* Pure, dependency-free metadata processing used by the browser tool and tests. */

export function processJPEG(buf) {
  const b = new Uint8Array(buf);
  if (b.length < 4 || b[0] !== 0xff || b[1] !== 0xd8) return null;

  const chunks = [b.slice(0, 2)];
  const removed = [];
  let exif = null;
  let i = 2;

  while (i < b.length) {
    if (b[i] !== 0xff) {
      // Entropy-coded data should only appear after SOS. Treat anything else as malformed.
      throw new Error('Malformed JPEG marker stream.');
    }

    while (i < b.length && b[i] === 0xff) i++;
    if (i >= b.length) break;
    const marker = b[i];
    const markerStart = i - 1;

    if (marker === 0xda) {
      chunks.push(b.slice(markerStart));
      i = b.length;
      break;
    }

    if (marker === 0xd9 || (marker >= 0xd0 && marker <= 0xd7) || marker === 0x01) {
      chunks.push(b.slice(markerStart, i + 1));
      i += 1;
      continue;
    }

    if (i + 2 >= b.length) throw new Error('Malformed JPEG segment length.');
    const len = (b[i + 1] << 8) | b[i + 2];
    if (len < 2) throw new Error('Malformed JPEG segment length.');
    const end = markerStart + 2 + len;
    if (end > b.length) throw new Error('JPEG segment extends beyond the file.');

    // Keep APP0/JFIF, APP2/ICC and APP14/Adobe. Those markers can be required for
    // faithful colour interpretation. Strip the application markers commonly used
    // for EXIF/XMP/IPTC/vendor metadata, plus comments.
    const strip = marker === 0xfe ||
      marker === 0xe1 ||
      (marker >= 0xe3 && marker <= 0xed) ||
      marker === 0xef;

    if (strip) {
      if (marker === 0xe1 && !exif) {
        try { exif = readExif(b, i + 3); } catch { exif = { present: true }; }
      }
      removed.push({ type: markerName(marker), size: end - markerStart });
    } else {
      chunks.push(b.slice(markerStart, end));
    }
    i = end;
  }

  const total = chunks.reduce((n, c) => n + c.length, 0);
  const bytes = new Uint8Array(total);
  let off = 0;
  for (const c of chunks) { bytes.set(c, off); off += c.length; }
  return { bytes, removed, exif };
}

function markerName(m) {
  if (m === 0xe1) return 'APP1 (Exif/XMP)';
  if (m === 0xed) return 'APP13 (IPTC/Photoshop)';
  if (m === 0xfe) return 'Comment';
  return 'APP' + (m - 0xe0) + ' (application metadata)';
}

function readExif(b, start) {
  if (start + 10 >= b.length) return { present: true };
  const sig = String.fromCharCode(b[start], b[start + 1], b[start + 2], b[start + 3]);
  if (sig !== 'Exif') return { present: true };
  const tiff = start + 6;
  const dv = new DataView(b.buffer, b.byteOffset, b.byteLength);
  const byteOrder = dv.getUint16(tiff);
  if (byteOrder !== 0x4949 && byteOrder !== 0x4d4d) return { present: true };
  const little = byteOrder === 0x4949;
  const u16 = o => { bounds(o, 2, b.length); return dv.getUint16(o, little); };
  const u32 = o => { bounds(o, 4, b.length); return dv.getUint32(o, little); };
  const sizes = { 1:1,2:1,3:2,4:4,5:8,7:1,9:4,10:8 };
  const readIFD = off => {
    bounds(off, 2, b.length);
    const n = u16(off); const out = {};
    bounds(off + 2, n * 12, b.length);
    for (let k = 0; k < n; k++) {
      const e = off + 2 + k * 12;
      const tag = u16(e), type = u16(e + 2), count = u32(e + 4);
      const total = (sizes[type] || 1) * count;
      const valOff = total <= 4 ? e + 8 : tiff + u32(e + 8);
      bounds(valOff, Math.min(total, 32), b.length);
      out[tag] = { type, count, valOff };
    }
    return out;
  };
  const ascii = t => {
    let s = '';
    const max = Math.min(t.count, 512);
    for (let j = 0; j < max; j++) {
      const ch = b[t.valOff + j];
      if (!ch) break;
      s += String.fromCharCode(ch);
    }
    return s.trim();
  };
  const rat = o => u32(o) / (u32(o + 4) || 1);
  const ifd0 = readIFD(tiff + u32(tiff + 4));
  const info = { present: true };
  if (ifd0[0x010f]) info.make = ascii(ifd0[0x010f]);
  if (ifd0[0x0110]) info.model = ascii(ifd0[0x0110]);
  if (ifd0[0x0132]) info.dateTime = ascii(ifd0[0x0132]);
  if (ifd0[0x8825]) {
    try {
      const gps = readIFD(tiff + u32(ifd0[0x8825].valOff));
      const dms = t => rat(t.valOff) + rat(t.valOff + 8) / 60 + rat(t.valOff + 16) / 3600;
      if (gps[2] && gps[4]) {
        let lat = dms(gps[2]), lon = dms(gps[4]);
        if (gps[1] && String.fromCharCode(b[gps[1].valOff]) === 'S') lat = -lat;
        if (gps[3] && String.fromCharCode(b[gps[3].valOff]) === 'W') lon = -lon;
        info.gps = { lat: lat.toFixed(5), lon: lon.toFixed(5) };
      } else info.gps = { present: true };
    } catch { info.gps = { present: true }; }
  }
  return info;
}

function bounds(off, len, total) {
  if (!Number.isInteger(off) || off < 0 || off + len > total) throw new Error('EXIF value is out of bounds.');
}

export function processPNG(buf) {
  const b = new Uint8Array(buf);
  const sig = [137,80,78,71,13,10,26,10];
  if (b.length < 20) return null;
  for (let k = 0; k < 8; k++) if (b[k] !== sig[k]) return null;

  const strip = new Set(['tEXt','zTXt','iTXt','eXIf','tIME']);
  const chunks = [b.slice(0, 8)];
  const removed = [];
  let i = 8;
  const dv = new DataView(buf);

  while (i + 12 <= b.length) {
    const len = dv.getUint32(i);
    const type = String.fromCharCode(b[i+4],b[i+5],b[i+6],b[i+7]);
    const chunkLen = 12 + len;
    if (chunkLen < 12 || i + chunkLen > b.length) throw new Error('Malformed PNG chunk.');
    const chunk = b.slice(i, i + chunkLen);
    if (strip.has(type)) removed.push({ type: pngChunkName(type), size: chunkLen });
    else chunks.push(chunk);
    i += chunkLen;
    if (type === 'IEND') break;
  }

  if (!chunks.some(c => c.length >= 8 && String.fromCharCode(c[4],c[5],c[6],c[7]) === 'IEND')) {
    throw new Error('PNG is missing its end marker.');
  }

  const total = chunks.reduce((n, c) => n + c.length, 0);
  const bytes = new Uint8Array(total);
  let off = 0;
  for (const c of chunks) { bytes.set(c, off); off += c.length; }
  return { bytes, removed, exif: null };
}

function pngChunkName(type) {
  if (type === 'eXIf') return 'eXIf (Exif)';
  if (type === 'tIME') return 'tIME (modified time)';
  return type + ' (text metadata)';
}
