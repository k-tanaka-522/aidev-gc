---
artifact_id: PARAM-005
title: パターンA Lambda詳細パラメーターシート
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
    section: "§6.1 パターンA Lambda / §7.2 パターン固有部"
    reason: "Lambda 構成要素（関数/トリガ/DLQ/VPC Lambda）を継承"
  - artifact: NW-001
    title: ネットワーク基本設計書
    section: "§8.1 NWリソース差分表（パターンA）"
    reason: "Lambda ENI/SG/Endpoint（SQS/Logs/S3/STS/KMS）の要否を継承"
  - artifact: SEC-001
    title: セキュリティ基本設計書
    section: "§4.5 lambdaExecRole-A / §9.1 セキュリティ差分マトリクス（A）"
    reason: "Lambda 実行ロール・暗号化ポイント・DLQ CMK を継承"
---

# パターンA Lambda 詳細パラメーターシート

## 改訂履歴

| バージョン | 更新日 | 更新者 | 変更内容 | ステータス |
|-----------|--------|--------|--------|----------|
| 1.0 | 2026-06-01 | infra-iac | 初版作成。GC-002/NW-001/SEC-001 を入力に、パターン A Lambda の CDK 実装入力レベルパラメーターを展開 | draft |

---

## 1. 凡例・環境差分

| 環境 | 主な差分点 |
|------|----------|
| dev | reserved_concurrent_executions=5（課金上限管理）。DLQ は SNS 通知のみ。Logs 保持 7 日 |
| stg | reserved_concurrent_executions=20。DLQ 通知有効 |
| prod | reserved_concurrent_executions=100（仮）。DLQ 通知 + アラーム |

---

## 2. Lambda 関数

根拠: GC-002 §6.1

| パラメーター | 値 | dev差分 | 備考 |
|------------|-----|--------|------|
| function_name | `helloworld-tenant-A-batch-pattern-A` | — | |
| description | `Hello World batch function - Pattern A Lambda` | — | |
| runtime | `java21` | — | Spring Boot Hello World |
| handler | `com.example.HelloWorldHandler::handleRequest` | — | |
| code.s3_bucket または container_image | zip（S3 デプロイ前提、QA-102 仮定） | — | ECR コンテナ採用時は PARAM-002 ECR 参照 |
| timeout | `300` (5分) | dev=30 | Lambda 最大 15 分。Hello World は短時間 |
| memory_size | `512` MB | dev=256 | |
| ephemeral_storage | `512` MB | — | `/tmp` 一時ストレージ |
| architectures | `x86_64` | — | |
| kms_key_arn | アプリ共通 CMK ARN | — | 環境変数の暗号化（SEC-001 §5.1 No.6） |
| reserved_concurrent_executions | `100` | dev=5 / stg=20 | スロットリング上限 |

### 2.1 VPC 設定（VPC Lambda）

| パラメーター | 値 | dev差分 | 備考 |
|------------|-----|--------|------|
| vpc_config.subnet_ids | Private-Batch-1a, Private-Batch-1c | — | NW-001 §4.2 Private-Batch |
| vpc_config.security_group_ids | sg-batch-A | — | PARAM-001 §10 / PARAM-005 §5 |

> VPC Lambda 配置により、ENI が Private-Batch サブネットに払い出される（NW-001 §8.1）。コールドスタート時に ENI 割当レイテンシが発生することを設計前提として明記（GC-002 §6.4 制約）。

### 2.2 環境変数

| 変数名 | 値 | 備考 |
|------|-----|------|
| `TENANT_ID` | `A` | テナント識別 |
| `S3_OUTPUT_BUCKET` | `helloworld-tenant-A-output` | 成果物出力先 |
| `S3_OUTPUT_PREFIX` | `pattern-A/` | |
| `DLQ_URL` | SQS DLQ URL（SSM Parameter 参照） | |
| `LOG_LEVEL` | `INFO` | dev=DEBUG |

> 環境変数は KMS CMK で暗号化（`kms_key_arn` 設定で自動）。秘密情報（DB パスワード等）は Secrets Manager 参照（本案件 Hello World では不要）。

### 2.3 Lambda Logs グループ

| パラメーター | 値 | dev差分 | 備考 |
|------------|-----|--------|------|
| log_group_name | `/aws/lambda/helloworld-tenant-A-batch-pattern-A` | — | Lambda 自動作成に先行して CDK で作成し CMK 設定 |
| retention_in_days | `90` | dev=7 / stg=30 | ISMAP LG-2 |
| kms_key_id | アプリ共通 CMK ARN | — | |

---

## 3. EventBridge ルール（Lambda トリガ）

根拠: GC-002 §6.1 データフロー

| パラメーター | 値 | dev差分 | 備考 |
|------------|-----|--------|------|
| rule_name | `helloworld-tenant-A-pattern-A-schedule` | — | |
| schedule_expression | `rate(5 minutes)` | dev=`rate(60 minutes)` | QA-102 仮定: 軽量・5分毎 |
| state | `ENABLED` | dev=`DISABLED` | dev は手動テスト用 |
| ターゲット | Lambda 関数 ARN | — | |
| input | `{"tenant": "A", "pattern": "A"}` | — | コンテキスト引数 |
| タグ: pattern | `lambda` | — | GC-002 §4.6 |

---

## 4. SQS DLQ（Dead Letter Queue）

根拠: GC-002 §6.1 / NW-001 §8.1 / SEC-001 §9.1

| パラメーター | 値 | dev差分 | 備考 |
|------------|-----|--------|------|
| queue_name | `helloworld-tenant-A-pattern-A-dlq` | — | |
| visibility_timeout_seconds | `300` | — | Lambda timeout と同等 |
| message_retention_seconds | `1209600` (14 日) | dev=86400 | |
| kms_master_key_id | テナント別データ CMK ARN（テナント A） | — | SEC-001 §9.1 暗号化ポイント |
| receive_message_wait_time_seconds | `20` | — | Long Polling |
| タグ: pattern | `lambda` | — | |

**Lambda の DLQ 設定**:

| パラメーター | 値 | 備考 |
|------------|-----|------|
| dead_letter_config.target_arn | 上記 DLQ ARN | 最大試行回数後に DLQ へ |

---

## 5. セキュリティグループ（sg-batch-A）

根拠: SEC-001 §6.3 / NW-001 §8.1

| 方向 | プロトコル | ポート | 送信元/宛先 | 説明 |
|------|----------|-------|-----------|-----|
| In | — | — | なし | アウトバウンド処理のみ |
| Out | TCP | 443 | sg-vpc-endpoint | Logs/STS/KMS/SQS Endpoint |
| Out | TCP | 443 | S3 プレフィックスリスト | S3 Gateway Endpoint |

---

## 6. IAM ロール（lambdaExecRole-A）

根拠: SEC-001 §4.5

| 項目 | 値 |
|-----|-----|
| ロール名 | `lambdaExecRole-A-tenant-A` |
| Trusted Entity | `lambda.amazonaws.com` |
| 管理ポリシー | `AWSLambdaVPCAccessExecutionRole`（VPC ENI 作成権限含む） |
| 追加許可 Action | `s3:PutObject`（`helloworld-tenant-A-output` バケット）; `sqs:SendMessage`（DLQ ARN）; `kms:GenerateDataKey`, `kms:Decrypt`（テナント A データ CMK, アプリ共通 CMK）; `logs:CreateLogStream`, `logs:PutLogEvents` |
| テナント条件 | `aws:ResourceTag/tenant = A`（S3/SQS に適用） |
| Permission Boundary | `PB-ServiceRole` |
| インラインポリシー | 禁止 |

---

## 7. S3 成果物バケット（パターン A）

根拠: GC-002 §6.1 成果物出力

| パラメーター | 値 | 備考 |
|------------|-----|------|
| bucket_name | `helloworld-tenant-A-output` | |
| versioning | `enabled` | SEC-001 §5.1 No.1 |
| encryption | SSE-KMS（テナント A データ CMK） | |
| block_public_access | 全ブロック ON | |
| lifecycle_rule | 30 日後 S3-IA、90 日後 Glacier Instant | |
| タグ: tenant | `A` | |
| タグ: pattern | `lambda` | 按分用 |
| タグ: compliance | `ismap` | |

> S3 バケットポリシー: `aws:SecureTransport=false` の場合 Deny（TLS 強制）。クロステナント Principal を Deny。

---

## 8. CloudWatch アラーム（パターン A 固有）

| アラーム名 | メトリクス / 条件 | アクション | 備考 |
|---------|---------------|---------|------|
| `helloworld-A-lambda-errors` | Lambda Errors >= 3 (1 期間, 1 分) | SNS 通知 | 連続エラー検知 |
| `helloworld-A-lambda-throttles` | Lambda Throttles > 0 (1 期間) | SNS 通知 | スロットリング検知 |
| `helloworld-A-dlq-depth` | SQS ApproximateNumberOfMessagesVisible >= 1 (1 期間, 5 分) | SNS 通知 | DLQ にメッセージ溜積 |
| `helloworld-A-lambda-duration` | Lambda Duration > 200,000 ms (1 期間) | SNS 通知 | タイムアウト近接（300 秒=300,000 ms の 2/3） |

---

## 9. 構築リソース種別数（パターン A 固有）・主要差分

| リソース種別 | 数量（1テナント） | 見積按分備考 |
|------------|---------------|-----------|
| Lambda 関数 | 1 | |
| Lambda Logs グループ | 1 | |
| EventBridge ルール（スケジュール） | 1 | |
| SQS DLQ | 1 | |
| IAM ロール（lambdaExecRole-A） | 1 | |
| SG（sg-batch-A） | 1 | |
| S3 成果物バケット | 1 | |
| CloudWatch アラーム（固有） | 4 | |

**パターン A 固有リソース: 8 種（11 リソース）**

### 主要差分（他パターンとの比較）

| 比較点 | パターン A | パターン B | パターン C |
|-------|---------|---------|---------|
| コンテナ使用 | なし（zip デプロイ前提） | あり（ECR 必須） | あり（ECR 必須） |
| ECR Endpoint 要否 | 不要 | **必要** | **必要** |
| Batch Endpoint 要否 | 不要 | **必要** | 不要 |
| SQS Endpoint 用途 | DLQ のみ | 任意 | **キュー主路** |
| 常時稼働コスト | 実行時のみ（最小） | Fargate CE 管理リソース | 最小ワーカー常時 |
| IAM ロール数 | 1 | 2（サービス/ジョブ分離） | 3（Exec/Task/AutoScale） |
| OS/AMI 責務 | なし（マネージド） | EC2 CE 時に発生 | なし（Fargate） |
