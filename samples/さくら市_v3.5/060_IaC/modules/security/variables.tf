# さくら市マイナンバー基盤 - security - variables.tf
# 作成日: 2026-04-06
# 概要: セキュリティモジュールの入力変数定義

variable "environment" {
  description = "環境名（prod / stg / dev）"
  type        = string

  validation {
    condition     = contains(["prod", "stg", "dev"], var.environment)
    error_message = "environment は prod / stg / dev のいずれかを指定してください。"
  }
}

variable "vpc_id" {
  description = "セキュリティグループを作成する VPC の ID"
  type        = string
}

variable "vpc_cidr" {
  description = "VPC の CIDR ブロック（ALB Internal の Ingress ルールに使用）"
  type        = string

  validation {
    condition     = can(cidrhost(var.vpc_cidr, 0))
    error_message = "vpc_cidr には有効な CIDR ブロックを指定してください。"
  }
}

variable "kms_settings" {
  description = "KMS キーの設定オブジェクト"
  type = object({
    deletion_window_in_days = number
    enable_key_rotation     = bool
  })
  default = {
    deletion_window_in_days = 30
    enable_key_rotation     = true
  }

  validation {
    condition     = var.kms_settings.deletion_window_in_days >= 7 && var.kms_settings.deletion_window_in_days <= 30
    error_message = "deletion_window_in_days は 7〜30 の範囲で指定してください。"
  }
}

variable "ecs_service_names" {
  description = "ECS タスクロールを作成するサービス名の set（例: {\"portal\", \"admin\", \"worker\"}）"
  type        = set(string)
  default     = ["portal", "admin", "worker"]

  validation {
    condition     = length(var.ecs_service_names) > 0
    error_message = "ecs_service_names には1つ以上のサービス名を指定してください。"
  }
}

variable "tags" {
  description = "全リソースに付与する共通タグ"
  type        = map(string)
  default     = {}
}
