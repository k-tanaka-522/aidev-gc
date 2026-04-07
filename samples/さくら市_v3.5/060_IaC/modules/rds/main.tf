# さくら市マイナンバー基盤 - rds - main.tf
# 作成日: 2026-04-06
# 概要: RDS PostgreSQL 15（Multi-AZ、KMS暗号化）、ElastiCache Redis 7（Multi-AZ）、
#        サブネットグループ、パラメータグループ

# ---------------------------------------------------------------------------
# Data Sources
# ---------------------------------------------------------------------------
data "aws_region" "current" {}

# ---------------------------------------------------------------------------
# RDS Subnet Group
# ---------------------------------------------------------------------------
resource "aws_db_subnet_group" "main" {
  name        = "${var.environment}-sakura-dbsng"
  description = "さくら市マイナンバー基盤 RDS サブネットグループ（${var.environment}）"
  subnet_ids  = var.db_subnet_ids

  tags = merge(
    var.tags,
    {
      Name = "${var.environment}-sakura-dbsng"
    }
  )
}

# ---------------------------------------------------------------------------
# RDS Parameter Group（SSL 強制、接続ログ有効）
# ---------------------------------------------------------------------------
resource "aws_db_parameter_group" "main" {
  name        = "${var.environment}-sakura-pg15"
  family      = "postgres15"
  description = "さくら市マイナンバー基盤 PostgreSQL 15 パラメータグループ（${var.environment}）"

  # SSL 強制
  parameter {
    name         = "ssl"
    value        = "1"
    apply_method = "pending-reboot"
  }

  # 接続ログ有効
  parameter {
    name         = "log_connections"
    value        = "1"
    apply_method = "immediate"
  }

  # 切断ログ有効
  parameter {
    name         = "log_disconnections"
    value        = "1"
    apply_method = "immediate"
  }

  # クエリ実行時間ログ（1秒以上）
  parameter {
    name         = "log_min_duration_statement"
    value        = "1000"
    apply_method = "immediate"
  }

  # デッドロックログ
  parameter {
    name         = "deadlock_timeout"
    value        = "1000"
    apply_method = "immediate"
  }

  # shared_preload_libraries（pg_stat_statements 有効）
  parameter {
    name         = "shared_preload_libraries"
    value        = "pg_stat_statements"
    apply_method = "pending-reboot"
  }

  tags = merge(
    var.tags,
    {
      Name = "${var.environment}-sakura-pg15"
    }
  )

  lifecycle {
    create_before_destroy = true
  }
}

# ---------------------------------------------------------------------------
# RDS PostgreSQL 15（Multi-AZ、KMS 暗号化）
# ---------------------------------------------------------------------------
resource "aws_db_instance" "main" {
  identifier = "${var.environment}-sakura-rds"

  # エンジン設定
  engine               = "postgres"
  engine_version       = "15.7"
  instance_class       = var.db_instance_class
  parameter_group_name = aws_db_parameter_group.main.name
  option_group_name    = "default:postgres-15"

  # ストレージ設定
  allocated_storage     = var.allocated_storage
  max_allocated_storage = var.max_allocated_storage
  storage_type          = "gp3"
  storage_encrypted     = true
  kms_key_id            = var.kms_key_id

  # 認証情報（Secrets Manager 参照）
  db_name  = var.db_name
  username = var.db_username
  manage_master_user_password = true
  master_user_secret_kms_key_id = var.kms_key_id

  # ネットワーク設定
  db_subnet_group_name   = aws_db_subnet_group.main.name
  vpc_security_group_ids = [var.rds_security_group_id]
  publicly_accessible    = false
  port                   = 5432

  # 可用性設定
  multi_az               = var.multi_az
  availability_zone      = var.multi_az ? null : var.primary_az

  # バックアップ設定
  backup_retention_period   = var.backup_retention
  backup_window             = "17:00-18:00"
  maintenance_window        = "sun:18:00-sun:19:00"
  copy_tags_to_snapshot     = true
  delete_automated_backups  = false
  skip_final_snapshot       = var.environment != "prod"
  final_snapshot_identifier = var.environment == "prod" ? "${var.environment}-sakura-rds-final-snapshot" : null
  deletion_protection       = var.environment == "prod" ? true : false

  # モニタリング設定
  monitoring_interval             = 60
  monitoring_role_arn             = aws_iam_role.rds_enhanced_monitoring.arn
  enabled_cloudwatch_logs_exports = ["postgresql", "upgrade"]
  performance_insights_enabled    = true
  performance_insights_retention_period = var.environment == "prod" ? 731 : 7
  performance_insights_kms_key_id = var.kms_key_id

  # 自動マイナーバージョンアップグレード
  auto_minor_version_upgrade = false

  # IAM 認証（必要に応じて有効化）
  iam_database_authentication_enabled = true

  tags = merge(
    var.tags,
    {
      Name = "${var.environment}-sakura-rds"
    }
  )

  depends_on = [aws_iam_role_policy_attachment.rds_enhanced_monitoring]
}

# ---------------------------------------------------------------------------
# RDS Enhanced Monitoring IAM Role
# ---------------------------------------------------------------------------
resource "aws_iam_role" "rds_enhanced_monitoring" {
  name = "${var.environment}-sakura-role-rds-monitoring"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "monitoring.rds.amazonaws.com"
        }
      }
    ]
  })

  tags = merge(
    var.tags,
    {
      Name = "${var.environment}-sakura-role-rds-monitoring"
    }
  )
}

resource "aws_iam_role_policy_attachment" "rds_enhanced_monitoring" {
  role       = aws_iam_role.rds_enhanced_monitoring.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AmazonRDSEnhancedMonitoringRole"
}

# ---------------------------------------------------------------------------
# ElastiCache Subnet Group
# ---------------------------------------------------------------------------
resource "aws_elasticache_subnet_group" "main" {
  name        = "${var.environment}-sakura-redis-sng"
  description = "さくら市マイナンバー基盤 ElastiCache サブネットグループ（${var.environment}）"
  subnet_ids  = var.db_subnet_ids

  tags = merge(
    var.tags,
    {
      Name = "${var.environment}-sakura-redis-sng"
    }
  )
}

# ---------------------------------------------------------------------------
# ElastiCache Parameter Group（Redis 7）
# ---------------------------------------------------------------------------
resource "aws_elasticache_parameter_group" "redis" {
  name        = "${var.environment}-sakura-redis7"
  family      = "redis7"
  description = "さくら市マイナンバー基盤 Redis 7 パラメータグループ（${var.environment}）"

  # TLS 通信のみ許可
  parameter {
    name  = "cluster-enabled"
    value = "no"
  }

  tags = merge(
    var.tags,
    {
      Name = "${var.environment}-sakura-redis7"
    }
  )
}

# ---------------------------------------------------------------------------
# ElastiCache Redis 7（Multi-AZ レプリケーショングループ）
# ---------------------------------------------------------------------------
resource "aws_elasticache_replication_group" "main" {
  replication_group_id = "${var.environment}-sakura-redis"
  description          = "さくら市マイナンバー基盤 Redis セッションキャッシュ（${var.environment}）"

  # エンジン設定
  engine               = "redis"
  engine_version       = "7.1"
  node_type            = var.redis_node_type
  port                 = 6379
  parameter_group_name = aws_elasticache_parameter_group.redis.name

  # レプリケーション設定（Multi-AZ）
  num_cache_clusters         = var.redis_num_cache_clusters
  automatic_failover_enabled = var.multi_az
  multi_az_enabled           = var.multi_az

  # ネットワーク設定
  subnet_group_name  = aws_elasticache_subnet_group.main.name
  security_group_ids = [var.redis_security_group_id]

  # 暗号化設定
  at_rest_encryption_enabled  = true
  transit_encryption_enabled  = true
  transit_encryption_mode     = "required"
  kms_key_id                  = var.kms_key_id

  # バックアップ設定
  snapshot_retention_limit = var.redis_snapshot_retention
  snapshot_window          = "16:00-17:00"
  maintenance_window       = "sun:17:00-sun:18:00"

  # 自動マイナーバージョンアップグレード
  auto_minor_version_upgrade = false

  # ログ設定
  log_delivery_configuration {
    destination      = "/aws/elasticache/${var.environment}-sakura-redis/slow-logs"
    destination_type = "cloudwatch-logs"
    log_format       = "json"
    log_type         = "slow-log"
  }

  log_delivery_configuration {
    destination      = "/aws/elasticache/${var.environment}-sakura-redis/engine-logs"
    destination_type = "cloudwatch-logs"
    log_format       = "json"
    log_type         = "engine-log"
  }

  tags = merge(
    var.tags,
    {
      Name = "${var.environment}-sakura-redis"
    }
  )
}

# ElastiCache Log Groups
resource "aws_cloudwatch_log_group" "redis_slow_logs" {
  name              = "/aws/elasticache/${var.environment}-sakura-redis/slow-logs"
  retention_in_days = 90

  tags = merge(
    var.tags,
    {
      Name = "${var.environment}-sakura-redis-slow-logs"
    }
  )
}

resource "aws_cloudwatch_log_group" "redis_engine_logs" {
  name              = "/aws/elasticache/${var.environment}-sakura-redis/engine-logs"
  retention_in_days = 90

  tags = merge(
    var.tags,
    {
      Name = "${var.environment}-sakura-redis-engine-logs"
    }
  )
}
