# Local Tools — product direction

The useful niche here is not “another collection of web utilities”. It is a
small, trustworthy alternative to the sites people reach for when they have a
sensitive file, awkward dataset or one-off document job.

## What to optimise for

- **Trust:** understandable local processing and explicit destructive steps.
- **Portability:** every tool can still be one HTML file.
- **Low cognitive load:** one job per tool; useful defaults before advanced
  options.
- **Correctness over feature count:** especially where a “clean” output could
  silently damage a file or change data types.
- **Useful in organisations:** common charity/public-interest workflows such as
  cleaning beneficiary CSVs, redacting evidence, combining PDFs and checking
  assets before publishing.

## 0.2 first pass

- network-free first-party source and CSP on every entry;
- remote fonts removed;
- accessible dropzones, focus states and responsive two-column layouts;
- metadata stripping preserves ICC/Adobe JPEG markers and validates malformed
  data more carefully;
- PDF redaction preserves displayed page size and explains rasterisation;
- PDF editor gains drag reordering, left/right rotation and duplication;
- CSV encoding detection plus safer header/cell cleaning;
- data conversion keeps CSV values as strings by default;
- text diff adds character mode;
- accessibility colour checker adds contextual WCAG thresholds, palette auditing, focus-colour checks, contrast suggestions and colour-vision previews;
- new SHA-256 checksum tool;
- manifest-driven launcher/build and dependency-free tests;
- PDF scripting/eval disabled explicitly; direct dependencies pinned to the current reviewed majors (Vite 8, PDF.js 6, js-yaml 5, jsdiff 9).

## Strong next extensions

### 1. Office metadata cleaner

**High value.** DOCX/XLSX/PPTX are ZIP-based OOXML files and often carry author,
company, revision and custom property data. A local tool could inspect first,
show exactly what will be removed, then rebuild the package.

Guardrails matter: comments, tracked changes and document content are not the
same thing as file properties and should never be removed under a generic
“metadata” action without an explicit choice.

### 2. PDF inspector / metadata cleaner

Show title, author, creator, producer, dates, attachments, forms and JavaScript
before cleaning. This is a better fit than quietly folding it into the PDF
editor because inspection is part of the trust model.

### 3. Batch image clean + convert

The image and metadata tools naturally want multi-file mode: drag a folder/set,
choose one operation, download a ZIP. This probably justifies one small ZIP
library rather than hand-writing archive support.

### 4. Better redaction workflow

Zoom/pan, page thumbnails, keyboard-friendly rectangle selection and output
quality controls. Text-search-assisted redaction could be useful, but should
only suggest locations: automatic redaction can miss text because PDF text
extraction and visual layout are not equivalent.

### 5. CSV operations that match real admin work

- choose columns used for deduplication;
- rename/drop/reorder columns;
- find/replace with preview;
- delimiter choice and TSV support;
- date normalisation with an explicit target format;
- optional worker-based parsing for genuinely large files.

These should remain transparent transformations rather than growing into a
spreadsheet.

### 6. Installable launcher

Add a manifest/service worker for the hosted bundle so all tools can be cached
for offline use. Keep the built standalone HTML files as the primary portable
artefact; PWA support should be additive.

## Things not to add just because they are easy

Generic calculators, URL encoders, lorem ipsum, timers and similar utilities
would dilute the proposition. A new tool should normally have at least one of
these properties:

- people currently upload a potentially sensitive file to do it;
- it is surprisingly hard to do safely with built-in software;
- local execution materially improves privacy or organisational confidence;
- it composes naturally with another tool in this collection.

## Repository / release approach

Before making the new GitHub repo public:

1. settle the code/content licence split;
2. run `npm run check`, `npm test` and `npm run build` on a clean install;
3. smoke-test generated standalone HTML in Chromium and Firefox/Safari if
   available;
4. decide whether the repo is the product source (`local-tools`) or a Good Ship
   umbrella repo with releases mirrored to the website;
5. attach `dist/` or a ZIP of standalone tools to tagged releases;
6. keep GitHub Actions intentionally small: check → test → build, with releases
   only on tags.
