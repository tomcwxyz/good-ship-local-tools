#!/usr/bin/env bash
set -euo pipefail

VERSION="${1:-}"
ASSET_DIR="${2:-release-assets}"

if [ -z "$VERSION" ]; then
  echo 'Usage: scripts/package-release.sh <version> [asset-dir]' >&2
  exit 2
fi

PACKAGE_VERSION="$(node -p "JSON.parse(require('fs').readFileSync('package.json','utf8')).version")"
if [ "$VERSION" != "$PACKAGE_VERSION" ]; then
  echo "Requested release version $VERSION does not match package version $PACKAGE_VERSION" >&2
  exit 1
fi

if [ ! -f dist/SHA256SUMS.txt ]; then
  echo 'dist/SHA256SUMS.txt is missing. Run npm run build && npm run verify:dist first.' >&2
  exit 1
fi

WORK_ROOT="${RUNNER_TEMP:-$(mktemp -d)}"
BUNDLE_NAME="good-ship-local-tools-$VERSION"
BUNDLE_DIR="$WORK_ROOT/$BUNDLE_NAME"

rm -rf "$ASSET_DIR" "$BUNDLE_DIR"
mkdir -p "$ASSET_DIR" "$BUNDLE_DIR"
cp -R dist/. "$BUNDLE_DIR/"
cp LICENSE NOTICE README.md "$BUNDLE_DIR/"
(cd "$WORK_ROOT" && zip -qr "$ASSET_DIR/$BUNDLE_NAME.zip" "$BUNDLE_NAME")

cp LICENSE NOTICE "$ASSET_DIR/"
cp dist/index.html "$ASSET_DIR/good-ship-local-tools-$VERSION-launcher.html"
for entry in dist/tools/*/index.html; do
  tool="$(basename "$(dirname "$entry")")"
  cp "$entry" "$ASSET_DIR/good-ship-local-tools-$VERSION-$tool.html"
done

(
  cd "$ASSET_DIR"
  sha256sum *.html *.zip LICENSE NOTICE | sort -k2 > RELEASE-SHA256SUMS.txt
  sha256sum -c RELEASE-SHA256SUMS.txt
)

HTML_COUNT="$(find "$ASSET_DIR" -maxdepth 1 -type f -name '*.html' | wc -l | tr -d ' ')"
if [ "$HTML_COUNT" != '12' ]; then
  echo "Expected 12 standalone HTML release assets; found $HTML_COUNT." >&2
  exit 1
fi

printf 'Release assets ready: %s\n' "$ASSET_DIR"
