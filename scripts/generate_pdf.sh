#!/usr/bin/env bash
# generate_pdf.sh
# MD → PDF変換（pandoc使用）
# 依存: pandoc, wkhtmltopdf または xelatex
# インストール: https://pandoc.org/installing.html
#
# 使用例:
#   bash scripts/generate_pdf.sh \
#     outputs/04_設計/04-2_ネットワーク/NW設計書.md \
#     outputs/04_設計/04-2_ネットワーク/NW設計書.pdf

set -euo pipefail

INPUT="${1:-}"
OUTPUT="${2:-}"

if [ -z "$INPUT" ] || [ -z "$OUTPUT" ]; then
  echo "使用方法: bash scripts/generate_pdf.sh <入力.md> <出力.pdf>"
  exit 1
fi

if ! command -v pandoc &>/dev/null; then
  echo "ERROR: pandoc がインストールされていません。https://pandoc.org/installing.html を参照してください。"
  exit 1
fi

mkdir -p "$(dirname "$OUTPUT")"

pandoc "$INPUT" \
  --pdf-engine=wkhtmltopdf \
  --metadata title="$(basename "$INPUT" .md)" \
  --variable geometry:margin=2cm \
  --variable fontsize=11pt \
  --variable lang=ja \
  --toc \
  --toc-depth=3 \
  -o "$OUTPUT" \
  2>/dev/null || \
pandoc "$INPUT" \
  --pdf-engine=xelatex \
  --metadata title="$(basename "$INPUT" .md)" \
  --variable geometry:margin=2cm \
  --variable fontsize=11pt \
  --variable mainfont="Noto Sans CJK JP" \
  --variable lang=ja \
  --toc \
  --toc-depth=3 \
  -o "$OUTPUT"

echo "✅ 変換完了: $OUTPUT"
