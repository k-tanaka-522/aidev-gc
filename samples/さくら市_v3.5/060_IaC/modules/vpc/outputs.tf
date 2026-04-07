# さくら市マイナンバー基盤 - vpc - outputs.tf
# 作成日: 2026-04-06
# 概要: VPC モジュールの出力値定義

output "vpc_id" {
  description = "作成した VPC の ID"
  value       = aws_vpc.main.id
}

output "vpc_cidr" {
  description = "VPC の CIDR ブロック"
  value       = aws_vpc.main.cidr_block
}

output "public_subnet_ids" {
  description = "パブリックサブネットの ID マップ（キー: 'public-<AZ>'）"
  value       = { for k, v in aws_subnet.public : k => v.id }
}

output "app_subnet_ids" {
  description = "アプリケーション層サブネットの ID マップ（キー: 'app-<AZ>'）"
  value       = { for k, v in aws_subnet.app : k => v.id }
}

output "db_subnet_ids" {
  description = "DB 層サブネットの ID マップ（キー: 'db-<AZ>'）"
  value       = { for k, v in aws_subnet.db : k => v.id }
}

output "mgmt_subnet_ids" {
  description = "管理層サブネットの ID マップ（キー: 'mgmt-<AZ>'）"
  value       = { for k, v in aws_subnet.mgmt : k => v.id }
}

output "nat_gateway_ids" {
  description = "NAT Gateway の ID マップ（キー: AZ 名）"
  value       = { for k, v in aws_nat_gateway.main : k => v.id }
}

output "internet_gateway_id" {
  description = "Internet Gateway の ID"
  value       = aws_internet_gateway.main.id
}

output "endpoint_ids" {
  description = "作成した VPC Endpoint の ID マップ"
  value = {
    s3              = aws_vpc_endpoint.s3.id
    ecr_api         = aws_vpc_endpoint.ecr_api.id
    ecr_dkr         = aws_vpc_endpoint.ecr_dkr.id
    ssm             = aws_vpc_endpoint.ssm.id
    ssmmessages     = aws_vpc_endpoint.ssmmessages.id
    ec2messages     = aws_vpc_endpoint.ec2messages.id
    secrets_manager = aws_vpc_endpoint.secrets_manager.id
  }
}

output "vpce_security_group_id" {
  description = "VPC Interface Endpoint 用セキュリティグループ ID"
  value       = aws_security_group.vpce.id
}

output "public_route_table_id" {
  description = "パブリックルートテーブルの ID"
  value       = aws_route_table.public.id
}

output "app_route_table_ids" {
  description = "アプリケーション層ルートテーブルの ID マップ（キー: AZ 名）"
  value       = { for k, v in aws_route_table.app : k => v.id }
}

output "db_route_table_ids" {
  description = "DB 層ルートテーブルの ID マップ（キー: AZ 名）"
  value       = { for k, v in aws_route_table.db : k => v.id }
}

output "vpc_flow_log_group_name" {
  description = "VPC Flow Logs の CloudWatch Log Group 名"
  value       = aws_cloudwatch_log_group.vpc_flow_logs.name
}
