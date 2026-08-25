# Security and privacy model

Local Tools is designed for files that people may not want to upload to a third-party service. Its core promise is therefore deliberately narrow and testable: **first-party tool code should not send user data over the network**.

## Trust boundary

The source and built standalone tools are expected to:

- process user-supplied files in the browser;
- contain no first-party `fetch`, XHR, WebSocket, EventSource or beacon calls;
- load no remote fonts, scripts, styles or images;
- apply a Content Security Policy to every HTML entry;
- use `connect-src 'none'` in production standalone files;
- disable PDF.js scripting/eval while inspecting untrusted PDFs;
- reject SVG input that contains active content or external-resource references where SVG is accepted.

`npm run check` enforces the source-level parts of this boundary. CI should also build every standalone HTML artefact before a release is published.

This is not a sandbox for hostile files. Browser, PDF/image parser and dependency vulnerabilities can still exist. Keep the browser and dependencies current, and do not describe the tools as making arbitrary malicious files safe.

## Destructive operations

Some operations intentionally change document structure:

- redaction rasterises/ flattens output;
- image conversion re-encodes pixels;
- metadata cleaning removes selected non-pixel chunks/segments;
- PDF editing rebuilds the document from selected pages.

The interface must say when this happens before download. A transform described as lossless should preserve the underlying image/document content relevant to that claim and should have a regression test.

## Reporting a vulnerability

Please do not publish sensitive exploit details in a public issue. Contact The Good Ship through the contact route on https://good-ship.co.uk and include:

- the affected tool and version/commit;
- a minimal reproduction where safe to share;
- the security or privacy impact;
- any suggested mitigation.

General bugs and non-sensitive hardening suggestions are welcome as GitHub issues.
