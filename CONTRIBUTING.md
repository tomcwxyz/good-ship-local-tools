# Contributing

Local Tools is intentionally small. Contributions are welcome when they strengthen the central proposition: useful browser utilities for work people should not need to upload to an unknown service.

## Before adding a tool

A new tool should normally satisfy at least one of these:

- it handles potentially sensitive files or text;
- built-in software makes the task awkward to do safely;
- local execution materially improves privacy or organisational confidence;
- it composes naturally with an existing Local Tool.

Avoid adding generic utility-site filler simply because it is easy to implement.

## Architecture

Keep tools independently portable. Each tool lives in `tools/<id>/`, is registered once in `src/tools.js`, and should build to a self-contained HTML file.

Put reusable or security-sensitive transforms in `src/lib/`. Prefer small pure functions so they can be exercised by Node's built-in test runner without a browser framework.

## Privacy rules

Do not add analytics, telemetry, remote fonts or network requests to first-party tool code. If a future feature genuinely requires a network, it should be a separate product/mode with a visibly different trust promise rather than weakening the default.

SVG, PDF, archive and document parsers should be treated as untrusted-input boundaries. Validate inputs, impose sensible size limits, and avoid enabling script/eval features.

## User experience

- Use plain language before technical terminology.
- Explain destructive/re-encoding steps before the user downloads output.
- Do not silently infer or change data types where doing so could corrupt identifiers.
- Preserve keyboard operation and visible focus states.
- Do not use colour alone to convey status.
- Keep useful defaults simple; put uncommon controls behind clear advanced options rather than making the first screen dense.

## Verification

Run:

```bash
npm install
npm run check
npm test
npm run build
```

For changes to security-sensitive or lossless transformations, add or update tests. For UI changes, open the generated standalone HTML, exercise keyboard navigation, and test the primary workflow with representative files.

Before a release, smoke-test at least Chromium plus one other browser engine where practical.
