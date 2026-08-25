# The Good Ship — Local Tools

Small, local-first browser utilities for jobs that are often handed to random
websites. Files are processed on the device; the first-party source contains no
network calls, no analytics, no cookies and no remote fonts.

Each tool builds as a **single self-contained HTML file**. You can host the whole
launcher, or hand somebody one tool that opens directly in a modern browser.

## Tools

| Tool | What it does | Important behaviour |
|------|--------------|--------------------|
| Metadata stripper | Removes EXIF/XMP/IPTC/vendor metadata from JPEG and text/Exif/time metadata from PNG | Lossless. Keeps JPEG ICC colour profiles/Adobe markers; supports batches of up to 100 files with ZIP output. |
| Office privacy inspector | Inspects/cleans personal and custom properties in DOCX/XLSX/PPTX and macro-enabled OOXML | Reports comments, tracked changes, notes, hidden sheets, macros, embedded files and external links separately; never silently removes them. |
| PDF privacy inspector | Reports PDF Info/XMP metadata, attachments, forms, JavaScript and signatures | Metadata cleaning removes Info/XMP only; signed files require an explicit invalidation acknowledgement. |
| Redaction | Blacks out regions of images and PDFs | Output is rasterised/flattened. PDF text, links, forms, annotations and hidden document data are not carried over. |
| Image converter | SVG/PNG/JPEG/WebP conversion, resize and compression | Re-encodes pixels. Blocks SVGs that contain script or external web resources. |
| PDF editor | Merge, drag-reorder, rotate, duplicate and remove pages | Page content is copied into a new PDF. PDF scripting/eval is disabled while previewing. |
| File checksum | Calculates and compares SHA-256 fingerprints | Uses the browser Web Crypto API; no dependency. |
| CSV/TSV cleaner | Trim cells/headers, remove empty rows/columns, dedupe by chosen keys, scoped find/replace, CSV/TSV→JSON | Auto-detects common encodings and comma/tab/semicolon/pipe delimiters; output is UTF-8 and preserves the chosen delimiter. |
| Accessibility colour checker | WCAG 2.x text/UI contrast, palette audit, focus colours and colour-vision previews | Context-aware text thresholds, contrast suggestions and clear limits on what the tool can establish. |
| Text diff | Line, word or character comparison | Fully local text comparison. |
| Data converter | JSON ⇄ CSV ⇄ YAML, validate and prettify | CSV values stay as text by default so IDs such as `00123` are not silently changed. |

## Trust boundary

The collection is deliberately stricter than “we promise not to upload it”:

- first-party JavaScript contains no `fetch`, XHR, WebSocket, EventSource or beacon calls;
- every HTML entry has a Content Security Policy that blocks unexpected external resources;
- remote font loading has been removed;
- PDF.js scripting and eval are explicitly disabled when opening PDFs;
- `npm run check` enforces the no-network-source rule and CSP coverage in CI;
- critical transforms and privacy boundaries have automated tests, including OOXML package cleaning and PDF metadata removal.

This does **not** mean every operation is lossless. Tools that rasterise or
re-encode say so in the interface. A hosted copy is also only as trustworthy as
the HTML/JavaScript actually served by that host; standalone release files are
easier to inspect and retain unchanged.

## Architecture

The repo is intentionally small rather than framework-heavy:

```text
src/
  brand/brand.css        shared visual system
  shell.js               shared chrome, dropzones, downloads, DOM helpers
  tools.js               single tool manifest used by launcher + build
  lib/                    pure reusable transforms with tests

tools/
  metadata/
  office/
  pdf-inspect/
  redact/
  image/
  pdf/
  hash/
  csv/
  contrast/
  diff/
  convert/

test/                     Node built-in tests
scripts/check.mjs         syntax + privacy-boundary checks
build.mjs                 per-entry single-file production build
```

At build time `vite-plugin-singlefile` inlines each entry's JS and CSS into one
HTML file. The per-entry loop exists because each output needs to be a genuinely
standalone document.

Adding a new tool should normally mean:

1. add `tools/<id>/index.html` and `main.js`;
2. add one entry to `src/tools.js`;
3. put reusable or security-sensitive transforms in `src/lib/` with tests.

The build discovers tool entries from the same manifest used by the launcher, so
there is no second list to keep in sync.

## Develop and verify

Requires Node 22. Direct dependencies are pinned to reviewed versions. The project uses `fflate` for local ZIP/OOXML batch work; it has no runtime dependencies of its own.

```bash
npm install
npm run dev
npm run check
npm test
npm run build
npm run preview
```

`npm run build` produces:

```text
dist/
  index.html
  tools/<tool>/index.html
```

Every `tools/<tool>/index.html` is self-contained and can be distributed on its
own.

## Design principles

1. **Local is the default, not a mode.** A basic utility should not need an
   account, server or consent banner.
2. **Do not silently alter data.** Preserve strings, colour profiles and page
   sizes unless the operation explicitly requires a destructive transform.
3. **Destructive tools explain the boundary.** Redaction, rasterisation and
   re-encoding should be obvious before download.
4. **Small dependencies, strong browser primitives.** Prefer Canvas, Web Crypto,
   TextDecoder and native drag/drop when they are sufficient.
5. **Standalone remains a product feature.** Improvements should not make the
   tools dependent on a launcher, service worker or backend.
6. **Trust-sensitive code gets tests.** Especially parsers, metadata removal and
   transformations described as lossless.

## Deployment

`dist/` is static. It can be hosted at a root domain or subpath, and the
individual generated HTML files can also be attached to releases for direct
download/use.

A PWA/offline launcher can be added later without changing the standalone-tool
contract; see `ROADMAP.md`.

## Licence

Current repository licence: **CC BY-NC 4.0**.

Before the first tagged release, decide whether the software code should use a conventional software licence (for example Apache-2.0 or MIT) while keeping Good Ship branding/content under a separate licence. No licence change has been made in this pass.
