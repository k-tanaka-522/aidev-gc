# さくら市マイナンバー基盤 - stg environment - terraform.tfvars
# 作成日: 2026-04-06
# 概要: ステージング環境の全変数値（スモールインスタンス、Multi-AZ 無効でコスト最適化）

# ---------------------------------------------------------------------------
# 基本設定
# ---------------------------------------------------------------------------
environment = "stg"
aws_region  = "ap-northeast-1"

# ---------------------------------------------------------------------------
# VPC 設定（本番と別 CIDR で分離）
# ---------------------------------------------------------------------------
vpc_cidr = "10.2.0.0/16"

az_list = [
  "ap-northeast-1a",
  "ap-northeast-1c"
]

flow_logs_retention_days = 90

# ---------------------------------------------------------------------------
# RDS 設定（ステージング: db.t3.medium、Multi-AZ 無効、7日バックアップ）
# ---------------------------------------------------------------------------
db_instance_class        = "db.t3.medium"
db_name                  = "sakura_mynumber"
db_username              = "sakura_admin"
db_multi_az              = false
db_allocated_storage     = 50
db_max_allocated_storage = 200
db_backup_retention      = 7

# ---------------------------------------------------------------------------
# ElastiCache 設定（ステージング: cache.t3.medium、シングルノード）
# ---------------------------------------------------------------------------
redis_node_type          = "cache.t3.medium"
redis_num_cache_clusters = 1
redis_snapshot_retention = 1

# ---------------------------------------------------------------------------
# ECS 設定（ステージング: 小スペック、Fargate SPOT 中心）
# ---------------------------------------------------------------------------
ecs_cluster_name   = "sakura-city-mynumber"
ecr_repos          = ["portal", "admin", "worker"]
log_retention_days = 90

# ---------------------------------------------------------------------------
# ALB 設定（ACM 証明書 ARN は事前発行が必要）
# ---------------------------------------------------------------------------
# 注意: alb_certificate_arn は機密情報のため環境変数から設定
# TF_VAR_alb_certificate_arn 環境変数で設定してください
# alb_certificate_arn = "arn:aws:acm:ap-northeast-1:XXXXXXXXXXXX:certificate/xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"

alb_access_log_bucket = "sakura-city-alb-logs-stg"

# ---------------------------------------------------------------------------
# セキュリティ設定（ステージング: 削除保護最小値）
# ---------------------------------------------------------------------------
kms_deletion_window_in_days = 7
