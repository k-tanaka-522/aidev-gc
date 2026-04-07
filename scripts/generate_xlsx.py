#!/usr/bin/env python3
"""
generate_xlsx.py
MDファイル内のMarkdownテーブルをExcel(.xlsx)に変換する。
依存: openpyxl
インストール: pip install openpyxl
使用例:
  python scripts/generate_xlsx.py \
    --input outputs/01_提案見積/01-1_見積書/見積書.md \
    --output outputs/01_提案見積/01-1_見積書/見積書.xlsx \
    --sheet "工数見積"
"""

import argparse
import re
import sys
from pathlib import Path

try:
    from openpyxl import Workbook
    from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
    from openpyxl.utils import get_column_letter
except ImportError:
    print("ERROR: openpyxl が必要です。pip install openpyxl を実行してください。")
    sys.exit(1)


HEADER_FILL = PatternFill(start_color="1F4E79", end_color="1F4E79", fill_type="solid")
HEADER_FONT = Font(color="FFFFFF", bold=True, name="游ゴシック")
BODY_FONT = Font(name="游ゴシック")
ALT_FILL = PatternFill(start_color="DCE6F1", end_color="DCE6F1", fill_type="solid")
THIN_BORDER = Border(
    left=Side(style="thin"),
    right=Side(style="thin"),
    top=Side(style="thin"),
    bottom=Side(style="thin"),
)


def parse_md_tables(md_text: str) -> list[tuple[str, list[list[str]]]]:
    """MDテキストからテーブルを抽出する。見出し直前のH2/H3をテーブル名として使用。"""
    tables = []
    lines = md_text.splitlines()
    current_heading = "Sheet"
    i = 0
    while i < len(lines):
        line = lines[i]
        if re.match(r"^#{1,3}\s+", line):
            current_heading = re.sub(r"^#{1,3}\s+", "", line).strip()
        if line.startswith("|") and i + 1 < len(lines) and re.match(r"^\|[-| :]+\|", lines[i + 1]):
            table_lines = []
            while i < len(lines) and lines[i].startswith("|"):
                table_lines.append(lines[i])
                i += 1
            rows = []
            for tl in table_lines:
                if re.match(r"^\|[-| :]+\|", tl):
                    continue
                cells = [c.strip() for c in tl.strip("|").split("|")]
                rows.append(cells)
            if rows:
                tables.append((current_heading, rows))
            continue
        i += 1
    return tables


def write_table_to_sheet(ws, rows: list[list[str]], sheet_name: str):
    ws.title = sheet_name[:31]  # Excelシート名は31文字まで
    if not rows:
        return
    # ヘッダー行
    header = rows[0]
    for col_idx, cell_val in enumerate(header, start=1):
        cell = ws.cell(row=1, column=col_idx, value=cell_val)
        cell.fill = HEADER_FILL
        cell.font = HEADER_FONT
        cell.alignment = Alignment(horizontal="center", vertical="center", wrap_text=True)
        cell.border = THIN_BORDER
    # データ行
    for row_idx, row in enumerate(rows[1:], start=2):
        fill = ALT_FILL if row_idx % 2 == 0 else PatternFill()
        for col_idx, cell_val in enumerate(row, start=1):
            cell = ws.cell(row=row_idx, column=col_idx, value=cell_val)
            cell.font = BODY_FONT
            cell.fill = fill
            cell.alignment = Alignment(vertical="center", wrap_text=True)
            cell.border = THIN_BORDER
    # 列幅を自動調整
    for col_idx in range(1, len(header) + 1):
        max_len = max(
            len(str(ws.cell(row=r, column=col_idx).value or ""))
            for r in range(1, ws.max_row + 1)
        )
        ws.column_dimensions[get_column_letter(col_idx)].width = min(max_len + 4, 50)
    # 行高さ
    ws.row_dimensions[1].height = 20


def main():
    parser = argparse.ArgumentParser(description="MDテーブル → Excel変換")
    parser.add_argument("--input", "-i", required=True, help="入力MDファイルパス")
    parser.add_argument("--output", "-o", required=True, help="出力xlsxファイルパス")
    parser.add_argument("--sheet", "-s", default=None, help="シート名（省略時はH2/H3見出しを使用）")
    args = parser.parse_args()

    input_path = Path(args.input)
    output_path = Path(args.output)

    if not input_path.exists():
        print(f"ERROR: 入力ファイルが見つかりません: {input_path}")
        sys.exit(1)

    md_text = input_path.read_text(encoding="utf-8")
    tables = parse_md_tables(md_text)

    if not tables:
        print(f"WARNING: テーブルが見つかりませんでした: {input_path}")
        sys.exit(0)

    wb = Workbook()
    wb.remove(wb.active)  # デフォルトシートを削除

    for idx, (heading, rows) in enumerate(tables):
        sheet_name = args.sheet if (args.sheet and idx == 0) else heading
        ws = wb.create_sheet(title=sheet_name[:31])
        write_table_to_sheet(ws, rows, sheet_name)

    output_path.parent.mkdir(parents=True, exist_ok=True)
    wb.save(output_path)
    print(f"✅ 変換完了: {output_path}（シート数: {len(tables)}）")


if __name__ == "__main__":
    main()
