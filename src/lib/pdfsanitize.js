import { PDFDocument, PDFName } from 'pdf-lib';

export async function rebuildPdfStructure(bytes) {
  const input = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  const source = await PDFDocument.load(input, { updateMetadata:false });
  const out = await PDFDocument.create({ updateMetadata:false });
  const pageCount = source.getPageCount();

  for (let i = 0; i < pageCount; i++) {
    const sourcePage = source.getPage(i);
    const { width, height } = sourcePage.getSize();

    // Valid blank PDF pages may omit /Contents entirely. pdf-lib cannot
    // embed those pages, but their visible result is a blank page. Preserve
    // the page dimensions without hiding any other embedding failure.
    if (!sourcePage.node.has(PDFName.of('Contents'))) {
      out.addPage([width, height]);
      continue;
    }

    const embedded = (await out.embedPdf(input, [i]))[0];
    const page = out.addPage([width, height]);
    page.drawPage(embedded, { x:0, y:0, width, height });
  }

  const output = await out.save({ useObjectStreams:false });
  return {
    bytes: output,
    pages: pageCount,
    removedByConstruction: [
      'document metadata and XMP',
      'attachments and embedded-file name trees',
      'interactive form fields',
      'annotations, comments and links',
      'document JavaScript/actions',
      'digital signatures',
    ],
  };
}
