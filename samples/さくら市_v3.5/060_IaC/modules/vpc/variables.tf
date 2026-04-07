# さくら市マイナンバー基盤 - vpc - variables.tf
# 作成日: 2026-04-06
# 概要: VPC モジュールの入力変数定義

variable "vpc_cidr" {
  description = "VPC CIDR ブロック（例: 10.1.0.0/16）"
  type        = string

  validation {
    condition     = can(cidrhost(var.vpc_cidr, 0))
    error_message = "vpc_cidr には有効な CIDR ブロックを指定してください。"
  }
}

variable "az_list" {
  description = "使用するアベイラビリティゾーンのリスト（例: [\"ap-northeast-1a\", \"ap-northeast-1c\"]）"
  type        = list(string)

  validation {
    condition     = length(var.az_list) >= 2
    error_message = "az_list には最低2つのアベイラビリティゾーンを指定してください。"
  }
}

variable "subnet_cidrs" {
  description = "各サブネット層の CIDR ブロックリスト（az_list と同数が必要）"
  type = object({
    public = list(string)
    app    = list(string)
    db     = list(string)
    mgmt   = list(string)
  })

  validation {
    condition     = length(var.subnet_cidrs.public) > 0
    error_message = "subnet_cidrs.public には1つ以上の CIDR を指定してください。"
  }

  validation {
    condition     = length(var.subnet_cidrs.app) > 0
    error_message = "subnet_cidrs.app には1つ以上の CIDR を指定してください。"
  }

  validation {
    condition     = length(var.subnet_cidrs.db) > 0
    error_message = "subnet_cidrs.db には1つ以上の CIDR を指定してください。"
  }

  validation {
    condition     = length(var.subnet_cidrs.mgmt) > 0
    error_message = "subnet_cidrs.mgmt には1つ以上の CIDR を指定してください。"
  }
}

variable "environment" {
  description = "環境名（prod / stg / dev）"
  type        = string

  validation {
    condition     = contains(["prod", "stg", "dev"], var.environment)
    error_message = "environment は prod / stg / dev のいずれかを指定してください。"
  }
}

variable "flow_logs_retention_days" {
  description = "VPC Flow Logs の CloudWatch Logs 保持日数"
  type        = number
  default     = 365

  validation {
    condition     = contains([1, 3, 5, 7, 14, 30, 60, 90, 120, 150, 180, 365, 400, 545, 731, 1827, 3653], var.flow_logs_retention_days)
    error_message = "flow_logs_retention_days には CloudWatch Logs がサポートする保持日数を指定してください。"
  }
}

variable "tags" {
  description = "全リソースに付与する共通タグ（object 型）"
  type        = map(string)
  default     = {}
}
