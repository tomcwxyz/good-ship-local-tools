# Changelog

## 0.8.0 — in progress

- commit a clean Node 22 npm lockfile and switch CI to reproducible `npm ci` installs with npm caching;
- verify every built standalone HTML file after Vite has finished, not only the source tree;
- fail production verification if an entry gains external script/style loading, active iframe/object/embed content, an unsealed connection policy or unexpected build assets;
- generate `dist/SHA256SUMS.txt` for the launcher and every standalone tool;
- add focused tests for production artefact verification.

## 0.7.0

- add local JSON inspection reports to the Office and PDF privacy inspectors;
- make reports summary-only by default, omitting source filenames and metadata values;
- identify inspected source files with a local SHA-256 fingerprint when Web Crypto is available;
- add explicit opt-ins for including the original filename or metadata values in a report;
- record structural findings, selected cleaning options and completed cleaning actions;
- avoid exposing Office custom-property names in the default summary report;
- move SHA-256 calculation into a reusable tested helper shared with the checksum tool.

## 0.6.0

- add multi-file image conversion while preserving the existing precise single-image workflow;
- apply one batch policy for format, maximum long edge, upscaling and quality while preserving each image's aspect ratio;
- process batch images sequentially and download converted results as a collision-safe ZIP;
- validate SVG safety before decoding in both single and batch paths;
- add 80 MB per-file plus 300 MB combined input and converted-output guardrails;
- flatten transparency onto white for JPEG output and report unsupported browser formats per file;
- add tested batch sizing and explicit image format/MIME helpers.

## 0.5.0

- move PDF redaction to a one-page-at-a-time preview model to avoid retaining every full-resolution page canvas;
- store redaction rectangles as normalised page coordinates so preview zoom and export DPI cannot shift them;
- add PDF page thumbnails, previous/next navigation, active-page state and per-page/total redaction counts;
- add fit/125/150/200% preview zoom with scrollable panning;
- add keyboard-only percentage rectangle entry and Ctrl/Cmd+Z page undo;
- add independent PDF export resolution (96/120/160 dpi) and JPEG/PNG page encoding choices;
- add PNG/JPEG output choices for image redaction, with JPEG flattened onto white;
- export PDF pages sequentially so high-resolution output does not require all rendered pages in memory at once;
- add tested normalised redaction geometry helpers.

## 0.4.0

- extend the CSV cleaner to CSV and TSV with comma/tab/semicolon/pipe delimiter detection and explicit overrides;
- preserve the selected/detected delimiter when downloading cleaned data;
- deduplicate rows using explicitly chosen key columns;
- add literal find/replace restricted to explicitly selected columns, with case-sensitive and whole-cell modes;
- show live replacement and duplicate-removal counts;
- preserve blank source rows until the cleaning option explicitly removes them;
- reject CSV/TSV inputs over 100 MB rather than risking browser memory exhaustion;
- move CSV transforms into a reusable pure library with focused tests.

## 0.3.0

- add Office privacy inspector for DOCX/XLSX/PPTX and macro-enabled OOXML;
- inspect author/editor/company/custom properties separately from comments, tracked changes, notes, hidden sheets, macros, embedded files and external links;
- add pre-decompression OOXML ZIP size/entry guardrails;
- clean selected Office properties and thumbnails without silently changing document content;
- add PDF privacy inspector for Info/XMP metadata, attachments, forms, JavaScript and signatures;
- remove PDF Info/XMP metadata without pdf-lib writing replacement Producer/ModDate values;
- require explicit acknowledgement before rewriting a digitally signed PDF;
- add batch JPEG/PNG metadata inspection and stripping with ZIP output;
- add `fflate` 0.8.3 for local ZIP packaging/decompression.

## 0.2.0

- harden CSP/network-free checks and remove remote fonts;
- expand accessibility colour checker and shared UI accessibility;
- preserve JPEG colour profiles while stripping privacy metadata;
- improve PDF redaction/editor behaviour and CSV encoding handling;
- add SHA-256 checksum tool and dependency-free tests.
