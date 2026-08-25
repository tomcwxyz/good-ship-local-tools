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

## 0.3 privacy-inspection tranche

### Office metadata cleaner — implemented

**High value.** DOCX/XLSX/PPTX are ZIP-based OOXML files and often carry author,
company, revision and custom property data. A local tool could inspect first,
show exactly what will be removed, then rebuild the package.

Guardrails matter: comments, tracked changes and document content are not the
same thing as file properties and should never be removed under a generic
“metadata” action without an explicit choice.

### PDF inspector / metadata cleaner — implemented

Show title, author, creator, producer, dates, attachments, forms and JavaScript
before cleaning. This is a better fit than quietly folding it into the PDF
editor because inspection is part of the trust model.

### Batch image clean + convert — implemented

The metadata stripper supports multi-file mode (up to 100 files) with ZIP output using `fflate`. 0.6 extends the image converter with a shared format/maximum-edge/upscaling/quality policy, sequential processing, per-file failures and bounded ZIP output while keeping the precise single-image controls.

## Strong next extensions

### 1. Better redaction workflow — core workflow implemented in 0.5

0.5 adds zoom/scroll panning, PDF page thumbnails/navigation, keyboard-entered
percentage rectangles, per-page/total counts, independent export DPI/encoding,
and a one-page-at-a-time render model. Redaction rectangles are stored as
normalised page coordinates so changing preview/export resolution cannot move
them.

Still useful: text-search-assisted redaction, but it should only **suggest**
locations. Automatic redaction can miss text because PDF text extraction and
visual layout are not equivalent. A future version could also add a stronger
post-export verification view that reopens the generated file locally for a
final visual check.

### 2. CSV operations that match real admin work

Completed in 0.4:

- choose columns used for deduplication;
- delimiter/TSV support;
- scoped literal find/replace with a preview count.

Still useful:

- rename/drop/reorder columns;
- date normalisation with an explicit target format;
- optional worker-based parsing for genuinely large files.

These should remain transparent transformations rather than growing into a
spreadsheet.

### 3. Installable launcher

Add a manifest/service worker for the hosted bundle so all tools can be cached
for offline use. Keep the built standalone HTML files as the primary portable
artefact; PWA support should be additive.

### 4. Deeper PDF sanitation (explicit, not implied)

The PDF privacy inspector now reports attachments, form fields, JavaScript and signatures, but metadata cleaning deliberately leaves them untouched. A later advanced mode could remove attachments and document/page JavaScript with a before/after report. It should remain separate from metadata cleaning because structural PDF sanitation can break forms, signatures and interactive documents.

### 5. Office review workflow

Add optional export of an inspection report (JSON/CSV) for teams reviewing many files before publication, and consider a deliberately separate “remove comments/accept tracked changes” workflow only if it can be made predictable across Word/Excel/PowerPoint.

## Things not to add just because they are easy

Generic calculators, URL encoders, lorem ipsum, timers and similar utilities
would dilute the proposition. A new tool should normally have at least one of
these properties:

- people currently upload a potentially sensitive file to do it;
- it is surprisingly hard to do safely with built-in software;
- local execution materially improves privacy or organisational confidence;
- it composes naturally with another tool in this collection.

## Release approach

The public repository is now the canonical source and clean GitHub Actions builds are the release gate. Before the first tagged release:

1. settle the code/content licence split;
2. add a committed lockfile from a clean Node 22 install;
3. smoke-test generated standalone HTML in Chromium and at least one WebKit/Firefox browser;
4. attach the built `dist/` ZIP to tagged releases;
5. keep GitHub Actions intentionally small: check → test → build, with release publication only on tags.
