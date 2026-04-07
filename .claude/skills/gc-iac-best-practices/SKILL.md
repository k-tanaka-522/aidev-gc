---
description: GC環境でのIaC原則（GCテンプレートとの共存、タグ戦略、ドリフト検知、承認フロー）
---

# GC環境でのIaC原則

## GCテンプレート と IaC の共存戦略

### パターン1: テンプレート優先（推奨）

```
GC公式テンプレート
  ↓ (デプロイ)
Terraform/CloudFormation IaC
  ↓ (カプセル化)
Terraform Modules / CloudFormation Nested Stacks
```

**ルール**:
- GC テンプレート適用後に IaC を上書きしない
- IaC は「テンプレート以上のカスタマイズ」を表現
- 環境別差分（dev/stg/prod）のみ IaC で管理

### パターン2: IaC 優先

```
Terraform main.tf
  ├─ modules/
  │   ├─ landing_zone (GC Landing Zone を IaC化)
  │   ├─ security (GC Security Base を IaC化)
  │   └─ network (GC Network Base を IaC化)
  │
  └─ environments/
      ├─ dev.tfvars
      ├─ stg.tfvars
      └─ prod.tfvars
```

**ルール**:
- GC テンプレートの「構造」を Terraform で再現
- GC テンプレート更新時に Terraform コード も同期

## IaC コード設計ルール

### Rule 1: Resource Naming Convention

```hcl
# パターン: {environment}-{domain}-{resource_type}-{identifier}

# EC2 Instance
resource "aws_instance" "dev_app_web_1" {
  # dev: 環境
  # app: ドメイン（アプリケーション層）
  # web: リソースタイプ
  # 1: シーケンス番号
}

# RDS Instance
resource "aws_db_instance" "prod_data_mysql_primary" {}

# VPC
resource "aws_vpc" "shared_network_vpc" {}

# Security Group
resource "aws_security_group" "dev_app_sg_inbound" {}
```

### Rule 2: Tag Strategy

```hcl
locals {
  common_tags = {
    environment   = var.environment  # dev, stg, prod
    owner         = "team@company"   # 責任者
    cost_center   = "CC-001"         # 請求部門
    project       = var.project_name # プロジェクト名
    backup_policy = "daily"          # バックアップ頻度
    compliance    = "ismap"          # コンプライアンス
    created_by    = "terraform"      # 作成方法
    created_date  = timestamp()      # 作成日時
  }
}

resource "aws_instance" "example" {
  tags = merge(
    local.common_tags,
    {
      Name = "dev-app-web-1"
    }
  )
}
```

### Rule 3: Variable 型定義（any型禁止）

```hcl
# ❌ NG: any型
variable "config" {
  type = any
}

# ✅ OK: 明示的な型定義
variable "environment" {
  type        = string
  description = "Environment name (dev, stg, prod)"
  default     = "dev"
}

variable "instance_count" {
  type        = number
  description = "Number of instances"
  default     = 2
}

variable "subnets" {
  type        = list(string)
  description = "List of subnet IDs"
}

variable "tags" {
  type        = map(string)
  description = "Tags to apply"
  default     = {}
}

variable "db_config" {
  type = object({
    engine         = string
    version        = string
    instance_class = string
  })
}
```

### Rule 4: for_each 推奨（count は論理的に異なるリソースに使わない）

```hcl
# ❌ NG: count で複数同じタイプリソース
resource "aws_instance" "servers" {
  count = var.instance_count
  # index による条件分岐が複雑化
}

# ✅ OK: for_each で明示的にマッピング
variable "servers" {
  type = map(object({
    instance_type = string
    subnet_id     = string
  }))
}

resource "aws_instance" "servers" {
  for_each      = var.servers
  instance_type = each.value.instance_type
  subnet_id     = each.value.subnet_id

  tags = {
    Name = each.key  # server-web-1, server-app-1
  }
}

# 使用時:
# terraform apply -var-file="servers.tfvars"
# servers.tfvars:
# servers = {
#   "server-web-1" = {
#     instance_type = "t3.medium"
#     subnet_id     = "subnet-xxx"
#   }
# }
```

## ドリフト検知と修復

### ドリフト検知の定義

ドリフト: IaC（terraform.state）と実リソース（GC）の不整合

```
例:
  Terraform State: Security Group - Inbound 443, 80
  実リソース: Security Group - Inbound 443, 80, 22（手作業追加）
  → ドリフト検知 (Port 22)
```

### ドリフト検知ツール

#### 1. Terraform State Verification

```bash
# 定期実行（日次）
terraform plan -out=tfplan

# ドリフト検知（plan出力に差分あり）
# No changes, infrastructure matches configuration
#   → ドリフトなし
# Terraform will perform the following actions
#   → ドリフト検知（手作業での変更）
```

#### 2. AWS Config

```hcl
# Config Rule: ec2-security-group-audit-failed
# CloudWatch Events Trigger: Config Rule Non-Compliant
#   → Lambda 自動修復スクリプト起動
```

#### 3. CloudFormation Drift Detection

```hcl
resource "aws_cloudformation_stack_drift_detection" "example" {
  stack_name       = aws_cloudformation_stack.example.name
  logical_resource_id = aws_cloudformation_stack.example.id
}

# 出力: Drifted, In Sync, Unknown
```

### ドリフト修復ポリシー

```
修復フロー:

1. ドリフト検知
   ├─ 承認者に通知（Slack）
   └─ 4時間以内に調査

2. 原因分析
   ├─ IaC が古い → IaC update
   ├─ 手作業変更 → ロールバック
   └─ 運用上必要 → IaC approved

3. 修復実行
   ├─ IaC: terraform apply
   ├─ Manual: CloudFormation Rollback
   └─ 検証: terraform plan で確認

4. ドキュメント化
   ├─ 変更ログに記載
   └─ チェンジログボード登録
```

## CI/CD パイプライン承認フロー

### GitHub Actions パイプライン例

```yaml
name: Terraform CI/CD

on:
  pull_request:
    paths:
      - 'infrastructure/terraform/**'
  push:
    branches:
      - main
    paths:
      - 'infrastructure/terraform/**'

jobs:
  terraform_validate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: hashicorp/setup-terraform@v2
      - run: terraform fmt -check
      - run: terraform validate
      - run: terraform plan -out=tfplan

      # PR時: plan結果をコメント
      - uses: terraform-utils/comment-on-pr@v1
        if: github.event_name == 'pull_request'
        with:
          plan: ${{ steps.plan.outputs.stdout }}

  terraform_apply:
    needs: terraform_validate
    runs-on: ubuntu-latest
    if: github.ref == 'refs/heads/main' && github.event_name == 'push'
    environment:
      name: production
      reviewers: ['security-team']  # 承認者
    steps:
      - uses: actions/checkout@v3
      - uses: hashicorp/setup-terraform@v2
      - run: terraform apply tfplan

  # セキュリティスキャン
  terraform_security_scan:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: terraform-utils/checkov@v1
      - uses: aquasecurity/trivy@v1
        with:
          scan-type: 'config'
          scan-ref: 'infrastructure/terraform'
```

### 承認フロー

```
Pull Request Created
  ↓
Automated Checks
  ├─ terraform fmt check
  ├─ terraform validate
  ├─ terraform plan
  ├─ Security scan (Checkov, Trivy)
  └─ Cost estimation
  ↓
IF 全チェック成功:
  ├─ Code Review (2人以上)
  ├─ Security Team レビュー
  └─ Architecture Team レビュー
  ↓
Approval (LGTM)
  ↓
Merge to main
  ↓
CI/CD Pipeline
  ├─ terraform plan -detailed
  ├─ Manual Approval（本番）
  └─ terraform apply
```

## IaC オペレーション上の注意

### 禁止事項

- AWS Management Console での直接リソース作成（IaC化されていないリソース）
- terraform state ファイルの手作業編集
- 本番環境への `-auto-approve` フラグ使用
- .terraform ディレクトリのコミット（.gitignore に追加）
- Secrets のコード内埋め込み（AWS Secrets Manager 参照のみ）

### 推奨事項

- State ファイルの backend を S3 + DynamoDB Lock で共有
- 環境別 tfvars ファイルの分離（環境変数注入は避ける）
- 月次の State ファイルバックアップ確認
- 定期的な terraform plan -refresh を実行
- terraform workspace 使用（環境分離）

## IaC ベストプラクティス チェックリスト

- [ ] Resource naming が命名規則に準拠
- [ ] 全 Resource に common tags 付与
- [ ] Variable が明示的な型定義（any なし）
- [ ] for_each が count より優先使用
- [ ] ドリフト検知が日次で実行可能
- [ ] CI/CD パイプラインで terraform plan 自動実行
- [ ] 本番への terraform apply は Manual Approval 必須
- [ ] Security scan (Checkov等) が CI に統合
- [ ] State backend が S3 + DynamoDB Lock
- [ ] terraform workspace が環境別に分離
- [ ] ドリフト修復ポリシーがドキュメント化
