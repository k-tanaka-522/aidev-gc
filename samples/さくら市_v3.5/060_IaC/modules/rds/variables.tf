# さくら市マイナンバー基盤 - rds - variables.tf
# 作成日: 2026-04-06
# 概要: RDS/ElastiCache モジュールの入力変数定義

variable "environment" {
  description = "環境名（prod / stg / dev）"
  type        = string

  validation {
    condition     = contains(["prod", "stg", "dev"], var.environment)
    error_message = "environment は prod / stg / dev のいずれかを指定してください。"
  }
}

variable "db_subnet_ids" {
  description = "RDS および ElastiCache を配置するサブネット ID のリスト"
  type        = list(string)

  validation {
    condition     = length(var.db_subnet_ids) >= 2
    error_message = "db_subnet_ids には Multi-AZ のため最低2つのサブネット ID が必要です。"
  }
}

variable "rds_security_group_id" {
  description = "RDS インスタンスに適用するセキュリティグループ ID"
  type        = string
}

variable "redis_security_group_id" {
  description = "ElastiCache に適用するセキュリティグループ ID"
  type        = string
}

variable "db_instance_class" {
  description = "RDS インスタンスクラス（例: db.r6g.large）"
  type        = string
  default     = "db.r6g.large"
}

variable "db_name" {
  description = "作成するデータベース名"
  type        = string
  default     = "sakura_mynumber"
}

variable "db_username" {
  description = "RDS マスターユーザー名（パスワードは Secrets Manager で自動管理）"
  type        = string
  default     = "sakura_admin"

  validation {
    condition     = can(regex("^[a-zA-Z][a-zA-Z0-9_]{2,63}$", var.db_username))
    error_message = "db_username は英字始まり、英数字とアンダースコアのみ使用可能（3〜64文字）。"
  }
}

variable "multi_az" {
  description = "RDS Multi-AZ を有効にするか（本番: true 推奨）"
  type        = bool
  default     = true
}

variable "primary_az" {
  description = "Multi-AZ 無効時のプライマリ AZ 指定（例: ap-northeast-1a）"
  type        = string
  default     = "ap-northeast-1a"
}

variable "allocated_storage" {
  description = "RDS 初期ストレージ容量（GB）"
  type        = number
  default     = 100

  validation {
    condition     = var.allocated_storage >= 20
    error_message = "allocated_storage は最低 20 GB 以上が必要です。"
  }
}

variable "max_allocated_storage" {
  description = "RDS Auto Scaling 上限ストレージ容量（GB）"
  type        = number
  default     = 500

  validation {
    condition     = var.max_allocated_storage >= var.allocated_storage
    error_message = "max_allocated_storage は allocated_storage 以上の値を指定してください。"
  }
}

variable "backup_retention" {
  description = "RDS 自動バックアップ保持期間（日数）"
  type        = number
  default     = 7

  validation {
    condition     = var.backup_retention >= 0 && var.backup_retention <= 35
    error_message = "backup_retention は 0〜35 の範囲で指定してください。"
  }
}

variable "kms_key_id" {
  description = "RDS および ElastiCache のストレージ暗号化に使用する KMS キー ID または ARN"
  type        = string
}

variable "redis_node_type" {
  description = "ElastiCache Redis ノードタイプ（例: cache.r6g.large）"
  type        = string
  default     = "cache.r6g.large"
}

variable "redis_num_cache_clusters" {
  description = "ElastiCache レプリケーショングループのノード数（プライマリ + レプリカ）"
  type        = number
  default     = 2

  validation {
    condition     = var.redis_num_cache_clusters >= 1 && var.redis_num_cache_clusters <= 6
    error_message = "redis_num_cache_clusters は 1〜6 の範囲で指定してください。"
  }
}

variable "redis_snapshot_retention" {
  description = "ElastiCache Redis スナップショット保持日数"
  type        = number
  default     = 5

  validation {
    condition     = var.redis_snapshot_retention >= 0 && var.redis_snapshot_retention <= 35
    error_message = "redis_snapshot_retention は 0〜35 の範囲で指定してください。"
  }
}

variable "tags" {
  description = "全リソースに付与する共通タグ"
  type        = map(string)
  default     = {}
}
