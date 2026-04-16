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

# 1차 CDN 실패 시 사용할 폴백 (unpkg.com).
REGULAR_URL_FALLBACK="https://unpkg.com/@expo-google-fonts/noto-sans-kr@0.4.3/400Regular/NotoSansKR_400Regular.ttf"
BOLD_URL_FALLBACK="https://unpkg.com/@expo-google-fonts/noto-sans-kr@0.4.3/700Bold/NotoSansKR_700Bold.ttf"

mkdir -p "$FONTS_DIR"

try_download() {
  local dest="$1"
  local url="$2"
  if command -v curl >/dev/null 2>&1; then
    curl -fsSL -o "$dest" "$url"
  elif command -v wget >/dev/null 2>&1; then
    wget -q -O "$dest" "$url"
  else
    echo "ERROR: curl or wget is required to download fonts." >&2
    return 1
  fi
}

download_if_missing() {
  local dest="$1"
  local url="$2"
  local fallback="$3"
  local name
  name="$(basename "$dest")"

  if [ -f "$dest" ] && [ "$(wc -c < "$dest")" -gt 1000000 ]; then
    echo "✓ $name already present — skipping"
    return 0
  fi

  echo "↓ Downloading $name..."
  if ! try_download "$dest" "$url"; then
    echo "  primary CDN failed, trying fallback..."
    if ! try_download "$dest" "$fallback"; then
      echo "ERROR: both CDNs failed for $name" >&2
      rm -f "$dest"
      exit 1
    fi
  fi

  local size
  size="$(wc -c < "$dest")"
  if [ "$size" -lt 1000000 ]; then
    echo "  primary CDN returned corrupt file (${size}B), trying fallback..."
    rm -f "$dest"
    if ! try_download "$dest" "$fallback"; then
      echo "ERROR: fallback also failed for $name" >&2
      exit 1
    fi
    size="$(wc -c < "$dest")"
    if [ "$size" -lt 1000000 ]; then
      echo "ERROR: $name still corrupt after fallback (${size}B)" >&2
      rm -f "$dest"
      exit 1
    fi
  fi

  echo "✓ $name downloaded ($(( size / 1024 ))KB)"
}

download_if_missing "$REGULAR_FONT" "$REGULAR_URL" "$REGULAR_URL_FALLBACK"
download_if_missing "$BOLD_FONT" "$BOLD_URL" "$BOLD_URL_FALLBACK"

echo ""
echo "Fonts ready in $FONTS_DIR"
