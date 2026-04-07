---
description: Terraform 3層構造規約（modules/stacks/environments、命名規則、変数設計、tfvarsパラメーター化、Policy as Code）
---

# Terraform 3層構造規約（GC案件用）

## 概要

GC インフラ案件向けの Terraform コード構造を統一します。3層構造（modules/stacks/environments）により、再利用性と保守性を実現します。

---

## ディレクトリ構成

```
/infra/terraform/
├── modules/                          # 層1: 再利用可能な小単位
│   ├── vpc/
│   │   ├── main.tf
│   │   ├── variables.tf
│   │   ├── outputs.tf
│   │   ├── terraform.tfvars
│   │   └── README.md
│   ├── security_group/
│   ├── rds/
│   ├── iam/
│   ├── monitoring/
│   └── ...
├── stacks/                           # 層2: 複数モジュール組み合わせ
│   ├── networking/
│   │   ├── main.tf
│   │   ├── variables.tf
│   │   ├── outputs.tf
│   │   └── terraform.tfvars
│   ├── compute/
│   ├── database/
│   ├── monitoring/
│   └── ...
├── environments/                     # 層3: 環境別設定
│   ├── dev/
│   │   ├── terraform.tfvars
│   │   ├── backend.tf
│   │   └── main.tf (各スタックの参照)
│   ├── staging/
│   │   ├── terraform.tfvars
│   │   ├── backend.tf
│   │   └── main.tf
│   └── prod/
│       ├── terraform.tfvars
│       ├── backend.tf
│       └── main.tf
├── variables.tf                      # グローバル変数（全層共通）
├── outputs.tf                        # グローバル出力
├── terraform.tf                      # Terraform バージョン指定
├── providers.tf                      # Provider 定義
└── policy/                           # Policy as Code
    ├── sentinel.hcl
    └── rego/ (OPA)
```

---

## 層別役割定義

### 層1: modules（再利用可能な最小単位）

**目的**: 特定の機能を実装する最小単位のモジュール

**例**: VPC, SecurityGroup, IAM Role等

#### modules/vpc/main.tf

```hcl
# VPC モジュール（再利用可能）

resource "aws_vpc" "main" {
  cidr_block           = var.cidr_block
  enable_dns_hostnames = true
  enable_dns_support   = true

  tags = merge(
    var.common_tags,
    { Name = "${var.environment}-vpc" }
  )
}

resource "aws_subnet" "private" {
  for_each = var.private_subnets

  vpc_id            = aws_vpc.main.id
  cidr_block        = each.value.cidr
  availability_zone = each.value.az

  tags = merge(
    var.common_tags,
    { Name = "${var.environment}-private-${each.key}" }
  )
}

# 複数AZのNAT Gateway
resource "aws_nat_gateway" "main" {
  for_each = var.public_subnets

  allocation_id = aws_eip.main[each.key].id
  subnet_id     = aws_subnet.public[each.key].id

  depends_on = [aws_internet_gateway.main]

  tags = merge(
    var.common_tags,
    { Name = "${var.environment}-nat-${each.key}" }
  )
}
```

#### modules/vpc/variables.tf

```hcl
# 必須変数
variable "environment" {
  description = "Environment name (dev/staging/prod)"
  type        = string
  validation {
    condition     = contains(["dev", "staging", "prod"], var.environment)
    error_message = "Environment must be dev, staging, or prod"
  }
}

variable "cidr_block" {
  description = "CIDR block for VPC"
  type        = string
  validation {
    condition     = can(cidrhost(var.cidr_block, 0))
    error_message = "Must be valid CIDR block"
  }
}

variable "private_subnets" {
  description = "Private subnet configuration"
  type = map(object({
    cidr = string
    az   = string
  }))
  default = {}
}

# 共通タグ
variable "common_tags" {
  description = "Common tags for all resources"
  type        = map(string)
  default = {
    managed_by = "terraform"
    project    = "gc-infra"
  }
}
```

#### modules/vpc/outputs.tf

```hcl
output "vpc_id" {
  description = "VPC ID"
  value       = aws_vpc.main.id
}

output "vpc_cidr" {
  description = "VPC CIDR block"
  value       = aws_vpc.main.cidr_block
}

output "private_subnet_ids" {
  description = "Private subnet IDs"
  value       = { for k, v in aws_subnet.private : k => v.id }
}

output "nat_gateway_ids" {
  description = "NAT Gateway IDs"
  value       = { for k, v in aws_nat_gateway.main : k => v.id }
}
```

### 層2: stacks（機能単位でモジュールを組み合わせ）

**目的**: 関連するモジュールを組み合わせて、ビジネス機能を実装

**例**: networking_stack（VPC + SecurityGroup + NAT), database_stack（RDS + Backup）

#### stacks/networking/main.tf

```hcl
# Networking Stack
# VPC, SecurityGroup, ルーティングを統合

module "vpc" {
  source = "../../modules/vpc"

  environment   = var.environment
  cidr_block    = var.vpc_cidr
  private_subnets = var.private_subnets
  public_subnets  = var.public_subnets
  common_tags     = local.common_tags
}

module "security_group_web" {
  source = "../../modules/security_group"

  environment = var.environment
  vpc_id      = module.vpc.vpc_id
  name        = "web-sg"

  ingress_rules = [
    {
      from_port   = 80
      to_port     = 80
      protocol    = "tcp"
      cidr_blocks = ["0.0.0.0/0"]
    },
    {
      from_port   = 443
      to_port     = 443
      protocol    = "tcp"
      cidr_blocks = ["0.0.0.0/0"]
    }
  ]

  common_tags = local.common_tags
}

# Internet Gateway
resource "aws_internet_gateway" "main" {
  vpc_id = module.vpc.vpc_id

  tags = merge(
    local.common_tags,
    { Name = "${var.environment}-igw" }
  )
}

# Route Table: Public
resource "aws_route_table" "public" {
  vpc_id = module.vpc.vpc_id

  route {
    cidr_block      = "0.0.0.0/0"
    gateway_id      = aws_internet_gateway.main.id
  }

  tags = merge(
    local.common_tags,
    { Name = "${var.environment}-rt-public" }
  )
}
```

#### stacks/networking/variables.tf

```hcl
variable "environment" {
  type = string
}

variable "vpc_cidr" {
  type        = string
  description = "CIDR block for VPC (e.g., 10.0.0.0/16)"
}

variable "private_subnets" {
  type = map(object({
    cidr = string
    az   = string
  }))
}

variable "public_subnets" {
  type = map(object({
    cidr = string
    az   = string
  }))
}
```

### 層3: environments（環境別の設定）

**目的**: dev/staging/prod の各環境固有の値を保持

#### environments/prod/terraform.tfvars

```hcl
# 本番環境の設定値

environment = "prod"

vpc_cidr = "10.0.0.0/16"

private_subnets = {
  "1a" = {
    cidr = "10.0.10.0/24"
    az   = "ap-northeast-1a"
  },
  "1c" = {
    cidr = "10.0.11.0/24"
    az   = "ap-northeast-1c"
  }
}

public_subnets = {
  "1a" = {
    cidr = "10.0.1.0/24"
    az   = "ap-northeast-1a"
  },
  "1c" = {
    cidr = "10.0.2.0/24"
    az   = "ap-northeast-1c"
  }
}

# RDS
rds_instance_class = "db.r5.large"
rds_multi_az       = true
rds_backup_retention = 30

# その他本番環境固有の設定
```

#### environments/prod/main.tf

```hcl
# 本番環境の統合設定

terraform {
  backend "s3" {
    bucket         = "tf-state-prod"
    key            = "prod/terraform.tfstate"
    region         = "ap-northeast-1"
    encrypt        = true
    dynamodb_table = "terraform-lock"
  }
}

provider "aws" {
  region = "ap-northeast-1"
}

# スタック参照
module "networking" {
  source = "../../stacks/networking"

  environment     = var.environment
  vpc_cidr        = var.vpc_cidr
  private_subnets = var.private_subnets
  public_subnets  = var.public_subnets
}

module "database" {
  source = "../../stacks/database"

  environment           = var.environment
  vpc_id                = module.networking.vpc_id
  db_subnet_ids         = module.networking.private_subnet_ids
  db_instance_class     = var.rds_instance_class
  db_multi_az           = var.rds_multi_az
  db_backup_retention   = var.rds_backup_retention
}
```

---

## 命名規則

### リソース命名規約

**基本形**: `{environment}-{resource_type}-{purpose}`

```
例:
- prod-vpc-main
- prod-sg-web
- prod-rds-mysql
- prod-asg-app
- prod-iam-role-app
- prod-s3-logs
```

### ファイル名規則

**HCL ファイル:**
```
main.tf              # リソース定義
variables.tf         # 入力変数定義
outputs.tf           # 出力値定義
terraform.tfvars     # 環境別パラメータ
backend.tf           # State 管理
locals.tf            # ローカル変数
```

### 変数命名規則

```hcl
# リソース属性を反映
variable "vpc_cidr" { }          # VPC 属性
variable "instance_count" { }    # インスタンス数
variable "enable_monitoring" { } # Boolean フラグ

# Avoid: 曖昧な名前
variable "config" { }    # NG: 何の設定か不明確
variable "value" { }     # NG: 何の値か不明確
```

---

## for_each vs count 使い分け

### for_each（推奨）

```hcl
# 用途: 論理的に異なるリソースの複数作成

resource "aws_subnet" "private" {
  for_each = var.private_subnets  # map型で複数定義

  vpc_id            = aws_vpc.main.id
  cidr_block        = each.value.cidr
  availability_zone = each.value.az
}

# 各サブネットにアクセス可能
# aws_subnet.private["1a"], aws_subnet.private["1c"]
```

### count（制限的に使用）

```hcl
# 用途: 同じリソースの N 個作成（まれ）

resource "aws_eip" "nat" {
  count  = var.create_nat_gateway ? 1 : 0
  domain = "vpc"
}

# 条件付きリソース作成時のみ使用
```

---

## Policy as Code（OPA / Sentinel）

### Sentinel ポリシー例

```hcl
# must-use-encryption.sentinel
# 全リソースの暗号化を強制

import "tfplan/v2" as tfplan

encrypt_resources = {
  "aws_ebs_volume": ["encrypted"],
  "aws_s3_bucket": ["sse_algorithm"],
  "aws_rds_cluster": ["storage_encrypted"]
}

deny_unencrypted = rule {
  all tfplan.resource_changes as rc {
    rc.type not in keys(encrypt_resources) or
    encrypt_resources[rc.type] all satisfied by (attr) {
      rc.change.after[attr] == true
    }
  }
}

main = rule {
  deny_unencrypted
}
```

### OPA/Rego ポリシー例

```rego
# modules/vpc/cidr_validation.rego
# VPC CIDR は /16 以上であること

package terraform

deny[msg] {
    resource := input.resource_changes[_]
    resource.type == "aws_vpc"

    cidr := resource.change.after.cidr_block
    # /16 より小さい CIDR をチェック
    not valid_cidr_size(cidr)

    msg := sprintf("VPC CIDR must be /16 or larger: %s", [cidr])
}

valid_cidr_size(cidr) {
    startswith(cidr, "10")
    contains(cidr, "/16")
}
```

---

## テスト（terraform test）

### テストフレームワーク

```hcl
# modules/vpc/test/vpc.tftest.hcl

run "vpc_creation" {
  command = plan

  variables {
    environment = "test"
    cidr_block  = "10.0.0.0/16"
    private_subnets = {
      "1a" = { cidr = "10.0.1.0/24", az = "ap-ne-1a" }
    }
  }

  assert {
    condition     = aws_vpc.main.cidr_block == "10.0.0.0/16"
    error_message = "VPC CIDR mismatch"
  }

  assert {
    condition     = length(aws_subnet.private) == 1
    error_message = "Private subnet count mismatch"
  }
}

run "security_group_rules" {
  command = plan

  # Web SG が HTTP/HTTPS を許可しているか
  assert {
    condition = contains(
      [aws_security_group.web.ingress[*].from_port],
      80
    )
    error_message = "HTTP (80) must be allowed"
  }
}
```

---

## ベストプラクティス

### 1. 常にバージョン制約を指定

```hcl
terraform {
  required_version = ">= 1.5"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}
```

### 2. for_each で map キーを活用

```hcl
# ✓ Good: 識別可能なキー
private_subnets = {
  "1a" = { cidr = "10.0.1.0/24", az = "ap-ne-1a" }
  "1c" = { cidr = "10.0.2.0/24", az = "ap-ne-1c" }
}

# ✗ Bad: 順序に依存
private_subnets = [
  { cidr = "10.0.1.0/24", az = "ap-ne-1a" },
  { cidr = "10.0.2.0/24", az = "ap-ne-1c" }
]
```

### 3. 全リソースに common_tags を付与

```hcl
locals {
  common_tags = {
    Environment = var.environment
    Project     = "gc-infra"
    ManagedBy   = "terraform"
    CreatedAt   = timestamp()
  }
}

resource "aws_vpc" "main" {
  # ...
  tags = merge(
    local.common_tags,
    { Name = "${var.environment}-vpc" }
  )
}
```

### 4. 複雑なロジックは locals で分離

```hcl
locals {
  enable_multi_az = var.environment == "prod"

  database_config = {
    instance_class  = var.environment == "prod" ? "db.r5.large" : "db.t3.micro"
    backup_retention = var.environment == "prod" ? 30 : 7
    multi_az        = local.enable_multi_az
  }
}
```

---

## デプロイメントフロー

```bash
# 初期化
terraform init -backend-config="environments/prod/backend.tf"

# 計画
terraform plan -var-file="environments/prod/terraform.tfvars" -out=tfplan

# 適用
terraform apply tfplan

# 状態確認
terraform state list
terraform state show aws_vpc.main
```
