#!/bin/bash

# IaCファイルの自動バリデーションフック
# - Terraformファイル (.tf): terraform fmt -check && terraform validate
# - CloudFormationファイル (.yaml/.yml + AWSTemplateFormatVersion): cfn-lint
# - その他: スキップ

set -e

# デバッグモード（必要に応じて有効化）
DEBUG=${DEBUG:-0}

# 標準入力からファイルパスを読む（PostToolUse から渡される）
# もしくは、環境変数 CLAUDE_LAST_FILE から取得
TARGET_FILE="${1:-${CLAUDE_LAST_FILE:-}}"

if [ -z "$TARGET_FILE" ]; then
    [ "$DEBUG" = "1" ] && echo "[iac-validate] ターゲットファイルが指定されていません。スキップ。" >&2
    exit 0
fi

# ファイルの存在確認
if [ ! -f "$TARGET_FILE" ]; then
    [ "$DEBUG" = "1" ] && echo "[iac-validate] ファイルが見つかりません: $TARGET_FILE" >&2
    exit 0
fi

# Terraformファイルのバリデーション
if [[ "$TARGET_FILE" == *.tf ]]; then
    [ "$DEBUG" = "1" ] && echo "[iac-validate] Terraformファイルを検出: $TARGET_FILE" >&2

    # terraform fmt -check でフォーマットをチェック
    if ! terraform fmt -check "$TARGET_FILE" > /dev/null 2>&1; then
        echo "[ERROR] iac-validate: Terraformフォーマットエラー - $TARGET_FILE"
        echo "修正: terraform fmt -recursive で自動修正してください"
        exit 1
    fi

    # terraform validate は directoryで実行する必要があるため、ファイルのディレクトリで実行
    TFDIR=$(dirname "$TARGET_FILE")
    if ! terraform -chdir="$TFDIR" validate > /dev/null 2>&1; then
        echo "[ERROR] iac-validate: Terraform検証エラー - $TARGET_FILE"
        terraform -chdir="$TFDIR" validate
        exit 1
    fi

    echo "[OK] iac-validate: Terraformバリデーション成功 - $TARGET_FILE"
    exit 0
fi

# CloudFormationファイルのバリデーション
if [[ "$TARGET_FILE" == *.yaml ]] || [[ "$TARGET_FILE" == *.yml ]]; then
    # AWSTemplateFormatVersion を含むかチェック
    if grep -q "AWSTemplateFormatVersion" "$TARGET_FILE" 2>/dev/null; then
        [ "$DEBUG" = "1" ] && echo "[iac-validate] CloudFormationファイルを検出: $TARGET_FILE" >&2

        # cfn-lint がインストールされている場合のみ実行
        if command -v cfn-lint &> /dev/null; then
            if ! cfn-lint "$TARGET_FILE" > /dev/null 2>&1; then
                echo "[ERROR] iac-validate: CloudFormationリント エラー - $TARGET_FILE"
                cfn-lint "$TARGET_FILE"
                exit 1
            fi
            echo "[OK] iac-validate: CloudFormationバリデーション成功 - $TARGET_FILE"
        else
            [ "$DEBUG" = "1" ] && echo "[iac-validate] cfn-lint がインストールされていません。スキップ。" >&2
        fi
        exit 0
    fi
fi

# その他のファイルはスキップ
[ "$DEBUG" = "1" ] && echo "[iac-validate] サポートされていないファイル形式。スキップ: $TARGET_FILE" >&2
exit 0
