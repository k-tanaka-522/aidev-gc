# さくら市マイナンバー基盤 - ecs - outputs.tf
# 作成日: 2026-04-06
# 概要: ECS モジュールの出力値定義

output "cluster_arn" {
  description = "ECS クラスターの ARN"
  value       = aws_ecs_cluster.main.arn
}

output "cluster_name" {
  description = "ECS クラスター名"
  value       = aws_ecs_cluster.main.name
}

output "service_arns" {
  description = "ECS サービスの ARN マップ（キー: サービス名）"
  value       = { for k, v in aws_ecs_service.main : k => v.id }
}

output "service_names" {
  description = "ECS サービス名マップ（キー: サービス名）"
  value       = { for k, v in aws_ecs_service.main : k => v.name }
}

output "task_definition_arns" {
  description = "ECS タスク定義の ARN マップ（キー: サービス名）"
  value       = { for k, v in aws_ecs_task_definition.main : k => v.arn }
}

output "alb_dns_names" {
  description = "ALB の DNS 名マップ（キー: external / internal）"
  value = {
    external = aws_lb.external.dns_name
    internal = aws_lb.internal.dns_name
  }
}

output "alb_arns" {
  description = "ALB の ARN マップ（キー: external / internal）"
  value = {
    external = aws_lb.external.arn
    internal = aws_lb.internal.arn
  }
}

output "alb_zone_ids" {
  description = "ALB の Route53 Zone ID マップ（キー: external / internal）"
  value = {
    external = aws_lb.external.zone_id
    internal = aws_lb.internal.zone_id
  }
}

output "target_group_arns" {
  description = "ターゲットグループの ARN マップ（キー: サービス名）"
  value       = { for k, v in aws_lb_target_group.main : k => v.arn }
}

output "ecr_urls" {
  description = "ECR リポジトリの URL マップ（キー: リポジトリ名）"
  value       = { for k, v in aws_ecr_repository.main : k => v.repository_url }
}

output "ecr_repository_arns" {
  description = "ECR リポジトリの ARN マップ（キー: リポジトリ名）"
  value       = { for k, v in aws_ecr_repository.main : k => v.arn }
}

output "autoscaling_target_resource_ids" {
  description = "Auto Scaling ターゲットのリソース ID マップ（キー: サービス名）"
  value       = { for k, v in aws_appautoscaling_target.ecs : k => v.resource_id }
}
