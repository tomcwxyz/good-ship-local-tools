# Changelog

## 0.4.0 — in progress

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
