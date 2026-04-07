#!/bin/bash

# フェーズゲート判定フック
# 最終出力からフェーズゲート判定セクションを抽出し、
# PASS/FAIL/条件付きPASSを判定して結果をログに記録

set -e

# ログディレクトリの確認・作成
LOG_DIR="/sessions/adoring-busy-hopper/mnt/aidev-gc/outputs/qa"
mkdir -p "$LOG_DIR"

# ログファイル
GATE_LOG="$LOG_DIR/phase-gate-log.md"

# 標準入力からのテキスト取得（SubagentStopから渡される）
# もしくは、引数で指定されたファイルから読む
INPUT_TEXT=""
if [ -n "$1" ] && [ -f "$1" ]; then
    INPUT_TEXT=$(cat "$1")
elif [ -n "$1" ]; then
    INPUT_TEXT="$1"
else
    # 標準入力から読む
    INPUT_TEXT=$(cat)
fi

# フェーズゲート判定セクションを抽出
# 「フェーズゲート判定」「Phase Gate」「ゲート判定」などのセクションを探す
GATE_SECTION=$(echo "$INPUT_TEXT" | grep -A 20 -i "フェーズゲート\|phase.gate\|ゲート判定" || true)

if [ -z "$GATE_SECTION" ]; then
    echo "[WARN] phase-gate: フェーズゲート判定セクションが見つかりません" >&2
    exit 0
fi

# 判定結果を抽出（PASS, FAIL, 条件付きPASS）
RESULT="UNKNOWN"
if echo "$GATE_SECTION" | grep -qi "PASS\|合格\|OK\|✓"; then
    if echo "$GATE_SECTION" | grep -qi "条件\|条件付き\|conditional"; then
        RESULT="CONDITIONAL_PASS"
    else
        RESULT="PASS"
    fi
fi

if echo "$GATE_SECTION" | grep -qi "FAIL\|不合格\|NG\|×"; then
    RESULT="FAIL"
fi

# タイムスタンプ
TIMESTAMP=$(date '+%Y-%m-%d %H:%M:%S')
DATETIME_SLUG=$(date '+%Y%m%d_%H%M%S')

# ログエントリを作成
LOG_ENTRY=$(cat <<EOF
## [$TIMESTAMP] フェーズゲート判定

**判定結果**: $RESULT

### 詳細
\`\`\`
$GATE_SECTION
\`\`\`

---

EOF
)

# ログファイルに追記
{
    if [ ! -f "$GATE_LOG" ]; then
        echo "# フェーズゲート判定ログ"
        echo ""
        echo "最終更新: $TIMESTAMP"
        echo ""
    fi
    echo "$LOG_ENTRY"
} >> "$GATE_LOG"

# コンソール出力
echo "[phase-gate] $TIMESTAMP - 判定結果: $RESULT"
echo "[phase-gate] ログ保存: $GATE_LOG"

# 失敗した場合は終了コード 1 を返す
if [ "$RESULT" = "FAIL" ]; then
    exit 1
fi

exit 0
