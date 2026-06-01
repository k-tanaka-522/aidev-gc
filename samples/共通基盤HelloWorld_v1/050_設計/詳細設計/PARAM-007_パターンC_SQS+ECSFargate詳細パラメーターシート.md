---
artifact_id: PARAM-007
title: パターンC SQS+ECS Fargate詳細パラメーターシート
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
    section: "§6.3 パターンC SQS+ECS Fargate / §7.2 パターン固有部"
    reason: "SQS/DLQ/Worker Service/Auto Scaling on queue depth の構成要素を継承"
  - artifact: NW-001
    title: ネットワーク基本設計書
    section: "§8.1 NWリソース差分表（パターンC）"
    reason: "SQS/ECR Endpoint・Monitoring Endpoint（キュー深度連動スケール経路）の要否を継承"
  - artifact: SEC-001
    title: セキュリティ基本設計書
    section: "§4.5 ecsTaskRole-worker-C / autoScalingRole-C / §9.1 セキュリティ差分（C）"
    reason: "ワーカーロール・SQS CMK（中核）・DLQ 必須・ECR スキャンを継承"
---

# パターンC SQS+ECS Fargate 詳細パラメーターシート

## 改訂履歴

| バージョン | 更新日 | 更新者 | 変更内容 | ステータス |
|-----------|--------|--------|--------|----------|
| 1.0 | 2026-06-01 | infra-iac | 初版作成。GC-002/NW-001/SEC-001 を入力に、パターン C SQS+ECS Fargate の CDK 実装入力レベルパラメーターを展開 | draft |

---

## 1. 凡例・環境差分

| 環境 | 主な差分点 |
|------|----------|
| dev | Worker desiredCount=1（min）。Auto Scaling 無効（手動テスト用）。Logs 保持 7 日 |
| stg | Worker desiredCount=1。Auto Scaling 有効（min=1/max=4）。DLQ アラーム有効 |
| prod | Auto Scaling min=1/max=10。DLQ 通知 + アラーム。削除保護 ON |

---

## 2. SQS キュー（メイン）

根拠: GC-002 §6.3 / SEC-001 §9.1（SQS CMK 中核）

| パラメーター | 値 | dev差分 | 備考 |
|------------|-----|--------|------|
| queue_name | `helloworld-tenant-A-pattern-C-queue` | — | |
| queue_type | `Standard` | — | 順序保証不要（Hello World 仮定）。FIFO が要件に応じて変更 |
| visibility_timeout_seconds | `300` | — | ECS タスク処理時間の目安（余裕係数付き）。Lambda/Batch と同様に 5 分 |
| message_retention_seconds | `1209600` (14 日) | dev=86400 | |
| receive_message_wait_time_seconds | `20` | — | Long Polling（空振りコスト低減） |
| kms_master_key_id | テナント別データ CMK ARN（テナント A） | — | SEC-001 §9.1 SQS CMK 必須 |
| redrive_policy.maxReceiveCount | `5` | — | 5 回失敗後 DLQ に移動 |
| redrive_policy.deadLetterTargetArn | DLQ ARN（§3 参照） | — | |
| タグ: pattern | `sqs-fargate` | — | GC-002 §4.6 |
| タグ: tenant | `A` | — | |
| タグ: compliance | `ismap` | — | |

---

## 3. SQS DLQ（Dead Letter Queue）

根拠: GC-002 §6.3 / SEC-001 §9.1（DLQ 必須）

| パラメーター | 値 | dev差分 | 備考 |
|------------|-----|--------|------|
| queue_name | `helloworld-tenant-A-pattern-C-dlq` | — | |
| message_retention_seconds | `1209600` (14 日) | dev=86400 | |
| kms_master_key_id | テナント別データ CMK ARN（テナント A） | — | SEC-001 §9.1 DLQ CMK 必須 |
| receive_message_wait_time_seconds | `20` | — | |
| タグ: pattern | `sqs-fargate` | — | |
| タグ: compliance | `ismap` | — | |

---

## 4. ECR リポジトリ（パターン C Worker）

根拠: GC-002 §6.3 / NW-001 §8.1（C は ECR Endpoint 必須）

| パラメーター | 値 | 備考 |
|------------|-----|------|
| repository_name | `helloworld/worker-pattern-C` | パターン C ワーカー専用 |
| image_tag_mutability | `IMMUTABLE` | |
| scan_on_push | `true` | SEC-001 §9.1 VN-7 ECR Image Scanning 必須 |
| encryption_type | `KMS` | |
| kms_key | アプリ共通 CMK ARN | |
| タグ: pattern | `sqs-fargate` | |
| タグ: compliance | `ismap` | |

---

## 5. ECS Worker サービス／タスク定義

根拠: GC-002 §6.3

### 5.1 タスク定義（Worker）

| パラメーター | 値 | dev差分 | 備考 |
|------------|-----|--------|------|
| family | `helloworld-tenant-A-worker-C` | — | |
| requires_compatibilities | `FARGATE` | — | |
| network_mode | `awsvpc` | — | |
| cpu | `512` | dev=256 | |
| memory | `1024` | dev=512 | |
| execution_role_arn | `ecsTaskExecutionRole` ARN | — | PARAM-002 §10（共用） |
| task_role_arn | `ecsTaskRole-worker-C-tenant-A` ARN | — | §7 参照 |
| コンテナ名 | `worker` | — | |
| image | `<account-id>.dkr.ecr.ap-northeast-1.amazonaws.com/helloworld/worker-pattern-C:latest` | — | |
| log_driver | `awslogs` | — | |
| log_group | `/helloworld/worker/tenant-A/pattern-C` | — | |
| kms_key（Logs） | アプリ共通 CMK ARN | — | |

**環境変数（Worker タスク）**:

| 変数名 | 値 | 備考 |
|------|-----|------|
| `TENANT_ID` | `A` | |
| `SQS_QUEUE_URL` | SQS メインキュー URL（SSM Parameter 参照） | |
| `SQS_DLQ_URL` | DLQ URL（SSM Parameter 参照） | |
| `S3_OUTPUT_BUCKET` | `helloworld-tenant-A-output` | |
| `S3_OUTPUT_PREFIX` | `pattern-C/` | |

### 5.2 ECS Worker サービス

| パラメーター | 値 | dev差分 | 備考 |
|------------|-----|--------|------|
| service_name | `helloworld-tenant-A-worker-C-svc` | — | |
| launch_type | `FARGATE` | — | |
| desired_count | `1` | dev=1 | Auto Scaling 最小値と一致 |
| subnet_ids | Private-Batch-1a, Private-Batch-1c | — | NW-001 §4.2 |
| security_group_ids | sg-batch-C | — | §6 参照 |
| assign_public_ip | `DISABLED` | — | |
| deployment_minimum_healthy_percent | `50` | dev=0 | スケールイン時に許可 |
| deployment_maximum_percent | `200` | — | |
| health_check_grace_period_seconds | `60` | — | SQS ポーリング安定までの猶予 |
| タグ: pattern | `sqs-fargate` | — | |

---

## 6. Application Auto Scaling（キュー深度連動）

根拠: GC-002 §6.3 / NW-001 §8.2（C の肝: キュー深度連動）

### 6.1 スケーラブルターゲット

| パラメーター | 値 | dev差分 | 備考 |
|------------|-----|--------|------|
| resource_id | `service/helloworld-tenant-A-cluster/helloworld-tenant-A-worker-C-svc` | — | |
| scalable_dimension | `ecs:service:DesiredCount` | — | |
| min_capacity | `1` | dev=1 | 常時最低 1 タスク（アイドルコスト発生、GC-002 §6.3 制約） |
| max_capacity | `10` | dev=2 | |

### 6.2 スケーリングポリシー（Target Tracking: キュー深度）

| パラメーター | 値 | dev差分 | 備考 |
|------------|-----|--------|------|
| policy_name | `helloworld-C-scale-on-queue-depth` | — | |
| policy_type | `TargetTrackingScaling` | — | |
| 対象メトリクス（カスタム） | `SQS ApproximateNumberOfMessages` / タスク数 比率 | — | 1 タスクあたり処理可能メッセージ数（仮: 10）をターゲットに設定 |
| target_value | `10.0` | — | 1 タスクあたり 10 メッセージを維持（QA-102 仮定） |
| scale_out_cooldown | `60` | dev=300 | スケールアウト クールダウン（秒） |
| scale_in_cooldown | `300` | dev=600 | スケールイン クールダウン（秒）。急減で早期終了しないよう長め |

> CDK 実装上のポイント: `SQS ApproximateNumberOfMessages` / `ECS Running Task Count` をカスタムメトリクスとして CloudWatch に Publish し、TargetTracking のカスタムメトリクス仕様に指定する。Monitoring Endpoint（NW-001 §8.1）が成立していることを前提とする。

### 6.3 スケールアウト補助アラーム（CloudWatch Alarm + Step Scaling も可）

| アラーム名 | メトリクス / 条件 | アクション |
|---------|---------------|---------|
| `helloworld-C-queue-depth-high` | SQS ApproximateNumberOfMessages > 50 (1 期間, 1 分) | SNS 通知（Auto Scaling は TargetTracking が自動） |
| `helloworld-C-queue-depth-zero` | SQS ApproximateNumberOfMessages = 0 (3 期間, 5 分) | SNS 通知（アイドル通知） |

---

## 7. セキュリティグループ（sg-batch-C）

根拠: SEC-001 §6.3 / NW-001 §8.1

| 方向 | プロトコル | ポート | 送信元/宛先 | 説明 |
|------|----------|-------|-----------|-----|
| In | — | — | なし | ワーカーはアウトバウンド処理（SQS ポーリング） |
| Out | TCP | 443 | sg-vpc-endpoint | SQS / ECR / Logs / S3 / STS / Monitoring / KMS Endpoint |
| Out | TCP | 443 | S3 プレフィックスリスト | S3 Gateway Endpoint |

---

## 8. IAM ロール

根拠: SEC-001 §4.5, §9.1

### 8.1 ecsTaskRole-worker-C（ワーカー実行ロール）

| 項目 | 値 |
|-----|-----|
| ロール名 | `ecsTaskRole-worker-C-tenant-A` |
| Trusted Entity | `ecs-tasks.amazonaws.com` |
| 許可 Action | `sqs:ReceiveMessage`, `sqs:DeleteMessage`, `sqs:GetQueueAttributes`（メインキュー + DLQ）; `s3:PutObject`（`helloworld-tenant-A-output`）; `kms:Decrypt`, `kms:GenerateDataKey`（テナント A データ CMK: SQS/S3 復号）; `logs:CreateLogStream`, `logs:PutLogEvents` |
| テナント条件 | `aws:ResourceTag/tenant = A` |
| Permission Boundary | `PB-ServiceRole` |

### 8.2 autoScalingRole-C（Auto Scaling ロール）

| 項目 | 値 |
|-----|-----|
| ロール名 | `autoScalingRole-C-tenant-A` |
| Trusted Entity | `application-autoscaling.amazonaws.com` |
| 許可 Action | `cloudwatch:GetMetricData`, `cloudwatch:DescribeAlarms`; `application-autoscaling:*`; `ecs:DescribeServices`, `ecs:UpdateService` |
| リソース範囲 | 自テナント ECS クラスター/サービス ARN |
| Permission Boundary | `PB-ServiceRole` |

---

## 9. Worker Logs グループ

| パラメーター | 値 | dev差分 | 備考 |
|------------|-----|--------|------|
| log_group_name | `/helloworld/worker/tenant-A/pattern-C` | — | |
| retention_in_days | `90` | dev=7 / stg=30 | |
| kms_key_id | アプリ共通 CMK ARN | — | |

---

## 10. S3 成果物バケット（パターン C）

| 備考 |
|------|
| PARAM-005 §7 の S3 バケット（`helloworld-tenant-A-output`）を共用し、prefix `pattern-C/` で分離。重複作成しない。 |

---

## 11. CloudWatch アラーム（パターン C 固有）

| アラーム名 | メトリクス / 条件 | アクション | 備考 |
|---------|---------------|---------|------|
| `helloworld-C-worker-cpu-high` | ECS Worker CPUUtilization > 80% (1 期間, 5 分) | SNS 通知 | |
| `helloworld-C-queue-depth-high` | SQS ApproximateNumberOfMessages > 50 (1 分) | SNS 通知 | §6.3 の補助アラーム |
| `helloworld-C-dlq-messages` | DLQ ApproximateNumberOfMessagesVisible >= 1 (5 分) | SNS 通知（CRITICAL） | DLQ 溜積は異常 |
| `helloworld-C-worker-task-count` | ECS RunningTaskCount < 1 (1 分) | SNS 通知（CRITICAL） | 最小ワーカー 0 台は障害 |
| `helloworld-C-sqs-msg-age` | SQS ApproximateAgeOfOldestMessage > 900 sec (5 分) | SNS 通知 | メッセージ処理遅延（15分超） |

---

## 12. 構築リソース種別数（パターン C 固有）・主要差分

| リソース種別 | 数量（1テナント） | 見積按分備考 |
|------------|---------------|-----------|
| SQS キュー（メイン） | 1 | |
| SQS DLQ | 1 | |
| ECR リポジトリ（Worker 専用） | 1 | |
| ECS タスク定義（Worker） | 1 | |
| ECS サービス（Worker） | 1 | |
| Application Auto Scaling（スケーラブルターゲット） | 1 | |
| Auto Scaling ポリシー（Target Tracking） | 1 | |
| IAM ロール（Worker/AutoScaling） | 2（TaskRole / AutoScalingRole） | ecsTaskExecutionRole は共用 |
| SG（sg-batch-C） | 1 | |
| CloudWatch Logs グループ（Worker） | 1 | |
| CloudWatch アラーム（固有） | 5 | |

**パターン C 固有リソース: 11 種（16 リソース）**

### 主要差分（他パターンとの比較）

| 比較点 | パターン A | パターン B | パターン C |
|-------|---------|---------|---------|
| 固有リソース種別数 | 8 種 | 9 種 | **11 種** |
| SQS メインキュー | なし（DLQ のみ） | 任意 | **必須（中核）** |
| SQS Endpoint 用途 | DLQ のみ | 任意 | **メイン + DLQ** |
| Monitoring Endpoint 依存 | 低 | 低 | **高（キュー深度連動スケール）** |
| Auto Scaling 方式 | CPU 率（ECS） | CE vCPU（Batch） | **キュー深度 TargetTracking** |
| 常時稼働コスト | 最低（実行時のみ） | 中（CE 管理） | 中（最小ワーカー常時、GC-002 §6.3 制約） |
| IAM ロール数（固有） | 1 | 3（ServiceRole/ExecutionRole/JobRole） | 3（ExecutionRole 共用、TaskRole/AutoScalingRole） |
| 設計複雑度（スケーリング） | 低 | 中 | **高（キュー深度連動の設計が肝）** |
