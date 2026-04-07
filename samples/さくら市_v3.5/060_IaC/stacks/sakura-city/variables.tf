# さくら市マイナンバー基盤 - sakura-city stack - variables.tf
# 作成日: 2026-04-06
# 概要: スタック全体の入力変数定義

# ---------------------------------------------------------------------------
# 基本設定
# ---------------------------------------------------------------------------
variable "environment" {
  description = "環境名（prod / stg / dev）"
  type        = string

  validation {
    condition     = contains(["prod", "stg", "dev"], var.environment)
    error_message = "environment は prod / stg / dev のいずれかを指定してください。"
  }
}

variable "aws_region" {
  description = "デプロイ先 AWS リージョン"
  type        = string
  default     = "ap-northeast-1"
}

# ---------------------------------------------------------------------------
# VPC 設定
# ---------------------------------------------------------------------------
variable "vpc_cidr" {
  description = "VPC CIDR ブロック（例: 10.1.0.0/16）"
  type        = string
  default     = "10.1.0.0/16"

  validation {
    condition     = can(cidrhost(var.vpc_cidr, 0))
    error_message = "vpc_cidr には有効な CIDR ブロックを指定してください。"
  }
}

variable "az_list" {
  description = "使用するアベイラビリティゾーンのリスト"
  type        = list(string)
  default     = ["ap-northeast-1a", "ap-northeast-1c"]

  validation {
    condition     = length(var.az_list) >= 2
    error_message = "az_list には最低2つの AZ を指定してください。"
  }
}

variable "flow_logs_retention_days" {
  description = "VPC Flow Logs の保持日数"
  type        = number
  default     = 365
}

# ---------------------------------------------------------------------------
# RDS 設定
# ---------------------------------------------------------------------------
variable "db_instance_class" {
  description = "RDS インスタンスクラス"
  type        = string
  default     = "db.r6g.large"
}

variable "db_name" {
  description = "RDS データベース名"
  type        = string
  default     = "sakura_mynumber"
}

variable "db_username" {
  description = "RDS マスターユーザー名"
  type        = string
  default     = "sakura_admin"
}

variable "db_multi_az" {
  description = "RDS Multi-AZ 有効フラグ"
  type        = bool
  default     = true
}

variable "db_allocated_storage" {
  description = "RDS 初期ストレージ容量（GB）"
  type        = number
  default     = 100
}

variable "db_max_allocated_storage" {
  description = "RDS Auto Scaling 上限ストレージ容量（GB）"
  type        = number
  default     = 500
}

variable "db_backup_retention" {
  description = "RDS バックアップ保持日数"
  type        = number
  default     = 7
}

# ---------------------------------------------------------------------------
# ElastiCache 設定
# ---------------------------------------------------------------------------
variable "redis_node_type" {
  description = "ElastiCache Redis ノードタイプ"
  type        = string
  default     = "cache.r6g.large"
}

variable "redis_num_cache_clusters" {
  description = "Redis ノード数（プライマリ + レプリカ）"
  type        = number
  default     = 2
}

variable "redis_snapshot_retention" {
  description = "Redis スナップショット保持日数"
  type        = number
  default     = 5
}

# ---------------------------------------------------------------------------
# ECS 設定
# ---------------------------------------------------------------------------
variable "ecs_cluster_name" {
  description = "ECS クラスター名"
  type        = string
  default     = "sakura-city-mynumber"
}

variable "ecr_repos" {
  description = "作成する ECR リポジトリ名のリスト"
  type        = list(string)
  default     = ["portal", "admin", "worker"]
}

variable "log_retention_days" {
  description = "ECS サービスの CloudWatch Logs 保持日数"
  type        = number
  default     = 365
}

# ---------------------------------------------------------------------------
# ALB 設定
# ---------------------------------------------------------------------------
variable "alb_certificate_arn" {
  description = "ALB に設定する ACM 証明書の ARN"
  type        = string
  sensitive   = true
}

variable "alb_access_log_bucket" {
  description = "ALB アクセスログを保存する S3 バケット名"
  type        = string
}

# ---------------------------------------------------------------------------
# セキュリティ設定
# ---------------------------------------------------------------------------
variable "kms_deletion_window_in_days" {
  description = "KMS キー削除待機日数"
  type        = number
  default     = 30

  validation {
    condition     = var.kms_deletion_window_in_days >= 7 && var.kms_deletion_window_in_days <= 30
    error_message = "kms_deletion_window_in_days は 7〜30 の範囲で指定してください。"
  }
}
