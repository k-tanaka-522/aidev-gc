# さくら市マイナンバー基盤 - ecs - variables.tf
# 作成日: 2026-04-06
# 概要: ECS モジュールの入力変数定義

variable "cluster_name" {
  description = "ECS クラスター名"
  type        = string
}

variable "environment" {
  description = "環境名（prod / stg / dev）"
  type        = string

  validation {
    condition     = contains(["prod", "stg", "dev"], var.environment)
    error_message = "environment は prod / stg / dev のいずれかを指定してください。"
  }
}

variable "vpc_id" {
  description = "ECS サービスを配置する VPC の ID"
  type        = string
}

variable "services" {
  description = "ECS サービス設定マップ（サービス名 → 設定オブジェクト）"
  type = map(object({
    cpu                 = number
    memory              = number
    container_port      = number
    health_check_path   = string
    desired_count       = number
    min_capacity        = number
    max_capacity        = number
    execution_role_arn  = string
    task_role_arn       = string
    security_group_id   = string
  }))

  validation {
    condition     = length(var.services) > 0
    error_message = "services には1つ以上のサービス定義が必要です。"
  }
}

variable "alb_settings" {
  description = "ALB 関連設定"
  type = object({
    public_subnet_ids  = list(string)
    app_subnet_ids     = list(string)
    external_sg_id     = string
    internal_sg_id     = string
    certificate_arn    = string
    access_log_bucket  = string
  })
}

variable "ecr_repos" {
  description = "作成する ECR リポジトリ名のリスト（例: [\"portal\", \"admin\", \"worker\"]）"
  type        = list(string)

  validation {
    condition     = length(var.ecr_repos) > 0
    error_message = "ecr_repos には1つ以上のリポジトリ名を指定してください。"
  }
}

variable "kms_key_arn" {
  description = "ECR リポジトリの暗号化に使用する KMS キー ARN"
  type        = string
}

variable "log_retention_days" {
  description = "CloudWatch Logs の保持日数"
  type        = number
  default     = 365

  validation {
    condition     = contains([1, 3, 5, 7, 14, 30, 60, 90, 120, 150, 180, 365, 400, 545, 731, 1827, 3653], var.log_retention_days)
    error_message = "log_retention_days には CloudWatch Logs がサポートする保持日数を指定してください。"
  }
}

variable "tags" {
  description = "全リソースに付与する共通タグ"
  type        = map(string)
  default     = {}
}
