---
description: Terraformモジュール設計パターン（3層構造: modules/stacks/environments、変数設計、出力設計、テスト戦略）
---

# Terraformモジュール設計パターン

## 3層構造の詳細設計

### 層1: modules/ (再利用可能コンポーネント)

各 AWS リソースタイプごとの抽象化レイヤー

```
modules/
├── vpc/
│   ├── main.tf
│   ├── variables.tf
│   ├── outputs.tf
│   ├── locals.tf
│   └── README.md
├── security_group/
│   ├── main.tf
│   ├── variables.tf
│   └── outputs.tf
├── iam_role/
│   ├── main.tf
│   ├── variables.tf
│   └── outputs.tf
├── rds/
│   ├── main.tf
│   ├── variables.tf
│   └── outputs.tf
├── ecs_cluster/
│   ├── main.tf
│   ├── variables.tf
│   └── outputs.tf
└── cloudwatch/
    ├── main.tf
    ├── variables.tf
    └── outputs.tf
```

#### modules/vpc/ の実装例

```hcl
# modules/vpc/variables.tf
variable "cidr_block" {
  type        = string
  description = "VPC CIDR block (e.g., 10.0.0.0/16)"
  validation {
    condition     = can(cidrhost(var.cidr_block, 0))
    error_message = "Must be a valid CIDR block"
  }
}

variable "subnets" {
  type = list(object({
    name              = string
    cidr_block        = string
    availability_zone = string
    public            = bool
  }))
}

variable "environment" {
  type = string
}

variable "tags" {
  type    = map(string)
  default = {}
}

# modules/vpc/main.tf
resource "aws_vpc" "main" {
  cidr_block           = var.cidr_block
  enable_dns_hostnames = true
  enable_dns_support   = true

  tags = merge(
    var.tags,
    {
      Name        = "${var.environment}-vpc"
      Environment = var.environment
    }
  )
}

resource "aws_subnet" "main" {
  for_each = { for s in var.subnets : s.name => s }

  vpc_id                  = aws_vpc.main.id
  cidr_block              = each.value.cidr_block
  availability_zone       = each.value.availability_zone
  map_public_ip_on_launch = each.value.public

  tags = {
    Name = "${var.environment}-${each.key}"
  }
}

# modules/vpc/outputs.tf
output "vpc_id" {
  value       = aws_vpc.main.id
  description = "VPC ID"
}

output "subnet_ids" {
  value       = { for k, v in aws_subnet.main : k => v.id }
  description = "Map of subnet names to IDs"
}
```

### 層2: stacks/ (環境別Stack)

複数モジュールを組み合わせてアプリケーション基盤を構築

```
stacks/
├── shared_services/
│   ├── main.tf
│   ├── vpc.tf
│   ├── security.tf
│   ├── variables.tf
│   ├── outputs.tf
│   └── terraform.tfvars
├── web_app/
│   ├── main.tf
│   ├── ecs.tf
│   ├── alb.tf
│   ├── variables.tf
│   └── terraform.tfvars
└── data_pipeline/
    ├── main.tf
    ├── glue.tf
    ├── athena.tf
    ├── variables.tf
    └── terraform.tfvars
```

#### stacks/web_app/ の実装例

```hcl
# stacks/web_app/main.tf
terraform {
  required_version = ">= 1.0"
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }

  backend "s3" {
    bucket         = "tfstate-bucket"
    key            = "stacks/web_app/terraform.tfstate"
    region         = "ap-northeast-1"
    encrypt        = true
    dynamodb_table = "terraform-lock"
  }
}

provider "aws" {
  region = var.aws_region

  default_tags {
    tags = {
      Environment = var.environment
      ManagedBy   = "Terraform"
      Project     = var.project_name
    }
  }
}

# VPC モジュール呼び出し
module "vpc" {
  source = "../../modules/vpc"

  cidr_block = var.vpc_cidr
  subnets    = var.subnets
  environment = var.environment
  tags       = var.common_tags
}

# Security Group モジュール呼び出し
module "alb_sg" {
  source = "../../modules/security_group"

  name        = "alb-sg"
  description = "ALB Security Group"
  vpc_id      = module.vpc.vpc_id

  ingress_rules = [
    {
      protocol    = "tcp"
      from_port   = 80
      to_port     = 80
      cidr_blocks = ["0.0.0.0/0"]
    },
    {
      protocol    = "tcp"
      from_port   = 443
      to_port     = 443
      cidr_blocks = ["0.0.0.0/0"]
    }
  ]

  egress_rules = [
    {
      protocol    = "-1"
      from_port   = 0
      to_port     = 0
      cidr_blocks = ["0.0.0.0/0"]
    }
  ]

  tags = var.common_tags
}

# ECS Cluster モジュール呼び出し
module "ecs_cluster" {
  source = "../../modules/ecs_cluster"

  cluster_name = "${var.environment}-app-cluster"
  subnet_ids   = module.vpc.private_subnet_ids
  # その他の設定...
}
```

### 層3: environments/ (環境別変数)

dev/stg/prod ごとに異なる値を定義

```
environments/
├── dev.tfvars
├── stg.tfvars
└── prod.tfvars
```

#### environments/dev.tfvars

```hcl
aws_region   = "ap-northeast-1"
environment  = "dev"
project_name = "company-web-app"

vpc_cidr = "10.0.0.0/16"

subnets = [
  {
    name              = "public-1a"
    cidr_block        = "10.0.1.0/24"
    availability_zone = "ap-northeast-1a"
    public            = true
  },
  {
    name              = "public-1c"
    cidr_block        = "10.0.2.0/24"
    availability_zone = "ap-northeast-1c"
    public            = true
  },
  {
    name              = "private-1a"
    cidr_block        = "10.0.11.0/24"
    availability_zone = "ap-northeast-1a"
    public            = false
  },
  {
    name              = "private-1c"
    cidr_block        = "10.0.12.0/24"
    availability_zone = "ap-northeast-1c"
    public            = false
  }
]

# 開発環境: インスタンス数少なめ
ecs_desired_count = 1
rds_instance_class = "db.t3.micro"

# 開発環境: バックアップ無効
rds_backup_retention_days = 0

common_tags = {
  Owner       = "dev-team@company.com"
  CostCenter  = "CC-DEV"
  Compliance  = "dev"
}
```

#### environments/prod.tfvars

```hcl
aws_region   = "ap-northeast-1"
environment  = "prod"
project_name = "company-web-app"

vpc_cidr = "10.2.0.0/16"  # 異なるCIDR

subnets = [
  # 同じ構造だが CIDR が異なる
  # ...
]

# 本番環境: インスタンス数多め
ecs_desired_count = 3
rds_instance_class = "db.r6g.xlarge"

# 本番環境: バックアップ厚め
rds_backup_retention_days = 30
rds_multi_az              = true

common_tags = {
  Owner       = "platform-team@company.com"
  CostCenter  = "CC-PROD"
  Compliance  = "ismap"
}
```

## 変数設計のベストプラクティス

### 変数ファイル分割（関心の分離）

```
stacks/web_app/
├── main.tf           # Provider, Backend, Module呼び出し
├── variables.tf      # 全変数定義
├── outputs.tf        # 出力定義
├── locals.tf         # 計算用ローカル変数
├── vpc.tf            # VPC関連のローカル変数・リソース
├── ecs.tf            # ECS関連のローカル変数・リソース
├── alb.tf            # ALB関連のローカル変数・リソース
└── environments/
    ├── dev.tfvars
    ├── stg.tfvars
    └── prod.tfvars
```

### locals.tf の活用（計算値の中央管理）

```hcl
# locals.tf
locals {
  # 環境別の自動設定
  environment_configs = {
    dev = {
      ecs_desired_count      = 1
      rds_instance_class     = "db.t3.micro"
      backup_retention_days  = 0
      nat_gateway_per_az     = false
    }
    stg = {
      ecs_desired_count      = 2
      rds_instance_class     = "db.t3.small"
      backup_retention_days  = 7
      nat_gateway_per_az     = true
    }
    prod = {
      ecs_desired_count      = 3
      rds_instance_class     = "db.r6g.xlarge"
      backup_retention_days  = 30
      nat_gateway_per_az     = true
    }
  }

  env_config = local.environment_configs[var.environment]

  # タグのマージ
  final_tags = merge(
    var.common_tags,
    {
      Environment = var.environment
      ManagedBy   = "Terraform"
      CreatedAt   = timestamp()
    }
  )

  # VPC計算値
  vpc_azs = slice(data.aws_availability_zones.available.names, 0, 2)
}

# 使用例:
# resource "aws_db_instance" "main" {
#   instance_class = local.env_config.rds_instance_class
# }
```

## 出力設計（クロススタック参照）

### outputs.tf 設計パターン

```hcl
# stacks/shared_services/outputs.tf
output "vpc_id" {
  value       = module.vpc.vpc_id
  description = "VPC ID for reference in other stacks"
}

output "vpc_cidr" {
  value       = module.vpc.cidr_block
  description = "VPC CIDR block"
}

output "private_subnet_ids" {
  value       = module.vpc.private_subnet_ids
  description = "Private subnet IDs"
}

output "alb_sg_id" {
  value       = module.alb_sg.security_group_id
  description = "ALB Security Group ID"
}

# クロススタック参照用に structured output
output "shared_resources" {
  value = {
    vpc_id               = module.vpc.vpc_id
    private_subnet_ids   = module.vpc.private_subnet_ids
    alb_sg_id            = module.alb_sg.security_group_id
    database_sg_id       = module.database_sg.security_group_id
  }
  description = "All shared resource IDs for cross-stack reference"
}
```

### クロススタック参照（data source を使用）

```hcl
# stacks/web_app/main.tf
data "terraform_remote_state" "shared" {
  backend = "s3"

  config = {
    bucket = "tfstate-bucket"
    key    = "stacks/shared_services/terraform.tfstate"
    region = var.aws_region
  }
}

# 参照:
module "ecs_security_group" {
  source = "../../modules/security_group"

  name        = "ecs-sg"
  description = "ECS Security Group"
  vpc_id      = data.terraform_remote_state.shared.outputs.vpc_id

  ingress_rules = [
    {
      protocol        = "tcp"
      from_port       = 8080
      to_port         = 8080
      security_groups = [data.terraform_remote_state.shared.outputs.alb_sg_id]
    }
  ]
}
```

## テスト戦略

### Unit Test (terraform test)

```hcl
# tests/modules/vpc/vpc.tftest.hcl
run "plan_vpc" {
  command = plan

  variables {
    cidr_block  = "10.0.0.0/16"
    environment = "test"
    subnets = [
      {
        name              = "test-subnet"
        cidr_block        = "10.0.1.0/24"
        availability_zone = "ap-northeast-1a"
        public            = true
      }
    ]
  }

  assert {
    condition     = aws_vpc.main.cidr_block == "10.0.0.0/16"
    error_message = "VPC CIDR block not set correctly"
  }

  assert {
    condition     = length(aws_subnet.main) == 1
    error_message = "Subnet not created"
  }
}
```

### Integration Test (terraform apply on staging)

```bash
#!/bin/bash
# scripts/test-integration.sh

# Staging環境でテストデプロイ
cd stacks/web_app

# Plan実行
terraform plan -var-file=../environments/stg.tfvars -out=tfplan.out

# Checkovセキュリティスキャン
checkov -f tfplan.out --framework terraform --quiet

# Apply実行
terraform apply tfplan.out

# 疎通確認テスト
./tests/connectivity_test.sh stg

# Cleanup
terraform destroy -auto-approve
```

### Validation Test (tflint)

```hcl
# .tflint.hcl
config {
  format = "compact"
}

plugin "terraform" {
  enabled = true
}

rule "terraform_naming_convention" {
  enabled = true
  format  = "snake_case"
}

rule "terraform_standard_module_structure" {
  enabled = true
}

rule "terraform_unused_declarations" {
  enabled = true
}
```

実行:
```bash
tflint --init  # プラグイン初期化
tflint         # 実行
```

## State管理のベストプラクティス

### Backend 設定（S3 + DynamoDB）

```hcl
# stacks/web_app/main.tf の backend
terraform {
  backend "s3" {
    bucket         = "tfstate-bucket-prod"
    key            = "stacks/web_app/terraform.tfstate"
    region         = "ap-northeast-1"
    encrypt        = true
    dynamodb_table = "terraform-lock"
  }
}

# AWS側の準備:
# 1. S3 バケット作成 (tfstate-bucket-prod)
# 2. Versioning 有効化
# 3. Public Access Block 有効化
# 4. DynamoDB テーブル作成 (terraform-lock)
#    - Partition Key: LockID (String)
```

### State File の移行

```bash
# 古い backend から state 取得
terraform pull > old.tfstate

# 新しい backend に切り替え
# main.tf の backend ブロック変更後
terraform init -reconfigure

# State 上書きの確認
terraform state list
```

## Terraformモジュール設計チェックリスト

- [ ] modules/ が単一責任の原則に従い、再利用可能
- [ ] 全 variable が明示的な型定義（any なし）
- [ ] Module 間の依存関係が単一方向（循環参照なし）
- [ ] outputs が下層モジュールから上層へ適切に伝播
- [ ] 環境別 tfvars が適切に分離
- [ ] locals.tf で計算値を中央管理
- [ ] クロススタック参照が terraform_remote_state で実装
- [ ] Unit Test がモジュール単位で存在
- [ ] Integration Test がスタック単位で実装
- [ ] tflint ルールが CI/CD に統合
- [ ] Backend S3 + DynamoDB で State Lock 実装
- [ ] State ファイルバックアップが月1回以上確認
