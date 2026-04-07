#!/bin/bash
# スナップショット更新トリガー Hook (PostToolUse)
# Write/Edit 後に実行され、スナップショットの更新が必要かをチェック

STATE_DIR=".claude-state"
SNAPSHOT_DIR="$STATE_DIR/snapshot"
PENDING_FILE="$SNAPSHOT_DIR/.pending-update"

# ファイルパス取得
FILE_PATH=""

if [ -n "$CLAUDE_HOOK_PARAMS" ]; then
    FILE_PATH=$(echo "$CLAUDE_HOOK_PARAMS" | jq -r '.file_path // empty' 2>/dev/null)
fi

if [ -z "$FILE_PATH" ] && [ ! -t 0 ]; then
    STDIN_PARAMS=$(cat)
    FILE_PATH=$(echo "$STDIN_PARAMS" | jq -r '.file_path // empty' 2>/dev/null)
fi

# ファイルパスが取得できない場合はスキップ
if [ -z "$FILE_PATH" ]; then
    exit 0
fi

# スナップショットディレクトリがなければ作成
mkdir -p "$SNAPSHOT_DIR"

# 更新対象を判定
UPDATE_TARGET=""

case "$FILE_PATH" in
    docs/0[1-4]_*|docs/0[1-4]_*/**|docs/requirements/**)
        UPDATE_TARGET="architecture"
        ;;
    src/*|infra/*|backend/*|frontend/*)
        UPDATE_TARGET="codebase"
        ;;
    package.json|package-lock.json|yarn.lock|pnpm-lock.yaml|requirements.txt|Pipfile*|go.mod|go.sum|Cargo.toml|Cargo.lock)
        UPDATE_TARGET="dependencies"
        ;;
    .claude-state/*|.claude/*)
        # 内部ファイルは無視
        exit 0
        ;;
esac

# 更新対象がある場合、ペンディングファイルに記録
if [ -n "$UPDATE_TARGET" ]; then
    TIMESTAMP=$(date -u +"%Y-%m-%dT%H:%M:%SZ")

    # 既存のペンディング更新を読み込み、追加
    if [ -f "$PENDING_FILE" ]; then
        EXISTING=$(cat "$PENDING_FILE" | jq -r '.targets[]' 2>/dev/null | sort -u)
        TARGETS=$(echo -e "$EXISTING\n$UPDATE_TARGET" | sort -u | jq -R . | jq -s .)
    else
        TARGETS="[\"$UPDATE_TARGET\"]"
    fi

    # ペンディング更新を記録
    cat > "$PENDING_FILE" << EOF
{
  "targets": $TARGETS,
  "last_trigger": "$TIMESTAMP",
  "trigger_file": "$FILE_PATH"
}
EOF

    echo "📸 スナップショット更新待機: $UPDATE_TARGET ($FILE_PATH)" >&2
fi

exit 0
