# さくら市マイナンバー基盤 - sakura-city stack - locals.tf
# 作成日: 2026-04-06
# 概要: スタック共通のローカル変数（タグ、計算値）

locals {
  # ---------------------------------------------------------------------------
  # 共通タグ（全リソースに付与）
  # ---------------------------------------------------------------------------
  common_tags = {
    Environment = var.environment
    Owner       = "sakura-city-dx"
    CostCenter  = "GC-SAKURA-001"
    Project     = "sakura-city-mynumber"
    ManagedBy   = "terraform"
  }

  # ---------------------------------------------------------------------------
  # ECS サービス定義（security/ecs モジュールで参照）
  # ---------------------------------------------------------------------------
  ecs_service_names = toset(["portal", "admin", "worker"])

  # ---------------------------------------------------------------------------
  # ECS サービス設定（環境別スペック）
  # ---------------------------------------------------------------------------
  ecs_services = {
    portal = {
      cpu               = var.environment == "prod" ? 1024 : 512
      memory            = var.environment == "prod" ? 2048 : 1024
      container_port    = 8080
      health_check_path = "/health"
      desired_count     = var.environment == "prod" ? 2 : 1
      min_capacity      = var.environment == "prod" ? 2 : 1
      max_capacity      = var.environment == "prod" ? 10 : 3
      execution_role_arn = module.security.ecs_execution_role_arn
      task_role_arn      = module.security.ecs_task_role_arns["portal"]
      security_group_id  = module.security.sg_ids["ecs_portal"]
    }
    admin = {
      cpu               = var.environment == "prod" ? 512 : 256
      memory            = var.environment == "prod" ? 1024 : 512
      container_port    = 8081
      health_check_path = "/admin/health"
      desired_count     = var.environment == "prod" ? 2 : 1
      min_capacity      = var.environment == "prod" ? 2 : 1
      max_capacity      = var.environment == "prod" ? 5 : 2
      execution_role_arn = module.security.ecs_execution_role_arn
      task_role_arn      = module.security.ecs_task_role_arns["admin"]
      security_group_id  = module.security.sg_ids["ecs_admin"]
    }
    worker = {
      cpu               = var.environment == "prod" ? 512 : 256
      memory            = var.environment == "prod" ? 1024 : 512
      container_port    = 8082
      health_check_path = "/worker/health"
      desired_count     = var.environment == "prod" ? 2 : 1
      min_capacity      = var.environment == "prod" ? 2 : 1
      max_capacity      = var.environment == "prod" ? 8 : 2
      execution_role_arn = module.security.ecs_execution_role_arn
      task_role_arn      = module.security.ecs_task_role_arns["worker"]
      security_group_id  = module.security.sg_ids["ecs_worker"]
    }
  }

  # ---------------------------------------------------------------------------
  # サブネット CIDR 計算（VPC 10.1.0.0/16 を前提）
  # ---------------------------------------------------------------------------
  subnet_cidrs = {
    public = [
      cidrsubnet(var.vpc_cidr, 8, 1),  # 10.1.1.0/24（ap-northeast-1a）
      cidrsubnet(var.vpc_cidr, 8, 2),  # 10.1.2.0/24（ap-northeast-1c）
    ]
    app = [
      cidrsubnet(var.vpc_cidr, 8, 11), # 10.1.11.0/24（ap-northeast-1a）
      cidrsubnet(var.vpc_cidr, 8, 12), # 10.1.12.0/24（ap-northeast-1c）
    ]
    db = [
      cidrsubnet(var.vpc_cidr, 8, 21), # 10.1.21.0/24（ap-northeast-1a）
      cidrsubnet(var.vpc_cidr, 8, 22), # 10.1.22.0/24（ap-northeast-1c）
    ]
    mgmt = [
      cidrsubnet(var.vpc_cidr, 8, 31), # 10.1.31.0/24（ap-northeast-1a）
      cidrsubnet(var.vpc_cidr, 8, 32), # 10.1.32.0/24（ap-northeast-1c）
    ]
  }
}
