# Sets

**Small, private tools for repeatable work.**

Sets is a collection of local-first browser tools for file, document and data jobs that are too often handed to random websites. Files and tool content are processed on the device. Standalone/local builds contain no network calls, analytics, cookies or remote fonts; the hosted `good-ship.co.uk/sets` build adds privacy-friendly Plausible pageview analytics only, and never sends tool inputs or file contents.

Each tool builds as a **single self-contained HTML file**. You can host the whole launcher, or hand somebody one tool that opens directly in a modern browser.

## Why “Sets”?

The name came while spending a day in Rotterdam , whiling away drinking coffee and watching surfers on Rotterdam’s man-made wave. Repeated and controllable, rhythmical: a controlled wave arrives, you drop in and round it goes again. Repeatable, useful, predictable.

My mind wandered to the type of repeatable things that I and others often need. And so these tools were born.  A **set** is a group of waves, a collection of tools, and a small repeatable routine. Sets is for the jobs you need to do again and again — inspect a file, clean a dataset, rebuild a PDF, strip metadata, compare documents — without turning each one into a new service, account or upload.

Sets is made by **The Good Ship**.

## Tools

| Tool | What it does | Important behaviour |
|------|--------------|--------------------|
| Publication preflight | Checks mixed batches of PDF, Office, image and text-like files before sharing | Flags metadata, Office hidden/review features, PDF interactive features, image metadata and common personal-data patterns; it is a checklist, not a safety certificate. |
| Possible personal-data finder | Finds common high-confidence patterns in pasted/text-like data | Checks email, UK phone/postcode/NI, IP, URLs, date-like values and Luhn-valid card-like numbers. It deliberately does not claim to find names or all personal data. |
| Data pseudonymiser | Applies stable IDs, masks, salted SHA-256 fingerprints or column removal to CSV/TSV | Stable replacements are consistent within a column. Reversible mapping export is separate and explicitly treated as sensitive. |
| Metadata stripper | Removes EXIF/XMP/IPTC/vendor metadata from JPEG and text/Exif/time metadata from PNG | Lossless. Keeps JPEG ICC colour profiles/Adobe markers; supports batches of up to 100 files with ZIP output. |
| Office privacy inspector | Inspects/cleans personal and custom properties in DOCX/XLSX/PPTX and macro-enabled OOXML | Reports risky document features separately and exports low-disclosure JSON inspection reports; never silently removes comments or tracked changes. |
| PDF privacy inspector | Reports PDF Info/XMP metadata, attachments, forms, JavaScript and signatures | Metadata cleaning removes Info/XMP only; can export a SHA-256-linked summary report without source filename or metadata values. |
| PDF sanitiser | Rebuilds visible PDF pages into a fresh document | Does not carry the original metadata, attachments, forms, annotations/links, JavaScript or signatures. It is structural cleaning, not redaction of hidden page content. |
| Redaction | Blacks out regions of images and PDFs with zoom, PDF page navigation and keyboard rectangle entry | Output is rasterised/flattened. Normalised boxes stay aligned across preview/export resolutions; PDF text, links, forms, annotations and hidden document data are not carried over. |
| Image converter | SVG/PNG/JPEG/WebP conversion, resize and compression for one image or a batch | Re-encodes pixels. Batch mode applies one aspect-preserving resize policy, uses bounded sequential processing and blocks unsafe SVGs. |
| PDF workbench | Builds and reorganises PDF packs | Merge, extract/select ranges, reorder, rotate, duplicate/remove, add blank/image pages, page numbers, watermark, crop boxes, optional form flattening and explicit metadata handling. |
| Document → Markdown | Converts Word, PowerPoint, spreadsheets, OpenDocument, RTF, EPUB, CSV and text-based PDF files into Markdown | Runs Anydoc locally as WebAssembly. Scanned/image-only PDF pages are reported as needing OCR and are never uploaded for hosted OCR. |\n| File checksum | Calculates and compares SHA-256 fingerprints | Uses the browser Web Crypto API; no dependency. |
| Secret generator | Generates app, session, webhook and key material in Hex, Base64, Base64URL, alphanumeric and UUID formats | Uses `crypto.getRandomValues()` locally, never persists generated values, and provides ready-to-copy `.env` and terminal equivalents. |
| CSV/TSV cleaner | Trim cells/headers, remove empty rows/columns, dedupe by chosen keys, scoped find/replace, CSV/TSV→JSON | Auto-detects common encodings and comma/tab/semicolon/pipe delimiters; output is UTF-8 and preserves the chosen delimiter. |
| Accessibility colour checker | WCAG 2.x text/UI contrast, palette audit, focus colours and colour-vision previews | Context-aware text thresholds, contrast suggestions and clear limits on what the tool can establish. |
| Text & document diff | Line, word or character comparison of pasted text or locally extracted TXT/Markdown, DOCX and PDF text | Comparison is based on extracted text, not layout, styles, comments, tracked changes or images. |
| Data converter | JSON ⇄ CSV ⇄ YAML, validate and prettify | CSV values stay as text by default so IDs such as `00123` are not silently changed. |

## Trust boundary


- first-party JavaScript contains no `fetch`, XHR, WebSocket, EventSource or beacon calls;
- secret generation uses the browser Web Crypto random-number generator and generated values are never persisted by Sets;
- every standalone HTML entry has a Content Security Policy that blocks external resources; the hosted build allows only the shared Good Ship analytics script and Plausible endpoint;
- remote font loading has been removed;
- PDF.js scripting and eval are explicitly disabled when opening PDFs;
- `npm run check` enforces the no-network-source rule and source CSP coverage in CI;
- `npm run verify:dist` checks the **built** standalone HTML for sealed CSP, external assets/embeds and unexpected build files, then writes `SHA256SUMS.txt`;
- every built standalone file is smoke-tested directly under `file://` in Chromium, Firefox and WebKit, with page/console/network failures treated as failures;
- critical transforms and privacy boundaries have automated tests, including OOXML cleaning, PDF metadata removal, structural PDF rebuilding, redaction geometry, personal-data pattern matching and pseudonymisation;
- summary inspection reports omit source filenames and metadata values by default, using a SHA-256 fingerprint when available.

This does **not** mean every operation is lossless or that automated checks can establish a file is safe to publish. 

## Architecture

The repo is intentionally small rather than framework-heavy:

```text
src/
  brand/brand.css        shared visual system
  shell.js               shared Sets chrome, dropzones, downloads, DOM helpers
  tools.js               single tool manifest used by launcher + build
  lib/                    pure/reusable transforms and trust-sensitive helpers

tools/
  preflight/
  privacy-find/
  pseudonymise/
  metadata/
  office/
  pdf-inspect/
  pdf-sanitise/
  redact/
  image/
  pdf/
  hash/
  secret/
  csv/
  contrast/
  diff/
  convert/

test/                     Node built-in tests
scripts/check.mjs         source syntax + privacy-boundary checks
scripts/check-dist.mjs    production HTML + checksum verification
scripts/browser-smoke.mjs direct-file browser smoke harness
build.mjs                 per-entry single-file production build
```

At build time `vite-plugin-singlefile` inlines each entry's JS and CSS into one HTML file. The per-entry loop exists because each output needs to be a genuinely standalone document.

Adding a new tool should normally mean:

1. add `tools/<id>/index.html` and `main.js`;
2. add one entry to `src/tools.js`;
3. put reusable or security-sensitive transforms in `src/lib/` with tests.

The build discovers tool entries from the same manifest used by the launcher, so there is no second list to keep in sync.

## Develop and verify

Requires Node 22. Direct dependencies are pinned and `package-lock.json` is committed from a clean Node 22 install. Use `npm ci` when reproducing or verifying the checked-in dependency graph; use `npm install` only when intentionally changing dependencies. The project uses `fflate` for local ZIP/OOXML batch work and `@firecrawl/anydoc-wasm` for the Document → Markdown converter. Anydoc is initialised from an inlined WebAssembly payload so standalone builds do not fetch a runtime asset. Builds fetch the pinned 0.2.4 WASM file into an ignored source cache and verify its exact byte size and SHA-256 before Vite embeds it.

```bash
npm ci
npm run dev
npm run check
npm test
npm run build
npm run verify:dist
npm run preview
```

`npm run build` produces:

```text
dist/
  index.html
  SHA256SUMS.txt
  tools/<tool>/index.html
```

Every `tools/<tool>/index.html` is self-contained and can be distributed on its own. `SHA256SUMS.txt` lets a downloaded/rehosted standalone file be checked against the exact artefact produced by CI.

Cross-browser smoke testing runs separately in GitHub Actions. It rebuilds the verified output, opens every standalone HTML file directly from disk in Chromium, Firefox and WebKit, and exercises selected real file-input paths including checksums, CSV/TSV, personal-data finding, pseudonymisation and PDF rebuilding. Keeping this harness isolated means Playwright is not part of the application runtime or lockfile.

## Releases

Tags matching `v<package-version>` trigger the release workflow. A release is only published after the normal source/test/build verification **and** the cross-browser standalone smoke suite pass.

A release contains:

- `sets-<version>.zip` with the verified `dist/`, README, `LICENSE` and `NOTICE`;
- a renamed standalone Sets HTML asset for the launcher and every tool;
- `LICENSE` and `NOTICE` alongside those standalone assets;
- `RELEASE-SHA256SUMS.txt` covering the release assets.

The workflow refuses to publish when the Git tag and `package.json` version do not match.

## Design principles

1. **Local is the default, not a mode.** A basic utility should not need an account, server or consent banner.
2. **Do not silently alter data.** Preserve strings, colour profiles and page sizes unless the operation explicitly requires a destructive transform.
3. **Destructive tools explain the boundary.** Redaction, rasterisation, structural rebuilding and re-encoding should be obvious before download.
4. **Automated privacy checks are prompts for judgement.** Pattern finders and preflight signals should never be presented as proof of compliance or safety.
5. **Small dependencies, strong browser primitives.** Prefer Canvas, Web Crypto, TextDecoder and native drag/drop when they are sufficient.
6. **Standalone remains a product feature.** Improvements should not make the tools dependent on a launcher, service worker or backend.
7. **Trust-sensitive code gets tests.** Especially parsers, metadata removal, pseudonymisation and transformations described as lossless or disclosure-safe.

## Deployment

The canonical hosted version is **https://good-ship.co.uk/sets/**. The Good Ship website pulls from this repository's `main` branch, runs the normal Sets checks/tests and `build:hosted` verification, then publishes that generated bundle at `/sets/`. This repository remains the source of truth.

`dist/` is static. It can be hosted at a root domain or subpath, and the individual generated HTML files can also be attached to releases for direct download/use.

A PWA/offline launcher can be added later without changing the standalone-tool contract; see `ROADMAP.md`.

## Licence

The software and documentation in this repository are licensed under the **Apache License 2.0**; see `LICENSE`.

The Apache licence does not grant permission to use The Good Ship name, logos, service marks or distinctive visual identity as branding for derived products. See `NOTICE` for the brand boundary.
