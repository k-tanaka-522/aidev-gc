# さくら市マイナンバー基盤 - prod environment - backend.tf
# 作成日: 2026-04-06
# 概要: 本番環境 Terraform State バックエンド設定（S3 + DynamoDB Lock）

terraform {
  backend "s3" {
    bucket         = "sakura-city-tfstate-prod"
    key            = "sakura-city/prod/terraform.tfstate"
    region         = "ap-northeast-1"
    encrypt        = true
    kms_key_id     = "arn:aws:kms:ap-northeast-1:XXXXXXXXXXXX:key/prod-tfstate-key"
    dynamodb_table = "sakura-city-tfstate-lock-prod"
  }
  required_version = ">= 1.6.0"
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}
