#!/bin/bash

# IaCドリフト検知フック
# terraform plan を実行して差分を検出し、
# レポートを生成して outputs/operations/ に保存する

set -e

# ドリフト検知のルートディレクトリ
PROJECT_ROOT="/sessions/adoring-busy-hopper/mnt/aidev-gc"
OUTPUTS_DIR="$PROJECT_ROOT/outputs/operations"
TERRAFORM_DIR="${1:-$PROJECT_ROOT/terraform}"

# 出力ディレクトリの確認・作成
mkdir -p "$OUTPUTS_DIR"

# 日付ラベル
CURRENT_DATE=$(date '+%Y%m%d')
CURRENT_TIME=$(date '+%H%M%S')
TIMESTAMP=$(date '+%Y-%m-%d %H:%M:%S')

# ドリフトレポートの出力パス
DRIFT_REPORT="$OUTPUTS_DIR/drift-report-${CURRENT_DATE}_${CURRENT_TIME}.md"
DRIFT_JSON="$OUTPUTS_DIR/drift-report-${CURRENT_DATE}_${CURRENT_TIME}.json"

# Terraformディレクトリの存在確認
if [ ! -d "$TERRAFORM_DIR" ]; then
    echo "[INFO] drift-detect: Terraformディレクトリが見つかりません: $TERRAFORM_DIR" >&2
    exit 0
fi

# terraform コマンドの存在確認
if ! command -v terraform &> /dev/null; then
    echo "[ERROR] drift-detect: terraform コマンドが見つかりません" >&2
    exit 1
fi

echo "[INFO] drift-detect: ドリフト検知を開始します..." >&2
echo "[INFO] drift-detect: Terraformディレクトリ: $TERRAFORM_DIR" >&2

# terraform init が必要かチェック
if [ ! -d "$TERRAFORM_DIR/.terraform" ]; then
    echo "[INFO] drift-detect: terraform init を実行しています..." >&2
    terraform -chdir="$TERRAFORM_DIR" init -backend=false > /dev/null 2>&1 || true
fi

# terraform plan を実行してドリフトを検出
PLAN_OUTPUT=$(terraform -chdir="$TERRAFORM_DIR" plan -json 2>&1 || true)

# 差分の有無を確認
DRIFT_DETECTED=false
if echo "$PLAN_OUTPUT" | grep -q '"type":"planned_change"'; then
    DRIFT_DETECTED=true
fi

# レポートのヘッダー
cat > "$DRIFT_REPORT" <<EOF
# IaCドリフトレポート

- **生成日時**: $TIMESTAMP
- **対象ディレクトリ**: $TERRAFORM_DIR
- **ドリフト検知**: $([ "$DRIFT_DETECTED" = "true" ] && echo "✓ 検出" || echo "× なし")

## サマリー

EOF

if [ "$DRIFT_DETECTED" = "true" ]; then
    echo "ドリフトが検出されました。以下の変更が必要です:" >> "$DRIFT_REPORT"
    echo "" >> "$DRIFT_REPORT"
    echo "### 検出された変更" >> "$DRIFT_REPORT"
    echo "" >> "$DRIFT_REPORT"
    echo "\`\`\`json" >> "$DRIFT_REPORT"
    echo "$PLAN_OUTPUT" | head -50 >> "$DRIFT_REPORT"
    echo "\`\`\`" >> "$DRIFT_REPORT"
    echo "" >> "$DRIFT_REPORT"
    echo "詳細な計画は以下のコマンドで確認してください:" >> "$DRIFT_REPORT"
    echo "\`\`\`bash" >> "$DRIFT_REPORT"
    echo "terraform -chdir=\"$TERRAFORM_DIR\" plan" >> "$DRIFT_REPORT"
    echo "\`\`\`" >> "$DRIFT_REPORT"
else
    echo "インフラと Terraform 構成に差分はありません。" >> "$DRIFT_REPORT"
fi

echo "" >> "$DRIFT_REPORT"
echo "## 推奨アクション" >> "$DRIFT_REPORT"
echo "" >> "$DRIFT_REPORT"

if [ "$DRIFT_DETECTED" = "true" ]; then
    cat >> "$DRIFT_REPORT" <<'EOF'
1. ドリフト検出時は、以下のいずれかの対応をしてください:
   - **A. Terraform 構成を更新**: インフラの実際の状態に合わせて `.tf` ファイルを修正
   - **B. インフラを修正**: Terraform 構成に合わせて AWS インフラを修正

2. 修正後、再度 `terraform plan` を実行して差分がないことを確認

3. 変更内容をレビューして `terraform apply` で反映させる
EOF
else
    cat >> "$DRIFT_REPORT" <<'EOF'
ドリフトが検出されなかったため、特別な対応は不要です。
次回の定期チェックまで監視を続けます。
EOF
fi

# JSON形式でも保存（ツール解析用）
cat > "$DRIFT_JSON" <<EOF
{
  "timestamp": "$TIMESTAMP",
  "terraform_directory": "$TERRAFORM_DIR",
  "drift_detected": $( [ "$DRIFT_DETECTED" = "true" ] && echo "true" || echo "false" ),
  "report_file": "$DRIFT_REPORT"
}
EOF

echo "[OK] drift-detect: レポート生成完了" >&2
echo "[OK] drift-detect: レポートパス: $DRIFT_REPORT" >&2

exit 0
