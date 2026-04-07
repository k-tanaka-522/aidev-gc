# さくら市マイナンバー基盤 - ecs - main.tf
# 作成日: 2026-04-06
# 概要: ECSクラスター、タスク定義（portal/admin/worker）、ECSサービス（Fargate SPOT混在）、
#        ALB（external/internal）、ターゲットグループ、Auto Scaling、ECR Repository

# ---------------------------------------------------------------------------
# Data Sources
# ---------------------------------------------------------------------------
data "aws_region" "current" {}
data "aws_caller_identity" "current" {}

# ---------------------------------------------------------------------------
# ECS Cluster（Container Insights 有効）
# ---------------------------------------------------------------------------
resource "aws_ecs_cluster" "main" {
  name = var.cluster_name

  setting {
    name  = "containerInsights"
    value = "enabled"
  }

  tags = merge(
    var.tags,
    {
      Name = var.cluster_name
    }
  )
}

resource "aws_ecs_cluster_capacity_providers" "main" {
  cluster_name = aws_ecs_cluster.main.name

  capacity_providers = ["FARGATE", "FARGATE_SPOT"]

  default_capacity_provider_strategy {
    base              = 1
    weight            = 1
    capacity_provider = "FARGATE"
  }
}

# ---------------------------------------------------------------------------
# ECR Repositories
# ---------------------------------------------------------------------------
resource "aws_ecr_repository" "main" {
  for_each = toset(var.ecr_repos)

  name                 = "${var.environment}-sakura-${each.key}"
  image_tag_mutability = "IMMUTABLE"

  image_scanning_configuration {
    scan_on_push = true
  }

  encryption_configuration {
    encryption_type = "KMS"
    kms_key         = var.kms_key_arn
  }

  tags = merge(
    var.tags,
    {
      Name = "${var.environment}-sakura-ecr-${each.key}"
    }
  )
}

resource "aws_ecr_lifecycle_policy" "main" {
  for_each   = aws_ecr_repository.main
  repository = each.value.name

  policy = jsonencode({
    rules = [
      {
        rulePriority = 1
        description  = "最新30世代のみ保持"
        selection = {
          tagStatus   = "any"
          countType   = "imageCountMoreThan"
          countNumber = 30
        }
        action = {
          type = "expire"
        }
      }
    ]
  })
}

# ---------------------------------------------------------------------------
# CloudWatch Log Groups（サービス別）
# ---------------------------------------------------------------------------
resource "aws_cloudwatch_log_group" "ecs_service" {
  for_each = var.services

  name              = "/ecs/${var.environment}-sakura/${each.key}"
  retention_in_days = var.log_retention_days

  tags = merge(
    var.tags,
    {
      Name    = "${var.environment}-sakura-logs-ecs-${each.key}"
      Service = each.key
    }
  )
}

# ---------------------------------------------------------------------------
# ECS Task Definitions
# ---------------------------------------------------------------------------
resource "aws_ecs_task_definition" "main" {
  for_each = var.services

  family                   = "${var.environment}-sakura-${each.key}"
  requires_compatibilities = ["FARGATE"]
  network_mode             = "awsvpc"
  cpu                      = each.value.cpu
  memory                   = each.value.memory
  execution_role_arn       = each.value.execution_role_arn
  task_role_arn            = each.value.task_role_arn

  container_definitions = jsonencode([
    {
      name      = each.key
      image     = "${aws_ecr_repository.main[each.key].repository_url}:latest"
      essential = true

      portMappings = [
        {
          containerPort = each.value.container_port
          protocol      = "tcp"
        }
      ]

      environment = [
        {
          name  = "ENVIRONMENT"
          value = var.environment
        }
      ]

      secrets = [
        {
          name      = "DB_PASSWORD"
          valueFrom = "arn:aws:secretsmanager:${data.aws_region.current.name}:${data.aws_caller_identity.current.account_id}:secret:${var.environment}/sakura/${each.key}/db-password"
        }
      ]

      logConfiguration = {
        logDriver = "awslogs"
        options = {
          "awslogs-group"         = aws_cloudwatch_log_group.ecs_service[each.key].name
          "awslogs-region"        = data.aws_region.current.name
          "awslogs-stream-prefix" = each.key
        }
      }

      healthCheck = {
        command     = ["CMD-SHELL", "curl -f http://localhost:${each.value.container_port}/health || exit 1"]
        interval    = 30
        timeout     = 5
        retries     = 3
        startPeriod = 60
      }

      readonlyRootFilesystem = true
      user                   = "1000:1000"
    }
  ])

  tags = merge(
    var.tags,
    {
      Name    = "${var.environment}-sakura-taskdef-${each.key}"
      Service = each.key
    }
  )
}

# ---------------------------------------------------------------------------
# ALB External（インターネット向け: portal サービス用）
# ---------------------------------------------------------------------------
resource "aws_lb" "external" {
  name               = "${var.environment}-sakura-alb-ext"
  internal           = false
  load_balancer_type = "application"
  security_groups    = [var.alb_settings.external_sg_id]
  subnets            = var.alb_settings.public_subnet_ids

  enable_deletion_protection = var.environment == "prod" ? true : false
  drop_invalid_header_fields = true

  access_logs {
    bucket  = var.alb_settings.access_log_bucket
    prefix  = "${var.environment}-sakura-alb-ext"
    enabled = true
  }

  tags = merge(
    var.tags,
    {
      Name = "${var.environment}-sakura-alb-ext"
      Type = "external"
    }
  )
}

resource "aws_lb_listener" "external_https" {
  load_balancer_arn = aws_lb.external.arn
  port              = 443
  protocol          = "HTTPS"
  ssl_policy        = "ELBSecurityPolicy-TLS13-1-2-2021-06"
  certificate_arn   = var.alb_settings.certificate_arn

  default_action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.main["portal"].arn
  }
}

resource "aws_lb_listener" "external_http_redirect" {
  load_balancer_arn = aws_lb.external.arn
  port              = 80
  protocol          = "HTTP"

  default_action {
    type = "redirect"
    redirect {
      port        = "443"
      protocol    = "HTTPS"
      status_code = "HTTP_301"
    }
  }
}

# ---------------------------------------------------------------------------
# ALB Internal（内部向け: admin / worker サービス用）
# ---------------------------------------------------------------------------
resource "aws_lb" "internal" {
  name               = "${var.environment}-sakura-alb-int"
  internal           = true
  load_balancer_type = "application"
  security_groups    = [var.alb_settings.internal_sg_id]
  subnets            = var.alb_settings.app_subnet_ids

  enable_deletion_protection = var.environment == "prod" ? true : false
  drop_invalid_header_fields = true

  access_logs {
    bucket  = var.alb_settings.access_log_bucket
    prefix  = "${var.environment}-sakura-alb-int"
    enabled = true
  }

  tags = merge(
    var.tags,
    {
      Name = "${var.environment}-sakura-alb-int"
      Type = "internal"
    }
  )
}

resource "aws_lb_listener" "internal_https" {
  load_balancer_arn = aws_lb.internal.arn
  port              = 443
  protocol          = "HTTPS"
  ssl_policy        = "ELBSecurityPolicy-TLS13-1-2-2021-06"
  certificate_arn   = var.alb_settings.certificate_arn

  default_action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.main["admin"].arn
  }
}

# ---------------------------------------------------------------------------
# Target Groups（サービス別）
# ---------------------------------------------------------------------------
resource "aws_lb_target_group" "main" {
  for_each = var.services

  name        = "${var.environment}-sakura-tg-${each.key}"
  port        = each.value.container_port
  protocol    = "HTTP"
  vpc_id      = var.vpc_id
  target_type = "ip"

  health_check {
    enabled             = true
    healthy_threshold   = 3
    unhealthy_threshold = 3
    timeout             = 5
    interval            = 30
    path                = each.value.health_check_path
    matcher             = "200-299"
    protocol            = "HTTP"
    port                = "traffic-port"
  }

  deregistration_delay = 30

  tags = merge(
    var.tags,
    {
      Name    = "${var.environment}-sakura-tg-${each.key}"
      Service = each.key
    }
  )

  lifecycle {
    create_before_destroy = true
  }
}

# ALB Listener Rules（パスベースルーティング）
resource "aws_lb_listener_rule" "admin" {
  listener_arn = aws_lb_listener.internal_https.arn
  priority     = 100

  action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.main["admin"].arn
  }

  condition {
    path_pattern {
      values = ["/admin/*"]
    }
  }
}

resource "aws_lb_listener_rule" "worker" {
  listener_arn = aws_lb_listener.internal_https.arn
  priority     = 200

  action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.main["worker"].arn
  }

  condition {
    path_pattern {
      values = ["/worker/*"]
    }
  }
}

# ---------------------------------------------------------------------------
# ECS Services（Fargate SPOT 混在）
# ---------------------------------------------------------------------------
resource "aws_ecs_service" "main" {
  for_each = var.services

  name            = "${var.environment}-sakura-svc-${each.key}"
  cluster         = aws_ecs_cluster.main.id
  task_definition = aws_ecs_task_definition.main[each.key].arn
  desired_count   = each.value.desired_count

  # Fargate SPOT 混在（本番: Fargate 1 + SPOT 1、非本番: SPOT のみ）
  capacity_provider_strategy {
    capacity_provider = "FARGATE"
    base              = var.environment == "prod" ? 1 : 0
    weight            = var.environment == "prod" ? 1 : 0
  }

  capacity_provider_strategy {
    capacity_provider = "FARGATE_SPOT"
    base              = 0
    weight            = var.environment == "prod" ? 1 : 1
  }

  network_configuration {
    subnets          = var.alb_settings.app_subnet_ids
    security_groups  = [each.value.security_group_id]
    assign_public_ip = false
  }

  load_balancer {
    target_group_arn = aws_lb_target_group.main[each.key].arn
    container_name   = each.key
    container_port   = each.value.container_port
  }

  deployment_circuit_breaker {
    enable   = true
    rollback = true
  }

  deployment_controller {
    type = "ECS"
  }

  health_check_grace_period_seconds = 60

  enable_execute_command = var.environment != "prod"

  lifecycle {
    ignore_changes = [desired_count]
  }

  tags = merge(
    var.tags,
    {
      Name    = "${var.environment}-sakura-svc-${each.key}"
      Service = each.key
    }
  )

  depends_on = [
    aws_lb_listener.external_https,
    aws_lb_listener.internal_https,
  ]
}

# ---------------------------------------------------------------------------
# Auto Scaling
# ---------------------------------------------------------------------------
resource "aws_appautoscaling_target" "ecs" {
  for_each = var.services

  max_capacity       = each.value.max_capacity
  min_capacity       = each.value.min_capacity
  resource_id        = "service/${aws_ecs_cluster.main.name}/${aws_ecs_service.main[each.key].name}"
  scalable_dimension = "ecs:service:DesiredCount"
  service_namespace  = "ecs"
}

# CPU ベーススケールアウト
resource "aws_appautoscaling_policy" "ecs_cpu" {
  for_each = var.services

  name               = "${var.environment}-sakura-asg-${each.key}-cpu"
  policy_type        = "TargetTrackingScaling"
  resource_id        = aws_appautoscaling_target.ecs[each.key].resource_id
  scalable_dimension = aws_appautoscaling_target.ecs[each.key].scalable_dimension
  service_namespace  = aws_appautoscaling_target.ecs[each.key].service_namespace

  target_tracking_scaling_policy_configuration {
    predefined_metric_specification {
      predefined_metric_type = "ECSServiceAverageCPUUtilization"
    }
    target_value       = 70.0
    scale_in_cooldown  = 300
    scale_out_cooldown = 60
  }
}

# Memory ベーススケールアウト
resource "aws_appautoscaling_policy" "ecs_memory" {
  for_each = var.services

  name               = "${var.environment}-sakura-asg-${each.key}-memory"
  policy_type        = "TargetTrackingScaling"
  resource_id        = aws_appautoscaling_target.ecs[each.key].resource_id
  scalable_dimension = aws_appautoscaling_target.ecs[each.key].scalable_dimension
  service_namespace  = aws_appautoscaling_target.ecs[each.key].service_namespace

  target_tracking_scaling_policy_configuration {
    predefined_metric_specification {
      predefined_metric_type = "ECSServiceAverageMemoryUtilization"
    }
    target_value       = 75.0
    scale_in_cooldown  = 300
    scale_out_cooldown = 60
  }
}
