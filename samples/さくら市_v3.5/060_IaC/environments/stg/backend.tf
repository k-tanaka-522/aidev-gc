# さくら市マイナンバー基盤 - stg environment - backend.tf
# 作成日: 2026-04-06
# 概要: ステージング環境 Terraform State バックエンド設定（S3 + DynamoDB Lock）

terraform {
  backend "s3" {
    bucket         = "sakura-city-tfstate-stg"
    key            = "sakura-city/stg/terraform.tfstate"
    region         = "ap-northeast-1"
    encrypt        = true
    kms_key_id     = "arn:aws:kms:ap-northeast-1:XXXXXXXXXXXX:key/stg-tfstate-key"
    dynamodb_table = "sakura-city-tfstate-lock-stg"
  }
  required_version = ">= 1.6.0"
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}
