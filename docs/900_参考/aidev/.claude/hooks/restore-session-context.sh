#!/bin/bash
# セッション開始時に前回のコンテキストを復元する
# SessionStart Hook

STATE_DIR=".claude-state"

# 進捗状況を表示
if [ -f "$STATE_DIR/progress.md" ]; then
    echo "=== 前回のセッション状態 ===" >&2
    echo "" >&2

    # 現在のフェーズ
    PHASE=$(grep -E "^## 現在のフェーズ" "$STATE_DIR/progress.md" -A 1 | tail -1)
    if [ -n "$PHASE" ]; then
        echo "📊 現在のフェーズ: $PHASE" >&2
    fi

    # 進行中タスク
    IN_PROGRESS=$(grep -E "^\- \[ \]" "$STATE_DIR/progress.md" | head -3)
    if [ -n "$IN_PROGRESS" ]; then
        echo "" >&2
        echo "📋 進行中タスク:" >&2
        echo "$IN_PROGRESS" >&2
    fi

    echo "" >&2
fi

# 決定事項の件数を表示
if [ -f "$STATE_DIR/decisions.json" ]; then
    COUNT=$(jq '.decisions | length' "$STATE_DIR/decisions.json" 2>/dev/null)
    if [ -n "$COUNT" ] && [ "$COUNT" != "null" ]; then
        echo "✅ 過去の決定事項: ${COUNT} 件" >&2
    fi
fi

# レビュー記録の件数を表示
if [ -d "$STATE_DIR/reviews" ]; then
    REVIEW_COUNT=$(find "$STATE_DIR/reviews" -name "*.json" 2>/dev/null | wc -l)
    if [ "$REVIEW_COUNT" -gt 0 ]; then
        echo "📝 レビュー記録: ${REVIEW_COUNT} 件" >&2
    fi
fi

echo "" >&2
echo "→ /status で詳細を確認できます" >&2
echo "==========================" >&2

exit 0
