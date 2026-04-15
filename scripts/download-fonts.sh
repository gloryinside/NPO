#!/usr/bin/env bash
# scripts/download-fonts.sh
#
# Downloads NotoSansKR TTF fonts required for Korean PDF receipt generation.
# Called automatically via `npm run postinstall` in CI/CD environments.
#
# Skips download if fonts are already present (idempotent).
#
# Usage:
#   bash scripts/download-fonts.sh
#   # or via npm:
#   npm run download-fonts

set -euo pipefail

FONTS_DIR="$(cd "$(dirname "$0")/.." && pwd)/public/fonts"
REGULAR_FONT="$FONTS_DIR/NotoSansKR-Regular.ttf"
BOLD_FONT="$FONTS_DIR/NotoSansKR-Bold.ttf"

REGULAR_URL="https://cdn.jsdelivr.net/npm/@expo-google-fonts/noto-sans-kr@0.4.3/400Regular/NotoSansKR_400Regular.ttf"
BOLD_URL="https://cdn.jsdelivr.net/npm/@expo-google-fonts/noto-sans-kr@0.4.3/700Bold/NotoSansKR_700Bold.ttf"

mkdir -p "$FONTS_DIR"

download_if_missing() {
  local dest="$1"
  local url="$2"
  local name="$(basename "$dest")"

  if [ -f "$dest" ] && [ "$(wc -c < "$dest")" -gt 1000000 ]; then
    echo "✓ $name already present — skipping"
    return 0
  fi

  echo "↓ Downloading $name..."
  if command -v curl >/dev/null 2>&1; then
    curl -fsSL -o "$dest" "$url"
  elif command -v wget >/dev/null 2>&1; then
    wget -q -O "$dest" "$url"
  else
    echo "ERROR: curl or wget is required to download fonts." >&2
    exit 1
  fi

  local size
  size="$(wc -c < "$dest")"
  if [ "$size" -lt 1000000 ]; then
    echo "ERROR: $name download appears corrupt (${size} bytes). Check the URL." >&2
    rm -f "$dest"
    exit 1
  fi

  echo "✓ $name downloaded ($(( size / 1024 ))KB)"
}

download_if_missing "$REGULAR_FONT" "$REGULAR_URL"
download_if_missing "$BOLD_FONT" "$BOLD_URL"

echo ""
echo "Fonts ready in $FONTS_DIR"
