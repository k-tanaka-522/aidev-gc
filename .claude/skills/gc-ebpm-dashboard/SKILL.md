---
description: GCAS EBPM連携（EBPMダッシュボードとの連携設計、メトリクス送信、レポーティング）
---

# GCAS EBPM連携ガイド

## EBPM（Electronic Business Performance Management）概要

EBPM は政府情報システムのパフォーマンスを可視化・管理するシステム。GC（Google Cloud）導入後は、EBPM への統計データ送信が必須。

## EBPM 統計項目

### 必須統計項目

| 項目 | 単位 | 報告周期 | 説明 |
|-----|------|--------|------|
| **利用件数** | 件/月 | 月次 | システム利用件数（トランザクション数等） |
| **利用者数** | 人 | 月次 | 実際の利用者数（MAU: Monthly Active Users） |
| **稼働率** | % | 月次 | システム可用性（99.5% 等） |
| **平均応答時間** | ms | 月次 | ユーザーアクション完了までの時間（中央値） |
| **運用コスト** | 円 | 月次 | GC月額費用 + 運用費 |
| **セキュリティインシデント** | 件 | 月次 | セキュリティ侵害、異常ログイン検出等 |

### 任意追加項目

| 項目 | 単位 | 説明 |
|-----|------|------|
| **エラー率** | % | API呼び出し失敗率 |
| **P95応答時間** | ms | 95パーセンタイル応答時間 |
| **CPU利用率** | % | インフラリソース利用率 |
| **ストレージ利用量** | GB | 累積データ量 |
| **ユーザー満足度** | スコア | NPS or 5段階評価 |

## EBPM メトリクス送信アーキテクチャ

### パターン1: 直接統合（Webhook）

```
CloudWatch Metrics
    ↓
Lambda (トリガー: 日次 EventBridge)
    ↓
Metrics 集計・計算
    ↓
EBPM API Endpoint
    ↓
POST https://ebpm.soumu.go.jp/api/v1/submit
(認証: API Key + HMAC署名)
```

#### Lambda 関数の実装例

```python
# lambda_function.py
import boto3
import json
from datetime import datetime, timedelta
import requests
import hashlib
import hmac

cloudwatch = boto3.client('cloudwatch')
s3 = boto3.client('s3')

EBPM_ENDPOINT = 'https://ebpm.soumu.go.jp/api/v1/submit'
EBPM_API_KEY = '<secured via Secrets Manager>'
SYSTEM_ID = 'GC-Web-App-001'

def lambda_handler(event, context):
    # 過去30日分のメトリクスを集計
    end_time = datetime.utcnow()
    start_time = end_time - timedelta(days=30)

    # 利用件数（CloudWatch カスタムメトリクック）
    transaction_count = get_transaction_count(start_time, end_time)

    # 稼働率（CloudWatch Status Check）
    availability = calculate_availability(start_time, end_time)

    # 平均応答時間（ALB TargetResponseTime）
    avg_response_time = get_avg_response_time(start_time, end_time)

    # エラー率（Lambda Errors）
    error_rate = get_error_rate(start_time, end_time)

    # GC月額コスト（Cost Explorer API）
    monthly_cost = get_monthly_cost()

    # EBPM送信データ作成
    ebpm_data = {
        'systemId': SYSTEM_ID,
        'reportDate': end_time.isoformat(),
        'metrics': {
            'transactionCount': transaction_count,
            'availability': availability,
            'avgResponseTime': avg_response_time,
            'errorRate': error_rate,
            'monthlyCost': monthly_cost,
        }
    }

    # HMAC署名生成
    signature = generate_signature(ebpm_data, EBPM_API_KEY)

    # EBPM API へ送信
    headers = {
        'Content-Type': 'application/json',
        'Authorization': f'Bearer {EBPM_API_KEY}',
        'X-Signature': signature,
    }

    response = requests.post(
        EBPM_ENDPOINT,
        json=ebpm_data,
        headers=headers,
        timeout=30
    )

    # 送信結果をS3に保存（監査証跡）
    s3.put_object(
        Bucket='ebpm-submission-logs',
        Key=f'submissions/{end_time.strftime("%Y/%m/%d")}/submission.json',
        Body=json.dumps({
            'sent': ebpm_data,
            'response_status': response.status_code,
            'timestamp': datetime.utcnow().isoformat(),
        })
    )

    return {
        'statusCode': response.status_code,
        'body': json.dumps({'message': 'EBPM submission completed'})
    }

def get_transaction_count(start, end):
    # アプリケーション側でカウント送信している想定
    response = cloudwatch.get_metric_statistics(
        Namespace='CompanyApp/Business',
        MetricName='TransactionCount',
        StartTime=start,
        EndTime=end,
        Period=86400,  # 日次集計
        Statistics=['Sum']
    )
    return sum([dp['Sum'] for dp in response['Datapoints']])

def calculate_availability(start, end):
    # StatusCheck が失敗した時間比率を計算
    response = cloudwatch.get_metric_statistics(
        Namespace='AWS/EC2',
        MetricName='StatusCheckFailed',
        StartTime=start,
        EndTime=end,
        Period=300,  # 5分単位
        Statistics=['Maximum']
    )

    total_points = len([dp for dp in response['Datapoints']])
    failed_points = len([dp for dp in response['Datapoints'] if dp['Maximum'] > 0])

    if total_points == 0:
        return 100.0
    return ((total_points - failed_points) / total_points) * 100

def get_avg_response_time(start, end):
    response = cloudwatch.get_metric_statistics(
        Namespace='AWS/ApplicationELB',
        MetricName='TargetResponseTime',
        StartTime=start,
        EndTime=end,
        Period=3600,  # 1時間単位
        Statistics=['Average']
    )
    times = [dp['Average'] for dp in response['Datapoints']]
    return sum(times) / len(times) * 1000 if times else 0  # ミリ秒に変換

def get_error_rate(start, end):
    # エラー数 / 全リクエスト数
    error_response = cloudwatch.get_metric_statistics(
        Namespace='AWS/Lambda',
        MetricName='Errors',
        StartTime=start,
        EndTime=end,
        Period=86400,
        Statistics=['Sum']
    )
    invocation_response = cloudwatch.get_metric_statistics(
        Namespace='AWS/Lambda',
        MetricName='Invocations',
        StartTime=start,
        EndTime=end,
        Period=86400,
        Statistics=['Sum']
    )

    total_errors = sum([dp['Sum'] for dp in error_response['Datapoints']])
    total_invocations = sum([dp['Sum'] for dp in invocation_response['Datapoints']])

    if total_invocations == 0:
        return 0.0
    return (total_errors / total_invocations) * 100

def get_monthly_cost():
    # AWS Cost Explorer API
    ce = boto3.client('ce')
    end_date = datetime.utcnow().date()
    start_date = (end_date.replace(day=1))

    response = ce.get_cost_and_usage(
        TimePeriod={
            'Start': start_date.isoformat(),
            'End': end_date.isoformat(),
        },
        Granularity='MONTHLY',
        Metrics=['UnblendedCost'],
    )

    total_cost = sum([float(result['Total']['UnblendedCost']['amount'])
                      for result in response['ResultsByTime']])
    return round(total_cost, 2)

def generate_signature(data, api_key):
    message = json.dumps(data, sort_keys=True)
    signature = hmac.new(
        api_key.encode(),
        message.encode(),
        hashlib.sha256
    ).hexdigest()
    return signature
```

### パターン2: 月次 CSV エクスポート

```
CloudWatch Logs
    ↓
CloudWatch Logs Insights クエリ
    ↓
S3 に CSV エクスポート
    ↓
EBPM ポータルで手動アップロード
```

#### Terraform で自動化

```hcl
# Lambda 関数: 月次 CSV 生成
resource "aws_lambda_function" "ebpm_csv_export" {
  filename      = "lambda_ebpm_export.zip"
  function_name = "ebpm-csv-export"
  handler       = "index.handler"
  runtime       = "python3.9"

  environment {
    variables = {
      BUCKET_NAME = aws_s3_bucket.ebpm_exports.id
    }
  }
}

# EventBridge: 月初 9:00 に実行
resource "aws_cloudwatch_event_rule" "monthly_trigger" {
  name                = "ebpm-monthly-export"
  schedule_expression = "cron(0 9 1 * ? *)"
}

resource "aws_cloudwatch_event_target" "lambda" {
  rule      = aws_cloudwatch_event_rule.monthly_trigger.name
  target_id = "EBPMExportLambda"
  arn       = aws_lambda_function.ebpm_csv_export.arn
}
```

## EBPM レポーティング

### 月次レポート テンプレート

```
=== GC システム パフォーマンスレポート ===
報告期間: 2026年4月1日～2026年4月30日
システム ID: GC-Web-App-001
報告組織: 〇〇省 △△課

【主要メトリクス】
・システム稼働率: 99.7% (目標: 99.5%)
・平均応答時間: 245ms (目標: <500ms)
・月間利用件数: 1,234,567件
・月間利用者数: 8,934人

【コスト】
・GC月額料金: ¥450,000
・運用コスト: ¥350,000
・合計: ¥800,000 (予算内)

【セキュリティ】
・インシデント件数: 0件
・ファイアウォール検知: 234件（全て正常）
・アクセス異常検知: 2件（対応済み）

【課題・施策】
・4月25日にDB接続数増加により一時的に応答時間が増加
  → Autoscaling ポリシー見直し（5月中に実施予定）
・キャッシュ効率が85%に低下
  → キャッシュキー戦略の最適化で90%を目指す

【次月予定】
・Lambda メモリ増強テスト
・マルチリージョン冗長化検討
```

### Webhook で EBPM に自動送信

```hcl
# Terraform で Lambda + API Gateway を設定
resource "aws_api_gateway_rest_api" "ebpm_webhook" {
  name = "ebpm-webhook-receiver"
}

resource "aws_lambda_function" "process_ebpm_webhook" {
  filename = "lambda_process_webhook.zip"
  handler  = "index.handler"
}

resource "aws_api_gateway_integration" "lambda" {
  rest_api_id = aws_api_gateway_rest_api.ebpm_webhook.id
  resource_id = aws_api_gateway_resource.webhook.id
  http_method = "POST"
  type        = "AWS_PROXY"
  uri         = aws_lambda_function.process_ebpm_webhook.invoke_arn
}
```

## EBPM 連携チェックリスト

- [ ] EBPM 統計項目が CloudWatch メトリクスに マッピング完了
- [ ] Lambda 関数で月次集計ロジック実装済み
- [ ] EBPM API 認証（API Key + HMAC署名）設定済み
- [ ] EventBridge で月初の自動送信トリガー設定済み
- [ ] S3 に送信履歴（監査証跡）保存中
- [ ] EBPM ポータルの認証情報を Secrets Manager で管理
- [ ] 月次レポートテンプレート作成済み
- [ ] エラーハンドリング（送信失敗時の再試行）実装済み
- [ ] CloudWatch Logs で送信ログ監視中
- [ ] 四半期ごとの EBPM レビュー実施予定
