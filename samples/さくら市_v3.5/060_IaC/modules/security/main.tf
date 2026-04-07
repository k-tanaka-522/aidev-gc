# さくら市マイナンバー基盤 - security - main.tf
# 作成日: 2026-04-06
# 概要: セキュリティグループ（ALB/ECS/RDS/Redis/管理）、KMS CMK（RDS/S3/EBS）、
#        IAM ロール（ECS タスク実行・タスクロール）、最小権限ポリシー

# ---------------------------------------------------------------------------
# Data Sources
# ---------------------------------------------------------------------------
data "aws_region" "current" {}
data "aws_caller_identity" "current" {}

# ---------------------------------------------------------------------------
# Security Groups
# ---------------------------------------------------------------------------

# ALB External（インターネット向け）
resource "aws_security_group" "alb_ext" {
  name        = "${var.environment}-sakura-sg-alb-ext"
  description = "ALB External - インターネットからの HTTP/HTTPS を許可"
  vpc_id      = var.vpc_id

  ingress {
    description = "HTTP from Internet"
    from_port   = 80
    to_port     = 80
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  ingress {
    description = "HTTPS from Internet"
    from_port   = 443
    to_port     = 443
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  egress {
    description = "Allow all outbound"
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = merge(
    var.tags,
    {
      Name = "${var.environment}-sakura-sg-alb-ext"
    }
  )
}

# ALB Internal（内部向け）
resource "aws_security_group" "alb_int" {
  name        = "${var.environment}-sakura-sg-alb-int"
  description = "ALB Internal - VPC 内からの HTTPS を許可"
  vpc_id      = var.vpc_id

  ingress {
    description = "HTTPS from VPC"
    from_port   = 443
    to_port     = 443
    protocol    = "tcp"
    cidr_blocks = [var.vpc_cidr]
  }

  egress {
    description = "Allow all outbound"
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = merge(
    var.tags,
    {
      Name = "${var.environment}-sakura-sg-alb-int"
    }
  )
}

# ECS Portal（住民向けポータル）
resource "aws_security_group" "ecs_portal" {
  name        = "${var.environment}-sakura-sg-ecs-portal"
  description = "ECS Portal - ALB External からのトラフィックを許可"
  vpc_id      = var.vpc_id

  ingress {
    description     = "HTTP from ALB External"
    from_port       = 8080
    to_port         = 8080
    protocol        = "tcp"
    security_groups = [aws_security_group.alb_ext.id]
  }

  egress {
    description = "Allow all outbound"
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = merge(
    var.tags,
    {
      Name    = "${var.environment}-sakura-sg-ecs-portal"
      Service = "portal"
    }
  )
}

# ECS Admin（管理画面）
resource "aws_security_group" "ecs_admin" {
  name        = "${var.environment}-sakura-sg-ecs-admin"
  description = "ECS Admin - ALB Internal からのトラフィックを許可"
  vpc_id      = var.vpc_id

  ingress {
    description     = "HTTP from ALB Internal"
    from_port       = 8081
    to_port         = 8081
    protocol        = "tcp"
    security_groups = [aws_security_group.alb_int.id]
  }

  egress {
    description = "Allow all outbound"
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = merge(
    var.tags,
    {
      Name    = "${var.environment}-sakura-sg-ecs-admin"
      Service = "admin"
    }
  )
}

# ECS Worker（バックグラウンドワーカー）
resource "aws_security_group" "ecs_worker" {
  name        = "${var.environment}-sakura-sg-ecs-worker"
  description = "ECS Worker - ALB Internal からのトラフィックを許可"
  vpc_id      = var.vpc_id

  ingress {
    description     = "HTTP from ALB Internal"
    from_port       = 8082
    to_port         = 8082
    protocol        = "tcp"
    security_groups = [aws_security_group.alb_int.id]
  }

  egress {
    description = "Allow all outbound"
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = merge(
    var.tags,
    {
      Name    = "${var.environment}-sakura-sg-ecs-worker"
      Service = "worker"
    }
  )
}

# RDS
resource "aws_security_group" "rds" {
  name        = "${var.environment}-sakura-sg-rds"
  description = "RDS PostgreSQL - ECS サービスからのアクセスを許可"
  vpc_id      = var.vpc_id

  ingress {
    description     = "PostgreSQL from ECS Portal"
    from_port       = 5432
    to_port         = 5432
    protocol        = "tcp"
    security_groups = [aws_security_group.ecs_portal.id]
  }

  ingress {
    description     = "PostgreSQL from ECS Admin"
    from_port       = 5432
    to_port         = 5432
    protocol        = "tcp"
    security_groups = [aws_security_group.ecs_admin.id]
  }

  ingress {
    description     = "PostgreSQL from ECS Worker"
    from_port       = 5432
    to_port         = 5432
    protocol        = "tcp"
    security_groups = [aws_security_group.ecs_worker.id]
  }

  ingress {
    description     = "PostgreSQL from Mgmt"
    from_port       = 5432
    to_port         = 5432
    protocol        = "tcp"
    security_groups = [aws_security_group.mgmt.id]
  }

  egress {
    description = "Allow all outbound"
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = merge(
    var.tags,
    {
      Name = "${var.environment}-sakura-sg-rds"
    }
  )
}

# Redis（ElastiCache）
resource "aws_security_group" "redis" {
  name        = "${var.environment}-sakura-sg-redis"
  description = "ElastiCache Redis - ECS サービスからのアクセスを許可"
  vpc_id      = var.vpc_id

  ingress {
    description     = "Redis from ECS Portal"
    from_port       = 6379
    to_port         = 6379
    protocol        = "tcp"
    security_groups = [aws_security_group.ecs_portal.id]
  }

  ingress {
    description     = "Redis from ECS Admin"
    from_port       = 6379
    to_port         = 6379
    protocol        = "tcp"
    security_groups = [aws_security_group.ecs_admin.id]
  }

  ingress {
    description     = "Redis from ECS Worker"
    from_port       = 6379
    to_port         = 6379
    protocol        = "tcp"
    security_groups = [aws_security_group.ecs_worker.id]
  }

  egress {
    description = "Allow all outbound"
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = merge(
    var.tags,
    {
      Name = "${var.environment}-sakura-sg-redis"
    }
  )
}

# 管理（踏み台/SSM 経由のオペレーション用）
resource "aws_security_group" "mgmt" {
  name        = "${var.environment}-sakura-sg-mgmt"
  description = "管理用 - SSM Session Manager 経由のアクセス"
  vpc_id      = var.vpc_id

  egress {
    description = "Allow all outbound（SSM Endpoint 通信含む）"
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = merge(
    var.tags,
    {
      Name = "${var.environment}-sakura-sg-mgmt"
    }
  )
}

# ---------------------------------------------------------------------------
# KMS CMK（RDS / S3 / EBS 用、キーローテーション有効）
# ---------------------------------------------------------------------------
locals {
  kms_keys = {
    rds = {
      description = "さくら市マイナンバー基盤 RDS 暗号化キー（${var.environment}）"
      alias       = "alias/${var.environment}-sakura-rds"
    }
    s3 = {
      description = "さくら市マイナンバー基盤 S3 暗号化キー（${var.environment}）"
      alias       = "alias/${var.environment}-sakura-s3"
    }
    ebs = {
      description = "さくら市マイナンバー基盤 EBS 暗号化キー（${var.environment}）"
      alias       = "alias/${var.environment}-sakura-ebs"
    }
  }
}

resource "aws_kms_key" "main" {
  for_each = local.kms_keys

  description             = each.value.description
  deletion_window_in_days = var.environment == "prod" ? 30 : 7
  enable_key_rotation     = true
  multi_region            = false

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid    = "Enable IAM User Permissions"
        Effect = "Allow"
        Principal = {
          AWS = "arn:aws:iam::${data.aws_caller_identity.current.account_id}:root"
        }
        Action   = "kms:*"
        Resource = "*"
      },
      {
        Sid    = "Allow ECS Task Execution Role to use CMK"
        Effect = "Allow"
        Principal = {
          AWS = aws_iam_role.ecs_execution.arn
        }
        Action = [
          "kms:Decrypt",
          "kms:GenerateDataKey"
        ]
        Resource = "*"
      }
    ]
  })

  tags = merge(
    var.tags,
    {
      Name    = "${var.environment}-sakura-kms-${each.key}"
      KeyType = each.key
    }
  )
}

resource "aws_kms_alias" "main" {
  for_each = local.kms_keys

  name          = each.value.alias
  target_key_id = aws_kms_key.main[each.key].key_id
}

# ---------------------------------------------------------------------------
# IAM Role: ECS Task Execution Role（共通）
# ---------------------------------------------------------------------------
resource "aws_iam_role" "ecs_execution" {
  name = "${var.environment}-sakura-role-ecs-execution"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "ecs-tasks.amazonaws.com"
        }
      }
    ]
  })

  tags = merge(
    var.tags,
    {
      Name = "${var.environment}-sakura-role-ecs-execution"
    }
  )
}

resource "aws_iam_role_policy_attachment" "ecs_execution_managed" {
  role       = aws_iam_role.ecs_execution.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy"
}

resource "aws_iam_role_policy" "ecs_execution_secrets" {
  name = "${var.environment}-sakura-policy-ecs-execution-secrets"
  role = aws_iam_role.ecs_execution.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid    = "AllowSecretsManagerRead"
        Effect = "Allow"
        Action = [
          "secretsmanager:GetSecretValue",
          "secretsmanager:DescribeSecret"
        ]
        Resource = [
          "arn:aws:secretsmanager:${data.aws_region.current.name}:${data.aws_caller_identity.current.account_id}:secret:${var.environment}/sakura/*"
        ]
      },
      {
        Sid    = "AllowKMSDecrypt"
        Effect = "Allow"
        Action = [
          "kms:Decrypt",
          "kms:GenerateDataKey"
        ]
        Resource = [for k in aws_kms_key.main : k.arn]
      },
      {
        Sid    = "AllowECRPull"
        Effect = "Allow"
        Action = [
          "ecr:GetAuthorizationToken",
          "ecr:BatchCheckLayerAvailability",
          "ecr:GetDownloadUrlForLayer",
          "ecr:BatchGetImage"
        ]
        Resource = "*"
      }
    ]
  })
}

# ---------------------------------------------------------------------------
# IAM Roles: ECS Task Role（サービス別、最小権限）
# ---------------------------------------------------------------------------
resource "aws_iam_role" "ecs_task" {
  for_each = var.ecs_service_names

  name = "${var.environment}-sakura-role-ecs-task-${each.key}"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "ecs-tasks.amazonaws.com"
        }
        Condition = {
          StringEquals = {
            "aws:SourceAccount" = data.aws_caller_identity.current.account_id
          }
        }
      }
    ]
  })

  tags = merge(
    var.tags,
    {
      Name    = "${var.environment}-sakura-role-ecs-task-${each.key}"
      Service = each.key
    }
  )
}

# Portal タスクロール ポリシー（読み取り中心）
resource "aws_iam_role_policy" "ecs_task_portal" {
  name = "${var.environment}-sakura-policy-ecs-task-portal"
  role = aws_iam_role.ecs_task["portal"].id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid    = "AllowSSMParameterRead"
        Effect = "Allow"
        Action = [
          "ssm:GetParameter",
          "ssm:GetParameters",
          "ssm:GetParametersByPath"
        ]
        Resource = [
          "arn:aws:ssm:${data.aws_region.current.name}:${data.aws_caller_identity.current.account_id}:parameter/${var.environment}/sakura/portal/*"
        ]
      },
      {
        Sid    = "AllowSecretsRead"
        Effect = "Allow"
        Action = [
          "secretsmanager:GetSecretValue"
        ]
        Resource = [
          "arn:aws:secretsmanager:${data.aws_region.current.name}:${data.aws_caller_identity.current.account_id}:secret:${var.environment}/sakura/portal/*"
        ]
      },
      {
        Sid    = "AllowS3ReadWrite"
        Effect = "Allow"
        Action = [
          "s3:GetObject",
          "s3:PutObject",
          "s3:DeleteObject",
          "s3:ListBucket"
        ]
        Resource = [
          "arn:aws:s3:::${var.environment}-sakura-portal-*",
          "arn:aws:s3:::${var.environment}-sakura-portal-*/*"
        ]
      },
      {
        Sid    = "AllowXRayWrite"
        Effect = "Allow"
        Action = [
          "xray:PutTraceSegments",
          "xray:PutTelemetryRecords"
        ]
        Resource = "*"
      }
    ]
  })
}

# Admin タスクロール ポリシー
resource "aws_iam_role_policy" "ecs_task_admin" {
  name = "${var.environment}-sakura-policy-ecs-task-admin"
  role = aws_iam_role.ecs_task["admin"].id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid    = "AllowSSMParameterReadWrite"
        Effect = "Allow"
        Action = [
          "ssm:GetParameter",
          "ssm:GetParameters",
          "ssm:GetParametersByPath",
          "ssm:PutParameter"
        ]
        Resource = [
          "arn:aws:ssm:${data.aws_region.current.name}:${data.aws_caller_identity.current.account_id}:parameter/${var.environment}/sakura/*"
        ]
      },
      {
        Sid    = "AllowSecretsRead"
        Effect = "Allow"
        Action = [
          "secretsmanager:GetSecretValue"
        ]
        Resource = [
          "arn:aws:secretsmanager:${data.aws_region.current.name}:${data.aws_caller_identity.current.account_id}:secret:${var.environment}/sakura/admin/*"
        ]
      },
      {
        Sid    = "AllowS3FullAccess"
        Effect = "Allow"
        Action = [
          "s3:GetObject",
          "s3:PutObject",
          "s3:DeleteObject",
          "s3:ListBucket",
          "s3:GetBucketLocation"
        ]
        Resource = [
          "arn:aws:s3:::${var.environment}-sakura-*",
          "arn:aws:s3:::${var.environment}-sakura-*/*"
        ]
      },
      {
        Sid    = "AllowXRayWrite"
        Effect = "Allow"
        Action = [
          "xray:PutTraceSegments",
          "xray:PutTelemetryRecords"
        ]
        Resource = "*"
      }
    ]
  })
}

# Worker タスクロール ポリシー
resource "aws_iam_role_policy" "ecs_task_worker" {
  name = "${var.environment}-sakura-policy-ecs-task-worker"
  role = aws_iam_role.ecs_task["worker"].id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid    = "AllowSQSReadWrite"
        Effect = "Allow"
        Action = [
          "sqs:ReceiveMessage",
          "sqs:DeleteMessage",
          "sqs:GetQueueAttributes",
          "sqs:SendMessage",
          "sqs:ChangeMessageVisibility"
        ]
        Resource = [
          "arn:aws:sqs:${data.aws_region.current.name}:${data.aws_caller_identity.current.account_id}:${var.environment}-sakura-*"
        ]
      },
      {
        Sid    = "AllowSecretsRead"
        Effect = "Allow"
        Action = [
          "secretsmanager:GetSecretValue"
        ]
        Resource = [
          "arn:aws:secretsmanager:${data.aws_region.current.name}:${data.aws_caller_identity.current.account_id}:secret:${var.environment}/sakura/worker/*"
        ]
      },
      {
        Sid    = "AllowS3ReadWrite"
        Effect = "Allow"
        Action = [
          "s3:GetObject",
          "s3:PutObject",
          "s3:DeleteObject",
          "s3:ListBucket"
        ]
        Resource = [
          "arn:aws:s3:::${var.environment}-sakura-worker-*",
          "arn:aws:s3:::${var.environment}-sakura-worker-*/*"
        ]
      },
      {
        Sid    = "AllowXRayWrite"
        Effect = "Allow"
        Action = [
          "xray:PutTraceSegments",
          "xray:PutTelemetryRecords"
        ]
        Resource = "*"
      }
    ]
  })
}
