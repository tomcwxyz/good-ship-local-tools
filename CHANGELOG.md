# Changelog

## 0.3.0 — in progress

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
