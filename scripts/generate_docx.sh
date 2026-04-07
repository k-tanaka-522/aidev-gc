#!/usr/bin/env bash
# generate_docx.sh
# MD → Word(.docx)変換（pandoc使用）
# 依存: pandoc
# インストール: https://pandoc.org/installing.html
#
# 使用例:
#   bash scripts/generate_docx.sh \
#     outputs/07_運用/運用手順書.md \
#     outputs/07_運用/運用手順書.docx

set -euo pipefail

INPUT="${1:-}"
OUTPUT="${2:-}"

if [ -z "$INPUT" ] || [ -z "$OUTPUT" ]; then
  echo "使用方法: bash scripts/generate_docx.sh <入力.md> <出力.docx>"
  exit 1
fi

if ! command -v pandoc &>/dev/null; then
  echo "ERROR: pandoc がインストールされていません。https://pandoc.org/installing.html を参照してください。"
  exit 1
fi

mkdir -p "$(dirname "$OUTPUT")"

REFERENCE_OPT=""
TEMPLATE="scripts/templates/gc_reference.docx"
if [ -f "$TEMPLATE" ]; then
  REFERENCE_OPT="--reference-doc=$TEMPLATE"
fi

pandoc "$INPUT" \
  $REFERENCE_OPT \
  --metadata title="$(basename "$INPUT" .md)" \
  --toc \
  --toc-depth=3 \
  -o "$OUTPUT"

echo "✅ 変換完了: $OUTPUT"
