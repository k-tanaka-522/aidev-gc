---
description: GC監視設計パターン（CloudWatch標準メトリクス、カスタムメトリクス、アラーム設計、ダッシュボード設計）
---

# GC監視設計パターン

## CloudWatch 標準メトリクス

### リソースタイプ別 標準メトリクス一覧

#### EC2 Instance

| メトリクス名 | 単位 | デフォルト周期 | 重要度 |
|-----------|------|------------|--------|
| CPUUtilization | Percent | 1分 | 高 |
| NetworkIn | Bytes | 1分 | 中 |
| NetworkOut | Bytes | 1分 | 中 |
| StatusCheckFailed | Count | 1分 | 高 |
| StatusCheckFailed_Instance | Count | 1分 | 高 |
| StatusCheckFailed_System | Count | 1分 | 高 |
| DiskReadBytes | Bytes | 5分 | 中 |
| DiskWriteBytes | Bytes | 5分 | 中 |

**推奨ダッシュボード**:
- CPUUtilization (警告 >70%, アラート >90%)
- StatusCheckFailed (アラート: いずれか > 0)
- NetworkIn/Out (トレンド監視)

#### RDS Instance

| メトリクス名 | 単位 | 重要度 |
|-----------|------|--------|
| DatabaseConnections | Count | 高 |
| CPUUtilization | Percent | 高 |
| FreeableMemory | Bytes | 高 |
| StorageSpace | Bytes | 高 |
| ReadLatency | Milliseconds | 高 |
| WriteLatency | Milliseconds | 高 |
| DiskQueueDepth | Count | 中 |
| ReplicationLag | Milliseconds | 中 |

**推奨アラーム**:
- DatabaseConnections > (Max Connections × 80%)
- CPUUtilization > 85%
- FreeableMemory < 500 MB
- StorageSpace > (Allocated × 90%)

#### ALB/NLB

| メトリクス名 | 単位 | 重要度 |
|-----------|------|--------|
| ActiveConnectionCount | Count | 中 |
| ProcessedBytes | Bytes | 中 |
| RequestCount | Count | 高 |
| TargetResponseTime | Seconds | 高 |
| HealthyHostCount | Count | 高 |
| UnHealthyHostCount | Count | 高 |
| HTTP 4XX | Count | 中 |
| HTTP 5XX | Count | 高 |

**推奨アラーム**:
- UnHealthyHostCount > 0 (即座にアラート)
- TargetResponseTime > 1秒
- HTTP 5XX が2分間のうち10回以上

#### Lambda

| メトリクス名 | 単位 | 重要度 |
|-----------|------|--------|
| Invocations | Count | 中 |
| Duration | Milliseconds | 高 |
| Errors | Count | 高 |
| Throttles | Count | 高 |
| ConcurrentExecutions | Count | 中 |
| UnreservedConcurrentExecutions | Count | 中 |

**推奨アラーム**:
- Errors > 5 (5分間の合計)
- Duration > 10000 ms (P95)
- Throttles > 0

#### DynamoDB

| メトリクス名 | 単位 | 重要度 |
|-----------|------|--------|
| ConsumedReadCapacityUnits | Count | 高 |
| ConsumedWriteCapacityUnits | Count | 高 |
| UserErrors | Count | 高 |
| SystemErrors | Count | 高 |
| SuccessfulRequestLatency | Milliseconds | 高 |
| ThrottledRequests | Count | 高 |

## カスタムメトリクス 設計

### アプリケーション層メトリクス

```python
# アプリケーション側で CloudWatch にメトリクス送信
import boto3
from datetime import datetime

cloudwatch = boto3.client('cloudwatch')

# ビジネスメトリクス: 注文件数
cloudwatch.put_metric_data(
    Namespace='CompanyApp/Order',
    MetricData=[
        {
            'MetricName': 'OrderCount',
            'Value': 42,
            'Unit': 'Count',
            'Timestamp': datetime.utcnow(),
            'Dimensions': [
                {'Name': 'Environment', 'Value': 'prod'},
                {'Name': 'Service', 'Value': 'order-service'},
            ]
        }
    ]
)

# ビジネスメトリクス: 処理時間
cloudwatch.put_metric_data(
    Namespace='CompanyApp/Order',
    MetricData=[
        {
            'MetricName': 'ProcessingTime',
            'Value': 125,  # ミリ秒
            'Unit': 'Milliseconds',
            'Timestamp': datetime.utcnow(),
        }
    ]
)
```

### カスタムメトリクス例

| メトリクス名 | 意図 | 単位 | 警告閾値 |
|-----------|------|------|--------|
| ActiveUsers | オンラインユーザー数 | Count | - |
| OrderProcessingTime | 注文処理時間 | Milliseconds | >5000 |
| InventoryLevel | 在庫数 | Count | <100 |
| PaymentGatewayLatency | 決済API遅延 | Milliseconds | >2000 |
| CacheHitRate | キャッシュ命中率 | Percent | <75% |
| DatabaseQueryTime | DB平均クエリ時間 | Milliseconds | >1000 |

### CloudWatch Logs Insights クエリ

```
# エラーログ検索
fields @timestamp, @message, @logStream
| filter @message like /ERROR/
| stats count() as ErrorCount by @logStream

# レスポンス時間分析（JSON形式ログ想定）
fields @duration
| filter @duration > 1000
| stats pct(@duration, 50) as p50, pct(@duration, 95) as p95, pct(@duration, 99) as p99

# ステータスコード別集計
fields @statusCode
| stats count() as RequestCount by @statusCode
```

## アラーム設計パターン

### パターン1: 静的閾値

```
if CPUUtilization > 80% for 2分間:
  → WARNING
if CPUUtilization > 95% for 1分間:
  → ALERT (SNS → Slack)
```

```hcl
resource "aws_cloudwatch_metric_alarm" "high_cpu" {
  alarm_name          = "ec2-high-cpu"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 1
  metric_name         = "CPUUtilization"
  namespace           = "AWS/EC2"
  period              = 60
  statistic           = "Average"
  threshold           = 80
  alarm_description   = "Alert when EC2 CPU exceeds 80%"

  dimensions = {
    InstanceId = aws_instance.main.id
  }

  alarm_actions = [aws_sns_topic.alerts.arn]
}
```

### パターン2: 異常検知（Anomaly Detector）

```hcl
resource "aws_cloudwatch_metric_alarm" "anomaly_detection" {
  alarm_name          = "rds-cpu-anomaly"
  comparison_operator = "LessThanLowerOrGreaterThanUpperThreshold"
  evaluation_periods  = 1

  metrics = [
    {
      id          = "e1"
      expression  = "ANOMALY_DETECTOR(m1, 2)"
      label       = "CPUUtilization (Expected)"
      return_data = true
    },
    {
      id              = "m1"
      return_data     = true
      metric_name     = "CPUUtilization"
      namespace       = "AWS/RDS"
      period          = 300
      stat            = "Average"
      dimensions = {
        DBInstanceIdentifier = "prod-mysql"
      }
    }
  ]

  alarm_actions = [aws_sns_topic.alerts.arn]
}
```

### パターン3: 複合条件アラーム

```hcl
# ALB のヘルスチェック失敗 + レスポンス時間増加時にアラート
resource "aws_cloudwatch_metric_alarm" "composite" {
  alarm_name          = "alb-degradation"
  comparison_operator = "GreaterThanOrEqualToThreshold"
  threshold           = 1
  evaluation_periods  = 2

  metrics = [
    {
      id          = "e1"
      expression  = "IF(m1 > 0 OR m2 > 1000, 1, 0)"
      label       = "ALB Degradation"
      return_data = true
    },
    {
      id              = "m1"
      return_data     = false
      metric_name     = "UnHealthyHostCount"
      namespace       = "AWS/ApplicationELB"
      period          = 60
      stat            = "Maximum"
    },
    {
      id              = "m2"
      return_data     = false
      metric_name     = "TargetResponseTime"
      namespace       = "AWS/ApplicationELB"
      period          = 60
      stat            = "Average"
    }
  ]

  alarm_actions = [aws_sns_topic.critical.arn]
}
```

## ダッシュボード設計

### 3層ダッシュボード構造

#### 層1: 経営ダッシュボード（CTO/事業部長向け）

```
┌─────────────────────────────────────────┐
│  System Status Overview                 │
├─────────────────────────────────────────┤
│ System Health: 99.5% (SLA: 99%)         │
│ Active Users: 12,543 / Peak: 25,000     │
│ Revenue Today: ¥2,450,000 / Target: 2M │
├─────────────────────────────────────────┤
│ Critical Alerts: 2  |  Warnings: 14     │
│ Recent Incidents: Memory Leak in Worker │
│ Estimated Impact: $50K/hour             │
└─────────────────────────────────────────┘
```

#### 層2: 運用ダッシュボード（Operations Team向け）

```
┌─────────────────────────────────────────┐
│  System Health Details                  │
├──────────────┬──────────────────────────┤
│ Component    │ Status     │ Metric       │
├──────────────┼──────────────────────────┤
│ Web Tier     │ OK (CPU 45%)│ ResponseTime: 120ms
│ App Tier     │ WARNING (Memory 78%) │
│ DB Tier      │ OK (Conn 156/200)   │
│ Cache        │ OK (Hit 92%)        │
│ Message Queue│ WARNING (Age 45s)   │
└─────────────────────────────────────────┘

Timeline: 過去24時間のメトリクス
- CPUUtilization: Peak 92% at 14:30
- ErrorRate: <0.01% (acceptable)
- P99 Latency: 500ms
```

#### 層3: 技術ダッシュボード（DevOps/Engineer向け）

```
詳細なリソース別メトリクス
├── EC2 Dashboard
│   ├── Instance-1: CPU 45%, Memory 78%, Network 12 Mbps
│   ├── Instance-2: CPU 52%, Memory 71%, Network 8 Mbps
│   └── Instance-3: CPU 38%, Memory 65%, Network 10 Mbps
├── RDS Dashboard
│   ├── Connections: 156 / 200 (78%)
│   ├── Read Latency: 2.3ms (avg)
│   ├── Write Latency: 4.1ms (avg)
│   └── Replica Lag: 0.2s
├── Lambda Dashboard
│   ├── Invocations: 45,231 / hour
│   ├── Duration: p50: 250ms, p95: 800ms, p99: 1200ms
│   ├── Errors: 12 (0.03%)
│   └── Throttles: 0
└── CloudWatch Logs
    └── Error Rate: 0.01% (acceptable)
```

### ダッシュボード実装（Terraform）

```hcl
resource "aws_cloudwatch_dashboard" "operations" {
  dashboard_name = "operations-dashboard"

  dashboard_body = jsonencode({
    widgets = [
      {
        type = "metric"
        properties = {
          metrics = [
            ["AWS/EC2", "CPUUtilization", { stat = "Average" }],
            ["AWS/RDS", "DatabaseConnections"],
            ["AWS/ApplicationELB", "TargetResponseTime"],
          ]
          period = 300
          stat   = "Average"
          region = "ap-northeast-1"
          title  = "System Overview"
        }
      },
      {
        type = "metric"
        properties = {
          metrics = [
            ["AWS/Lambda", "Errors"],
            ["AWS/Lambda", "Duration"],
          ]
          title = "Lambda Metrics"
        }
      },
      {
        type = "log"
        properties = {
          query   = "fields @timestamp, @message | filter @message like /ERROR/ | stats count() as ErrorCount"
          region  = "ap-northeast-1"
          title   = "Recent Errors"
        }
      },
    ]
  })
}
```

## CloudWatch Logs Insights 主要クエリテンプレート

### エラー分析

```
fields @timestamp, @message, @logStream
| filter @message like /ERROR|Exception|Failed/
| stats count() as count by @logStream
```

### パフォーマンス分析

```
fields @duration, @statusCode
| filter @duration > 1000
| stats avg(@duration) as avg_duration, max(@duration) as max_duration, pct(@duration, 95) as p95 by @statusCode
```

### トラフィック分析

```
fields @statusCode
| stats count() as total, sum(if(@statusCode >= 500, 1, 0)) as errors by bin(5m)
```

### ユーザー行動分析

```
fields userId, @timestamp, action
| stats count() as actionCount by userId
| filter actionCount > 100
```

## 監視設計チェックリスト

- [ ] 標準メトリクス（AWS標準）が全リソースタイプで定義済み
- [ ] カスタムメトリクス（ビジネスKPI）が定義済み
- [ ] アラーム設計が「警告/アラート」2段階で実装
- [ ] 異常検知が Lambda/RDS等で有効化
- [ ] 3層ダッシュボード（経営/運用/技術）が構築済み
- [ ] CloudWatch Logs 集約が有効化
- [ ] Logs Insights クエリが運用ハンドブック化
- [ ] アラーム通知先（SNS → Slack/PagerDuty）が設定済み
- [ ] ダッシュボード URL が共有化（Wiki等）
- [ ] メトリクス保持期間が確認済み（15ヶ月 or カスタム）
