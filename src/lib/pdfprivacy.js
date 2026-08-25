import { PDFDocument, PDFName, PDFRef } from 'pdf-lib';

export const STANDARD_PDF_INFO_KEYS = ['Title', 'Author', 'Subject', 'Keywords', 'Creator', 'Producer', 'CreationDate', 'ModDate', 'Trapped'];

export async function cleanPdfDocumentMetadata(bytes) {
  const doc = await PDFDocument.load(bytes, { updateMetadata: false });
  const removed = [];

  const infoRef = doc.context.trailerInfo.Info;
  if (infoRef) {
    const info = doc.context.lookup(infoRef);
    if (info?.keys && info?.delete) {
      const keys = [...info.keys()];
      for (const key of keys) info.delete(key);
      if (keys.length) removed.push('Document information dictionary');
    }
    if (infoRef instanceof PDFRef) doc.context.delete(infoRef);
    doc.context.trailerInfo.Info = undefined;
  }

  const metadataName = PDFName.of('Metadata');
  const metadataRef = doc.catalog.get(metadataName);
  if (metadataRef) {
    doc.catalog.delete(metadataName);
    if (metadataRef instanceof PDFRef) doc.context.delete(metadataRef);
    removed.push('XMP metadata stream');
  }

  // Avoid pdf-lib creating fresh Producer/ModDate entries during this cleaning pass.
  const out = await doc.save({ useObjectStreams: false });
  return { bytes: out, removed };
}
