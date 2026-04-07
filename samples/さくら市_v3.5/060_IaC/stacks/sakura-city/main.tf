# さくら市マイナンバー基盤 - sakura-city stack - main.tf
# 作成日: 2026-04-06
# 概要: 全モジュール（vpc/security/rds/ecs）の呼び出しとモジュール間依存関係の定義

terraform {
  required_version = ">= 1.6.0"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

provider "aws" {
  region = var.aws_region

  default_tags {
    tags = local.common_tags
  }
}

# ---------------------------------------------------------------------------
# Step 1: VPC（ネットワーク基盤）
# 依存: なし（最初に作成）
# ---------------------------------------------------------------------------
module "vpc" {
  source = "../../modules/vpc"

  vpc_cidr                 = var.vpc_cidr
  az_list                  = var.az_list
  subnet_cidrs             = local.subnet_cidrs
  environment              = var.environment
  flow_logs_retention_days = var.flow_logs_retention_days
  tags                     = local.common_tags
}

# ---------------------------------------------------------------------------
# Step 2: Security（セキュリティグループ / KMS / IAM）
# 依存: module.vpc（vpc_id、vpc_cidr が必要）
# ---------------------------------------------------------------------------
module "security" {
  source = "../../modules/security"

  environment       = var.environment
  vpc_id            = module.vpc.vpc_id
  vpc_cidr          = module.vpc.vpc_cidr
  ecs_service_names = local.ecs_service_names

  kms_settings = {
    deletion_window_in_days = var.kms_deletion_window_in_days
    enable_key_rotation     = true
  }

  tags = local.common_tags

  depends_on = [module.vpc]
}

# ---------------------------------------------------------------------------
# Step 3: RDS / ElastiCache（データ層）
# 依存: module.vpc（db_subnet_ids）、module.security（sg_ids）
# ---------------------------------------------------------------------------
module "rds" {
  source = "../../modules/rds"

  environment             = var.environment
  db_subnet_ids           = values(module.vpc.db_subnet_ids)
  rds_security_group_id   = module.security.sg_ids["rds"]
  redis_security_group_id = module.security.sg_ids["redis"]

  # RDS 設定
  db_instance_class     = var.db_instance_class
  db_name               = var.db_name
  db_username           = var.db_username
  multi_az              = var.db_multi_az
  allocated_storage     = var.db_allocated_storage
  max_allocated_storage = var.db_max_allocated_storage
  backup_retention      = var.db_backup_retention
  kms_key_id            = module.security.kms_key_arns["rds"]

  # Redis 設定
  redis_node_type           = var.redis_node_type
  redis_num_cache_clusters  = var.redis_num_cache_clusters
  redis_snapshot_retention  = var.redis_snapshot_retention

  tags = local.common_tags

  depends_on = [module.vpc, module.security]
}

# ---------------------------------------------------------------------------
# Step 4: ECS（アプリケーション層）
# 依存: module.vpc、module.security、module.rds（起動順序保証）
# ---------------------------------------------------------------------------
module "ecs" {
  source = "../../modules/ecs"

  cluster_name = "${var.environment}-${var.ecs_cluster_name}"
  environment  = var.environment
  vpc_id       = module.vpc.vpc_id

  services = local.ecs_services

  alb_settings = {
    public_subnet_ids = values(module.vpc.public_subnet_ids)
    app_subnet_ids    = values(module.vpc.app_subnet_ids)
    external_sg_id    = module.security.sg_ids["alb_ext"]
    internal_sg_id    = module.security.sg_ids["alb_int"]
    certificate_arn   = var.alb_certificate_arn
    access_log_bucket = var.alb_access_log_bucket
  }

  ecr_repos          = var.ecr_repos
  kms_key_arn        = module.security.kms_key_arns["s3"]
  log_retention_days = var.log_retention_days

  tags = local.common_tags

  depends_on = [module.vpc, module.security, module.rds]
}
