---
artifact_id: PARAM-004
title: 監視共通詳細パラメーターシート（CloudWatch Logs / メトリクス / アラーム / ダッシュボード）
version: 1.0
status: draft
author: "[infra-iac] (iac-implementation)"
reviewer: ""
approved_by: ""
created_at: 2026-06-01
updated_at: 2026-06-01
phase: 4
dependencies:
  - artifact: GC-002
    title: GC環境・システム全体構成 基本設計書
    section: "§7.1 共通部 監視構成要素"
    reason: "CloudWatch/CloudTrail/Config/SecurityHub/GuardDuty 配置を継承"
  - artifact: SEC-001
    title: セキュリティ基本設計書
    section: "§7 ConMon/CSPM / §10 インシデント対応"
    reason: "CloudWatch Alarm 設計・SNS 通知フロー・ログ保持期間（ISMAP LG 系）を継承"
---

# 監視共通詳細パラメーターシート

## 改訂履歴

| バージョン | 更新日 | 更新者 | 変更内容 | ステータス |
|-----------|--------|--------|--------|----------|
| 1.0 | 2026-06-01 | infra-iac | 初版作成。ConMon 連携範囲での CloudWatch Logs / メトリクス / アラーム / ダッシュボード の CDK 実装入力レベルパラメーターを展開 | draft |

---

## 1. 凡例・環境差分の考え方

| 環境 | 主な差分点 |
|------|----------|
| dev | Logs 保持 7 日。アラームは SNS 通知のみ（Auto Scaling トリガには使わない）。ダッシュボードは簡易版 |
| stg | Logs 保持 30 日。アラーム有効（Auto Scaling トリガ含む） |
| prod | Logs 保持 90 日（ISMAP LG-2 要件）。アラーム全有効。ダッシュボード詳細版 |

---

## 2. CloudWatch Logs グループ

根拠: SEC-001 §5.1 No.3 / ISMAP LG-17

### 2.1 共通 Logs グループ一覧

| ログ種別 | グループ名 | 保持期間 (prod) | 暗号化 CMK | 備考 |
|---------|---------|--------------|----------|------|
| ECS パブリックサービス | `/helloworld/ecs/tenant-A/public` | 90 日 | アプリ共通 CMK | PARAM-002 §4.1 |
| ECS プライベートサービス | `/helloworld/ecs/tenant-A/private` | 90 日 | アプリ共通 CMK | |
| VPC Flow Logs | `/helloworld/flowlogs/tenant-A` | 90 日 | アプリ共通 CMK | PARAM-001 §8 |
| ALB アクセスログ | S3 バケット（`helloworld-alb-logs-tenant-A`）に直接出力 | 365 日 | テナント別 CMK | S3 Lifecycle で Glacier 移行 |
| CloudFront アクセスログ | S3 バケット（`helloworld-cf-logs-tenant-A`）に直接出力 | 365 日 | テナント別 CMK | |
| WAF ログ | Firehose 経由 S3（`helloworld-waf-logs-tenant-A`） | 365 日 | テナント別 CMK | PARAM-003 §8.1 |

> パターン固有 Logs グループ（Lambda / Batch / Worker）は PARAM-005/006/007 参照。

### 2.2 共通 Logs グループ パラメーター

| パラメーター | 値 | dev差分 | 備考 |
|------------|-----|--------|------|
| kms_key_id | アプリ共通 CMK ARN | — | ISMAP LG-17 |
| retention_in_days | `90` | dev=7 / stg=30 | |
| タグ: compliance | `ismap` | — | |

---

## 3. CloudWatch メトリクス（監視対象）

根拠: GC-002 §5.3 / SEC-001 §7

### 3.1 ECS サービス共通メトリクス

| メトリクス | 名前空間 | ディメンション | 備考 |
|---------|---------|--------------|------|
| CPUUtilization | `AWS/ECS` | ClusterName / ServiceName | Auto Scaling ポリシーに使用 |
| MemoryUtilization | `AWS/ECS` | 同上 | |
| RunningTaskCount | `AWS/ECS` | 同上 | |
| DesiredTaskCount | `AWS/ECS` | 同上 | |

### 3.2 ALB メトリクス

| メトリクス | 名前空間 | 備考 |
|---------|---------|------|
| TargetResponseTime | `AWS/ApplicationELB` | レスポンス遅延 |
| HTTPCode_ELB_5XX_Count | `AWS/ApplicationELB` | ALB 5xx エラー |
| HTTPCode_Target_5XX_Count | `AWS/ApplicationELB` | ECS タスク 5xx |
| UnHealthyHostCount | `AWS/ApplicationELB` | タスク健全性 |
| RequestCount | `AWS/ApplicationELB` | リクエスト数 |

### 3.3 CloudFront メトリクス（追加メトリクス有効化）

| メトリクス | 備考 |
|---------|------|
| 5xxErrorRate | 5xx エラー率 |
| TotalErrorRate | 総エラー率 |
| Requests | リクエスト数 |
| CacheHitRate | キャッシュヒット率 |
> CloudFront 追加メトリクス（詳細）は有料オプション。Hello World 規模では標準メトリクスのみでよい（dev は追加メトリクス無効）。

### 3.4 KMS メトリクス

| メトリクス | 用途 | 備考 |
|---------|-----|------|
| `AWS/KMS` NumberOfRequestsFailedWithKeyError | KMS 復号失敗急増を検知 | SEC-001 §6.5 監視フロー |

---

## 4. CloudWatch アラーム

根拠: SEC-001 §7.4 / ISMAP LG-10

### 4.1 アラーム一覧

| アラーム名 | メトリクス / 条件 | 評価期間 | アクション | 重要度 |
|---------|---------------|---------|---------|-------|
| `helloworld-A-public-cpu-high` | ECS CPUUtilization > 80% (1 期間) | 5 分 | SNS 通知 | WARNING |
| `helloworld-A-public-alb-5xx` | ALB HTTPCode_ELB_5XX_Count > 10 (1 期間) | 1 分 | SNS 通知 | CRITICAL |
| `helloworld-A-public-unhealthy` | ALB UnHealthyHostCount >= 1 (1 期間) | 1 分 | SNS 通知 | CRITICAL |
| `helloworld-A-private-cpu-high` | ECS CPUUtilization > 80% | 5 分 | SNS 通知 | WARNING |
| `helloworld-A-cf-5xx-rate` | CloudFront 5xxErrorRate > 5% | 5 分 | SNS 通知 | WARNING |
| `helloworld-kms-decrypt-fail` | KMS NumberOfRequestsFailedWithKeyError > 5 | 1 分 | SNS 通知 | CRITICAL |
| `helloworld-guardduty-high` | GuardDuty High Severity (EventBridge) | リアルタイム | SNS 通知 | CRITICAL |

> パターン固有アラーム（Lambda エラー / Batch ジョブ失敗 / SQS キュー深度）は PARAM-005/006/007 参照。

### 4.2 アラーム共通設定

| パラメーター | 値 | 備考 |
|------------|-----|------|
| actions_enabled | `true` | |
| alarm_actions | `helloworld-app-alerts` SNS トピック ARN | |
| ok_actions | `helloworld-app-alerts` SNS トピック ARN | 回復通知 |
| insufficient_data_actions | `helloworld-app-alerts` SNS トピック ARN | |
| treat_missing_data | `notBreaching` | データなしは OK 扱い（dev 停止時考慮） |

---

## 5. SNS トピック（アプリアラート）

| パラメーター | 値 | 備考 |
|------------|-----|------|
| topic_name | `helloworld-app-alerts` | |
| kms_master_key_id | アプリ共通 CMK ARN | |
| サブスクリプション | 運用チームメール（仮: ops@example.go.jp） | |

> セキュリティアラート SNS（`helloworld-security-alerts`）は PARAM-003 §10 参照（別トピック）。

---

## 6. CloudWatch ダッシュボード

根拠: GC-002 §7.1 監視構成要素

### 6.1 ダッシュボード構成

| ダッシュボード名 | 対象 | 主要ウィジェット |
|---------------|-----|--------------|
| `helloworld-overview` | 全体俯瞰 | ALB RequestCount / 5xx / ECS Running Tasks / CloudFront 5xx |
| `helloworld-ecs-tenant-A` | テナント A ECS | CPU / Memory / Task Count（公開/非公開） |
| `helloworld-batch-pattern` | 3 パターン比較 | Lambda エラー / Batch キュー深度 / SQS キュー深度 + Worker ECS |

> dev 環境では `helloworld-overview` のみ作成（コスト削減）。prod では 3 ダッシュボード全て作成。

### 6.2 ダッシュボード設定

| パラメーター | 値 | 備考 |
|------------|-----|------|
| 更新間隔 | 1 分（リアルタイム） | |
| 時間範囲 (デフォルト) | 過去 3 時間 | |
| 自動更新 | ON | |

---

## 7. Log Insights クエリ（代表例）

根拠: SEC-001 §7（監視・ログ分析基盤）

### 7.1 ECS アプリエラー検出

```
fields @timestamp, @message
| filter @logStream like /tenant-A/
| filter @message like /ERROR|WARN/
| sort @timestamp desc
| limit 50
```

### 7.2 KMS 復号失敗検出

```
fields @timestamp, eventName, errorCode, userAgent
| filter eventSource = "kms.amazonaws.com"
| filter errorCode != ""
| sort @timestamp desc
| limit 20
```

### 7.3 未認可 API 呼び出し（CloudTrail）

```
fields @timestamp, userIdentity.arn, eventName, sourceIPAddress, errorCode
| filter errorCode = "AccessDenied" or errorCode = "UnauthorizedOperation"
| sort @timestamp desc
| limit 50
```

---

## 8. 構築リソース種別数サマリ（監視共通部）

| リソース種別 | 数量（1テナント） | 見積按分備考 |
|------------|---------------|-----------|
| CloudWatch Logs グループ（共通） | 2（ECS public/private）+ VPC Flow Logs 1 = 3 | テナント数分 |
| S3 バケット（アクセスログ・WAF ログ） | 3（ALB / CF / WAF 各1） | テナント数分 |
| CloudWatch アラーム（共通） | 7 | テナント数分 |
| SNS トピック（アプリアラート） | 1 | テナント数分 |
| CloudWatch ダッシュボード | 1〜3（dev=1 / prod=3） | テナント数分 |
| EventBridge ルール（GuardDuty 応答） | PARAM-003 §6.2 計上済 | — |

**合計: 監視共通リソース種別 約 5 種 / テナント（16〜17 リソース）**
