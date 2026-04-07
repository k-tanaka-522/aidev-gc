# さくら市マイナンバー基盤 - prod environment - terraform.tfvars
# 作成日: 2026-04-06
# 概要: 本番環境の全変数値（高可用性・高スペック構成）

# ---------------------------------------------------------------------------
# 基本設定
# ---------------------------------------------------------------------------
environment = "prod"
aws_region  = "ap-northeast-1"

# ---------------------------------------------------------------------------
# VPC 設定
# ---------------------------------------------------------------------------
vpc_cidr = "10.1.0.0/16"

az_list = [
  "ap-northeast-1a",
  "ap-northeast-1c"
]

flow_logs_retention_days = 365

# ---------------------------------------------------------------------------
# RDS 設定（本番: db.r6g.large、Multi-AZ 有効、30日バックアップ）
# ---------------------------------------------------------------------------
db_instance_class        = "db.r6g.large"
db_name                  = "sakura_mynumber"
db_username              = "sakura_admin"
db_multi_az              = true
db_allocated_storage     = 200
db_max_allocated_storage = 1000
db_backup_retention      = 30

# ---------------------------------------------------------------------------
# ElastiCache 設定（本番: cache.r6g.large、Multi-AZ 有効、2ノード）
# ---------------------------------------------------------------------------
redis_node_type          = "cache.r6g.large"
redis_num_cache_clusters = 2
redis_snapshot_retention = 7

# ---------------------------------------------------------------------------
# ECS 設定（本番: 高スペック、Fargate SPOT 混在）
# ---------------------------------------------------------------------------
ecs_cluster_name   = "sakura-city-mynumber"
ecr_repos          = ["portal", "admin", "worker"]
log_retention_days = 365

# ---------------------------------------------------------------------------
# ALB 設定（ACM 証明書 ARN は事前発行が必要）
# ---------------------------------------------------------------------------
# 注意: alb_certificate_arn は機密情報のため環境変数または Secrets Manager から取得
# TF_VAR_alb_certificate_arn 環境変数で設定してください
# alb_certificate_arn = "arn:aws:acm:ap-northeast-1:XXXXXXXXXXXX:certificate/xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"

alb_access_log_bucket = "sakura-city-alb-logs-prod"

# ---------------------------------------------------------------------------
# セキュリティ設定（本番: 削除保護最大値）
# ---------------------------------------------------------------------------
kms_deletion_window_in_days = 30
