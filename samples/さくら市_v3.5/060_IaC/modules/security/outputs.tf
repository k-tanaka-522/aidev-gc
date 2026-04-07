# さくら市マイナンバー基盤 - security - outputs.tf
# 作成日: 2026-04-06
# 概要: セキュリティモジュールの出力値定義

output "sg_ids" {
  description = "作成したセキュリティグループの ID マップ（キー: sg 識別名）"
  value = {
    alb_ext    = aws_security_group.alb_ext.id
    alb_int    = aws_security_group.alb_int.id
    ecs_portal = aws_security_group.ecs_portal.id
    ecs_admin  = aws_security_group.ecs_admin.id
    ecs_worker = aws_security_group.ecs_worker.id
    rds        = aws_security_group.rds.id
    redis      = aws_security_group.redis.id
    mgmt       = aws_security_group.mgmt.id
  }
}

output "kms_key_ids" {
  description = "KMS CMK の ID マップ（キー: rds / s3 / ebs）"
  value       = { for k, v in aws_kms_key.main : k => v.key_id }
}

output "kms_key_arns" {
  description = "KMS CMK の ARN マップ（キー: rds / s3 / ebs）"
  value       = { for k, v in aws_kms_key.main : k => v.arn }
}

output "kms_alias_names" {
  description = "KMS エイリアス名マップ（キー: rds / s3 / ebs）"
  value       = { for k, v in aws_kms_alias.main : k => v.name }
}

output "ecs_task_role_arns" {
  description = "ECS タスクロールの ARN マップ（キー: サービス名）"
  value       = { for k, v in aws_iam_role.ecs_task : k => v.arn }
}

output "ecs_task_role_names" {
  description = "ECS タスクロール名マップ（キー: サービス名）"
  value       = { for k, v in aws_iam_role.ecs_task : k => v.name }
}

output "ecs_execution_role_arn" {
  description = "ECS タスク実行ロール（共通）の ARN"
  value       = aws_iam_role.ecs_execution.arn
}

output "ecs_execution_role_name" {
  description = "ECS タスク実行ロール（共通）の名前"
  value       = aws_iam_role.ecs_execution.name
}
