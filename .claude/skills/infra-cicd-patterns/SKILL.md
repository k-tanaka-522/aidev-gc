---
description: インフラCI/CDパターン（ゼロタッチ本番デプロイ、ブレイクグラス手順、OIDC認証、パイプライン設計パターン）
---

# インフラ CI/CD パターン

## 概要

本ガイドはインフラストラクチャの自動デプロイメント、OIDC 認証統合、および緊急対応手順をカバーします。

---

## 1. ゼロタッチ本番デプロイの要件

### 前提条件

```
1. すべての変更が Git で管理されている
   - Terraform コード
   - 設定ファイル
   - テスト自動化スクリプト

2. テスト自動化が完備されている
   - Lint / Format チェック
   - Unit Test （Terraform Test Framework等）
   - Integration Test （staging 環境）
   - Security Scan （SAST/SCA）

3. デプロイ前ゲートが定義されている
   - テスト実行率 >= 95%
   - セキュリティスキャン Critical ゼロ
   - Code Review 2名以上Approve

4. OIDC 認証で AWS にアクセス
   - 人間の IAM ユーザ認証情報をパイプラインに保存しない
   - GitHub/GitLab トークンのみで AssumeRole

5. ロールバック戦略が事前定義
   - Terraform State の世代管理
   - 前バージョンへの自動復帰手順
```

---

## 2. OIDC（OpenID Connect）統合パターン

### GitHub Actions での OIDC 実装

#### Step 1: AWS IAM で OIDC プロバイダ設定

```bash
aws iam create-open-id-connect-provider \
  --url https://token.actions.githubusercontent.com \
  --client-id-list sts.amazonaws.com \
  --thumbprint-list 6938fd4d98bab03faadb97b34396831e3780aea1
```

#### Step 2: OIDC 用 IAM ロール作成

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Principal": {
        "Federated": "arn:aws:iam::ACCOUNT:oidc-provider/token.actions.githubusercontent.com"
      },
      "Action": "sts:AssumeRoleWithWebIdentity",
      "Condition": {
        "StringEquals": {
          "token.actions.githubusercontent.com:aud": "sts.amazonaws.com",
          "token.actions.githubusercontent.com:sub": "repo:OWNER/REPO:ref:refs/heads/main"
        }
      }
    }
  ]
}
```

#### Step 3: GitHub Actions Workflow に統合

```yaml
name: Deploy to Prod

on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    permissions:
      contents: read
      id-token: write  # ← OIDC トークン取得の許可

    steps:
      - uses: actions/checkout@v3

      - name: Assume role with OIDC
        uses: aws-actions/configure-aws-credentials@v2
        with:
          role-to-assume: arn:aws:iam::ACCOUNT:role/ProdDeployRole
          role-session-name: cicd-deploy-${{ github.run_id }}
          aws-region: ap-northeast-1

      - name: Deploy with Terraform
        run: |
          terraform init -backend-config="bucket=${{ secrets.TF_STATE_BUCKET }}"
          terraform plan -out=tfplan
          terraform apply tfplan
```

### メリット

```
✓ AWS アクセスキー（IAM User）をシークレットに保存不要
✓ トークンは短期間のみ有効（GitHub Actions の実行時間のみ）
✓ リポジトリごとに細かい権限制御可能
✓ 人間のIAM認証情報流出リスク低減
```

---

## 3. 環境別 CI/CD パイプライン設計

### 標準的な3環境構成

```
┌─────────────────────────────────────────────────────┐
│ GitHub Push (main or release/*)                     │
└────────────────────┬────────────────────────────────┘
                     │
            ┌────────▼────────┐
            │ Lint/Validation │ (5分以内)
            │ - terraform fmt │
            │ - terraform validate
            └────────┬────────┘
                     │
            ┌────────▼────────────────┐
            │ Static Analysis         │ (10分以内)
            │ - tflint                │
            │ - checkov (IaC security)│
            │ - trivy (dependency)    │
            └────────┬────────────────┘
                     │
         ┌───────────▼───────────┐
         │ Plan & Test Summary   │ (15分以内)
         │ - terraform plan      │
         │ - unit tests          │
         │ → PR にコメント投稿    │
         └───────────┬───────────┘
                     │
         ┌───────────▼──────────────────────┐
         │ 条件分岐: 環境別デプロイ判定      │
         └───┬──────────────────────┬────────┘
             │                      │
         ┌───▼──────┐         ┌─────▼──────────┐
         │ dev/test │         │ staging/prod   │
         │ 自動apply│         │ 手動承認後apply│
         └───┬──────┘         └─────┬──────────┘
             │                      │
         ┌───▼──────────────┐  ┌────▼──────────────┐
         │ 煙テスト実行      │  │ 段階的ロールアウト │
         │ (自動)           │  │ Blue/Green等     │
         └───┬──────────────┘  └────┬──────────────┘
             │                      │
         ┌───▼──────────────────────▼───┐
         │ ✓ デプロイ完了                │
         └───────────────────────────────┘
```

---

## 4. デプロイ前ゲート実装例

### Terraform コマンド出力パースによるチェック

```bash
#!/bin/bash
# pre-deploy-checks.sh

set -euo pipefail

echo "=== Deployment Gate Checks ==="

# 1. テスト実行状況確認
echo "1. Test execution rate check..."
TEST_PASSED=$(grep "Tests passed" test-results.log | awk '{print $3}')
TEST_TOTAL=$(grep "Tests total" test-results.log | awk '{print $3}')
RATE=$(echo "scale=2; $TEST_PASSED / $TEST_TOTAL * 100" | bc)

if (( $(echo "$RATE < 95" | bc -l) )); then
  echo "✗ FAIL: Test execution rate is $RATE% (required: >= 95%)"
  exit 1
fi
echo "✓ PASS: Test execution rate is $RATE%"

# 2. セキュリティスキャン結果
echo "2. Security scan check..."
CRITICAL=$(grep "CRITICAL" security-scan.json | wc -l)
if [ "$CRITICAL" -gt 0 ]; then
  echo "✗ FAIL: Found $CRITICAL critical vulnerabilities"
  exit 1
fi
echo "✓ PASS: No critical vulnerabilities"

# 3. Terraform Plan の変更内容確認
echo "3. Terraform plan validation..."
# リソース削除がないか確認
DELETIONS=$(grep "must be replaced" tfplan.txt | wc -l)
if [ "$DELETIONS" -gt 0 ]; then
  echo "⚠ WARNING: Plan contains resource replacements"
  # 本番環境の場合は確認が必要
  if [ "$ENVIRONMENT" == "prod" ]; then
    echo "✗ FAIL: Resource replacements in production require manual approval"
    exit 1
  fi
fi
echo "✓ PASS: No destructive changes"

echo ""
echo "✓ All deployment gates passed"
```

### GitHub Action での統合例

```yaml
- name: Pre-deploy checks
  run: |
    ./scripts/pre-deploy-checks.sh
  env:
    ENVIRONMENT: ${{ github.ref == 'refs/heads/main' && 'prod' || 'staging' }}
```

---

## 5. デプロイ戦略パターン

### Blue/Green デプロイ

用途: RDS upgrade, 大規模リソース置換

```hcl
variable "enable_green" {
  description = "Enable green environment"
  type        = bool
  default     = false
}

# Blue 環境（現在の本番）
resource "aws_rds_cluster" "blue" {
  count  = var.enable_green ? 0 : 1
  engine = "aurora-postgresql"
  # ...
}

# Green 環境（新バージョン）
resource "aws_rds_cluster" "green" {
  count  = var.enable_green ? 1 : 0
  engine = "aurora-postgresql"
  engine_version = "14.7" # アップグレード後
  # ...
}

# Route 53 で切替
resource "aws_route53_record" "db" {
  name    = "db.example.com"
  type    = "CNAME"
  records = [
    var.enable_green ?
      aws_rds_cluster.green[0].endpoint :
      aws_rds_cluster.blue[0].endpoint
  ]
}
```

デプロイフロー:
```
Day 1: terraform apply (enable_green=true) → Green 作成
Day 2-3: UAT
Day 4: terraform apply (Route 53 更新) → トラフィック切替
Day 5: terraform apply (enable_green=false) → Blue 削除
```

### Canary デプロイ

用途: アプリケーション更新

```hcl
variable "canary_traffic_percent" {
  description = "Traffic percentage to new version"
  type        = number
  default     = 0
}

resource "aws_lb_listener_rule" "canary" {
  listener_arn = aws_lb_listener.main.arn

  action {
    type = "forward"
    forward {
      target_group {
        arn    = aws_lb_target_group.current.arn
        weight = 100 - var.canary_traffic_percent
      }
      target_group {
        arn    = aws_lb_target_group.canary.arn
        weight = var.canary_traffic_percent
      }
    }
  }
}
```

デプロイフロー:
```
00:00 - canary_traffic_percent = 0 → 10
00:05 - メトリクス確認 (Error Rate, Latency) → OK ならフェーズ2へ
00:15 - canary_traffic_percent = 10 → 50
00:25 - メトリクス確認 → OK ならフェーズ3へ
00:35 - canary_traffic_percent = 50 → 100
00:45 - 完全切替完了
```

---

## 6. ブレイクグラス手順（緊急対応）

### レベル1: ローカル Terraform 実行

前提: 本番 State への AWS アクセスが可能

```bash
#!/bin/bash
# breakglass-level1.sh

set -euo pipefail

echo "=== BreakGlass Level 1: Local Terraform Apply ==="

# 1. State をダウンロード
aws s3 cp s3://tf-state-bucket/prod/terraform.tfstate /tmp/terraform.tfstate

# 2. 変更を確認
terraform init -backend=false
terraform plan -state=/tmp/terraform.tfstate -out=/tmp/tfplan

# 3. 承認者に計画内容を報告
echo "Plan output for approval:"
terraform show /tmp/tfplan

read -p "Approve and apply? (yes/no): " approval
if [ "$approval" != "yes" ]; then
  echo "Cancelled"
  exit 0
fi

# 4. Apply 実行
terraform apply /tmp/tfplan

# 5. State を S3 に再度アップロード
aws s3 cp /tmp/terraform.tfstate s3://tf-state-bucket/prod/terraform.tfstate

# 6. インシデント記録
echo "Incident log: BreakGlass Level1 applied at $(date)" >> /var/log/incidents.log
```

### レベル2: AWS Console 直接操作

前提: Terraform では対応できない場合

```
手順:
1. 何をするのか文書化
   - 対象リソース
   - 変更内容
   - 理由
   - 想定影響

2. 事前状態をバックアップ
   aws ec2 describe-security-groups --group-ids sg-xxx > /tmp/sg-backup.json

3. 最小限の変更を実施
   AWS Console で変更実行

4. 変更内容をログ記録
   - 実行日時
   - 実行者
   - 変更内容
   - 承認者

5. 事後に Terraform に反映
   GitHub PR で同じ変更を再現
```

### レベル3: データセンター停止時の復旧

```
前提: リージョン全体が停止した場合

手順:
1. 別リージョンの DR 環境を起動
2. Route 53 を新リージョンに向け替え
3. RTO/RPO を確認して本番切替
```

---

## 7. パイプライン構成ファイル例（GitHub Actions）

```yaml
name: Terraform CI/CD

on:
  push:
    branches: [main, develop]
    paths:
      - 'infra/terraform/**'
      - '.github/workflows/terraform.yml'

env:
  TF_VERSION: 1.5.0
  AWS_REGION: ap-northeast-1

jobs:
  validate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: hashicorp/setup-terraform@v2
        with:
          terraform_version: ${{ env.TF_VERSION }}
      - run: terraform fmt -check -recursive
      - run: terraform validate

  plan:
    needs: validate
    runs-on: ubuntu-latest
    permissions:
      id-token: write
      contents: read
    steps:
      - uses: actions/checkout@v3
      - uses: aws-actions/configure-aws-credentials@v2
        with:
          role-to-assume: ${{ secrets.AWS_ROLE_ARN }}
          aws-region: ${{ env.AWS_REGION }}
      - run: terraform init
      - run: terraform plan -out=tfplan
      - uses: actions/upload-artifact@v3
        with:
          name: tfplan
          path: tfplan

  security:
    needs: plan
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: aquasecurity/trivy-action@master
        with:
          scan-type: 'fs'
          scan-ref: 'infra/terraform'
          severity: 'CRITICAL'

  apply:
    if: github.ref == 'refs/heads/main' && github.event_name == 'push'
    needs: [plan, security]
    runs-on: ubuntu-latest
    permissions:
      id-token: write
      contents: read
    steps:
      - uses: actions/checkout@v3
      - uses: aws-actions/configure-aws-credentials@v2
        with:
          role-to-assume: ${{ secrets.AWS_ROLE_ARN }}
          aws-region: ${{ env.AWS_REGION }}
      - uses: actions/download-artifact@v3
        with:
          name: tfplan
      - run: terraform apply tfplan
```
