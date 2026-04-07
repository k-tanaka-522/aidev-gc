# さくら市マイナンバー基盤 - sakura-city stack - outputs.tf
# 作成日: 2026-04-06
# 概要: スタック全体の主要リソース ARN / ID / Endpoint を出力

# ---------------------------------------------------------------------------
# VPC 出力
# ---------------------------------------------------------------------------
output "vpc_id" {
  description = "VPC の ID"
  value       = module.vpc.vpc_id
}

output "vpc_cidr" {
  description = "VPC の CIDR ブロック"
  value       = module.vpc.vpc_cidr
}

output "public_subnet_ids" {
  description = "パブリックサブネットの ID マップ"
  value       = module.vpc.public_subnet_ids
}

output "app_subnet_ids" {
  description = "アプリケーション層サブネットの ID マップ"
  value       = module.vpc.app_subnet_ids
}

output "db_subnet_ids" {
  description = "DB 層サブネットの ID マップ"
  value       = module.vpc.db_subnet_ids
}

output "mgmt_subnet_ids" {
  description = "管理層サブネットの ID マップ"
  value       = module.vpc.mgmt_subnet_ids
}

output "nat_gateway_ids" {
  description = "NAT Gateway の ID マップ"
  value       = module.vpc.nat_gateway_ids
}

output "vpc_endpoint_ids" {
  description = "VPC Endpoint の ID マップ"
  value       = module.vpc.endpoint_ids
}

# ---------------------------------------------------------------------------
# セキュリティ出力
# ---------------------------------------------------------------------------
output "security_group_ids" {
  description = "セキュリティグループの ID マップ（alb_ext / alb_int / ecs_portal / ecs_admin / ecs_worker / rds / redis / mgmt）"
  value       = module.security.sg_ids
}

output "kms_key_arns" {
  description = "KMS CMK の ARN マップ（rds / s3 / ebs）"
  value       = module.security.kms_key_arns
}

output "kms_key_ids" {
  description = "KMS CMK の ID マップ（rds / s3 / ebs）"
  value       = module.security.kms_key_ids
}

output "ecs_execution_role_arn" {
  description = "ECS タスク実行ロール（共通）の ARN"
  value       = module.security.ecs_execution_role_arn
}

output "ecs_task_role_arns" {
  description = "ECS タスクロールの ARN マップ（portal / admin / worker）"
  value       = module.security.ecs_task_role_arns
}

# ---------------------------------------------------------------------------
# RDS / Redis 出力
# ---------------------------------------------------------------------------
output "db_endpoint" {
  description = "RDS PostgreSQL の接続エンドポイント（ホスト名:ポート）"
  value       = module.rds.db_endpoint
  sensitive   = true
}

output "db_name" {
  description = "RDS データベース名"
  value       = module.rds.db_name
}

output "db_arn" {
  description = "RDS インスタンスの ARN"
  value       = module.rds.db_arn
}

output "db_master_user_secret_arn" {
  description = "RDS マスターユーザーパスワードの Secrets Manager シークレット ARN"
  value       = module.rds.db_master_user_secret_arn
  sensitive   = true
}

output "db_subnet_group_name" {
  description = "RDS サブネットグループ名"
  value       = module.rds.db_subnet_group_name
}

output "redis_primary_endpoint" {
  description = "ElastiCache Redis プライマリエンドポイント"
  value       = module.rds.redis_primary_endpoint
  sensitive   = true
}

output "redis_arn" {
  description = "ElastiCache レプリケーショングループの ARN"
  value       = module.rds.redis_arn
}

# ---------------------------------------------------------------------------
# ECS 出力
# ---------------------------------------------------------------------------
output "ecs_cluster_arn" {
  description = "ECS クラスターの ARN"
  value       = module.ecs.cluster_arn
}

output "ecs_cluster_name" {
  description = "ECS クラスター名"
  value       = module.ecs.cluster_name
}

output "ecs_service_arns" {
  description = "ECS サービスの ARN マップ（portal / admin / worker）"
  value       = module.ecs.service_arns
}

output "alb_dns_names" {
  description = "ALB の DNS 名マップ（external / internal）"
  value       = module.ecs.alb_dns_names
}

output "alb_arns" {
  description = "ALB の ARN マップ（external / internal）"
  value       = module.ecs.alb_arns
}

output "ecr_urls" {
  description = "ECR リポジトリの URL マップ（portal / admin / worker）"
  value       = module.ecs.ecr_urls
}
