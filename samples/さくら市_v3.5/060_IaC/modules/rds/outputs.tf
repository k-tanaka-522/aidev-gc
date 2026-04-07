# さくら市マイナンバー基盤 - rds - outputs.tf
# 作成日: 2026-04-06
# 概要: RDS/ElastiCache モジュールの出力値定義

output "db_endpoint" {
  description = "RDS インスタンスの接続エンドポイント（ホスト名:ポート）"
  value       = "${aws_db_instance.main.address}:${aws_db_instance.main.port}"
}

output "db_address" {
  description = "RDS インスタンスのホスト名"
  value       = aws_db_instance.main.address
}

output "db_port" {
  description = "RDS インスタンスのポート番号"
  value       = aws_db_instance.main.port
}

output "db_name" {
  description = "作成されたデータベース名"
  value       = aws_db_instance.main.db_name
}

output "db_identifier" {
  description = "RDS インスタンス識別子"
  value       = aws_db_instance.main.identifier
}

output "db_arn" {
  description = "RDS インスタンスの ARN"
  value       = aws_db_instance.main.arn
}

output "db_master_user_secret_arn" {
  description = "RDS マスターユーザーパスワードが格納された Secrets Manager シークレットの ARN"
  value       = aws_db_instance.main.master_user_secret[0].secret_arn
}

output "db_subnet_group_name" {
  description = "RDS サブネットグループ名"
  value       = aws_db_subnet_group.main.name
}

output "db_parameter_group_name" {
  description = "RDS パラメータグループ名"
  value       = aws_db_parameter_group.main.name
}

output "redis_primary_endpoint" {
  description = "ElastiCache Redis プライマリエンドポイントのアドレス"
  value       = aws_elasticache_replication_group.main.primary_endpoint_address
}

output "redis_reader_endpoint" {
  description = "ElastiCache Redis リーダーエンドポイントのアドレス"
  value       = aws_elasticache_replication_group.main.reader_endpoint_address
}

output "redis_port" {
  description = "ElastiCache Redis のポート番号"
  value       = aws_elasticache_replication_group.main.port
}

output "redis_replication_group_id" {
  description = "ElastiCache レプリケーショングループ ID"
  value       = aws_elasticache_replication_group.main.id
}

output "redis_arn" {
  description = "ElastiCache レプリケーショングループの ARN"
  value       = aws_elasticache_replication_group.main.arn
}

output "redis_subnet_group_name" {
  description = "ElastiCache サブネットグループ名"
  value       = aws_elasticache_subnet_group.main.name
}

output "rds_monitoring_role_arn" {
  description = "RDS Enhanced Monitoring 用 IAM ロールの ARN"
  value       = aws_iam_role.rds_enhanced_monitoring.arn
}
