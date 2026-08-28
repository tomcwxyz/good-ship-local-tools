# Sets — product direction

The useful niche here is not “another collection of web utilities”. Sets is a
small, trustworthy alternative to the sites people reach for when they have a
sensitive file, awkward dataset or one-off document job.

## What to optimise for

- **Trust:** understandable local processing and explicit destructive steps.
- **Portability:** every tool can still be one HTML file.
- **Low cognitive load:** one job per tool; useful defaults before advanced options.
- **Correctness over feature count:** especially where a “clean” output could silently damage a file or change data types.
- **Useful in organisations:** common charity/public-interest workflows such as cleaning beneficiary CSVs, redacting evidence, combining PDFs and checking assets before publishing.
- **Composition:** new capabilities should increasingly hand off to each other rather than multiplying unrelated tiles.

## Implemented foundation — 0.2 to 0.9

Sets now has a sealed local-only build model, CSP/network checks, standalone HTML artefacts, reproducible Node 22 installs, release checksums, Chromium/Firefox/WebKit direct-file smoke tests and a tag-gated release workflow.

Product work already covers image metadata cleaning/batch conversion, Office and PDF privacy inspection/reports, raster redaction, CSV/TSV cleaning, data conversion, checksums, secure secret generation, accessibility colour checks, and a page-organising PDF editor.

## 0.10 — final pre-1.0 workflow tranche

### PDF workbench — implemented

The former PDF editor now covers the practical pack-building work that sits between “merge pages” and a full desktop PDF editor:

- select pages visually or by ranges and extract them;
- merge/reorder/rotate/duplicate/remove pages;
- add blank A4/Letter pages and JPEG/PNG pages;
- add page numbers and a simple diagonal watermark/stamp;
- set explicit crop-box margins with a warning that crop boxes do not erase page content;
- optionally flatten form fields before copying pages;
- remove output metadata by default or deliberately set title/author/subject/keywords;
- inspect source form, JavaScript, annotation and signature signals while assembling the pack;
- require acknowledgement before exporting a copy made from digitally signed sources.

This deliberately does **not** promise arbitrary editing of existing PDF text.

### PDF sanitiser — implemented

Structural sanitation is a separate workflow rather than an extension of “metadata cleaning”. The sanitiser embeds each visible source page into a fresh PDF page, so the original document catalog, forms, annotations/links, attachments, JavaScript, metadata and signatures are not carried across.

The limitation is explicit: hidden/invisible/OCR material inside the page content itself may remain because this is a structural rebuild, not raster redaction. Redaction remains the stronger disclosure-removal path.

### Privacy preparation — implemented

- **Data pseudonymiser:** stable per-column pseudonyms, masking, salted SHA-256 fingerprints, column removal and an explicitly separate reversible mapping file.
- **Possible personal-data finder:** cautious pattern matching for common high-confidence structures; it never claims to identify names or all personal data.
- **Publication preflight:** mixed PDF/Office/image/text-like batches produce one local checklist and route flagged files to the appropriate inspector/cleaner.

### Document comparison — implemented

The existing diff can now locally extract text from TXT/Markdown, DOCX and PDF on either side before running the same line/word/character comparison. It remains intentionally text-based: layout, styles, images, comments and tracked-change state require their specialised tools.

### Batch image workbench — already implemented

0.6 already covers the intended batch image workflow: format conversion, aspect-preserving maximum-edge resize, quality controls, unsafe SVG rejection, sequential processing, collision-safe ZIP names and bounded input/output memory.

### Secret generator — implemented

A final small utility before 1.0 covers a recurring developer/operations job without turning Sets into a generic toolbox: generate cryptographically secure Hex, Base64, Base64URL and alphanumeric secrets plus UUID v4 values locally. Presets cover app/session/webhook/key-material use, with explicit strength, ready-to-copy `.env` lines and equivalent terminal commands. Generated values are deliberately not stored or added to a history.

## Candidates after 1.0 — driven by use

These are useful possibilities, not a commitment to keep expanding before release:

### Search-assisted redaction

Use local PDF text extraction to suggest candidate locations for a searched name/reference/email. Every rectangle should still require human confirmation because extracted text and visual layout can diverge. A post-export local verification view would be valuable too.

### Remaining CSV admin work

- rename/drop/reorder columns;
- explicit date normalisation with a chosen target format;
- worker-based parsing if genuinely large-file use appears in testing.

Do not turn the tool into a spreadsheet.

### Installable launcher

A PWA/service-worker layer could cache the hosted Sets collection offline, but the single-file standalone artefact remains the primary portability contract.

### Richer publication queues

Preflight could grow into multi-file inspection queues with low-disclosure aggregate CSV/JSON reports and explicit clean/recheck status. That should follow observed organisational workflows rather than speculative dashboard building.

## Things not to add just because they are easy

Generic calculators, URL encoders, lorem ipsum, timers and similar utilities would dilute the proposition. A new tool should normally have at least one of these properties:

- people currently upload a potentially sensitive file to do it;
- it is surprisingly hard to do safely with built-in software;
- local execution materially improves privacy or organisational confidence;
- it composes naturally with another tool in Sets.

## 1.0 definition

After 0.10, **stop feature expansion** and prove Sets in use. 1.0 should mean:

1. the complete 0.10 standalone set passes source checks, unit tests, production verification and Chromium/Firefox/WebKit direct-file smoke tests;
2. a tagged release has been built through the release workflow and downloadable artefacts/checksums have been tested on real desktop and mobile devices;
3. the launcher is hosted at **good-ship.co.uk/sets/** without weakening the local-only trust model;
4. a small group has used Sets for real document/data work and any serious correctness/usability failures have been fixed;
5. documentation clearly separates metadata cleaning, structural PDF sanitation and raster redaction so users can choose the right disclosure boundary.

The next work after that should come from observed use, not from trying to reach a larger tool count.
