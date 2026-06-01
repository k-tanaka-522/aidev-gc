---
artifact_id: PARAM-006
title: パターンB AWS Batch詳細パラメーターシート
version: 1.1
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
    section: "§6.2 パターンB AWS Batch / §7.2 パターン固有部"
    reason: "Batch 構成要素（CE/Job Queue/Job Definition/ECR/IAM）を継承"
  - artifact: NW-001
    title: ネットワーク基本設計書
    section: "§8.1 NWリソース差分表（パターンB）"
    reason: "Batch CE ENI/SG/ECR-Batch Endpoint の要否を継承"
  - artifact: SEC-001
    title: セキュリティ基本設計書
    section: "§4.5 batchServiceRole-B / batchJobRole-B / §9.1 セキュリティ差分（B）"
    reason: "Batch サービス/ジョブロール分離・ECR スキャン・EBS 暗号化を継承"
---

# パターンB AWS Batch 詳細パラメーターシート

## 改訂履歴

| バージョン | 更新日 | 更新者 | 変更内容 | ステータス |
|-----------|--------|--------|--------|----------|
| 1.0 | 2026-06-01 | infra-iac | 初版作成。GC-002/NW-001/SEC-001 を入力に、パターン B AWS Batch の CDK 実装入力レベルパラメーターを展開 | draft |
| 1.1 | 2026-06-01 | infra-iac | 検証指摘 C-1/H-1/H-2/M-1/M-2 対応: §11 アラーム数を実装 2 に統一（job-duration は将来拡張として注記）・§12 固有リソース種別数を C=11（最多）に修正・固有アラーム数行追加・§10 S3 バケット定義参照注記追加 | draft |

---

## 1. 凡例・環境差分

| 環境 | 主な差分点 |
|------|----------|
| dev | CE タイプ: FARGATE（EC2 不使用でパッチ管理省略）。maxvCpus=4。Logs 保持 7 日 |
| stg | CE タイプ: FARGATE。maxvCpus=8 |
| prod | CE タイプ: FARGATE（Fargate CE 推奨、SEC-001 §9.2）。maxvCpus=16。EC2 CE は大規模バッチ要件が確定した場合のみ採用 |

> **設計注**: SEC-001 §9.2 より、EC2 CE 採用時は OS/AMI/EBS パッチ管理（VN-1/VN-6）が必要。Hello World 比較検証では Fargate CE を推奨し、EC2 CE オプションのパラメーターを参考として付記する。

---

## 2. Batch Compute Environment（Fargate CE、推奨）

根拠: GC-002 §6.2

| パラメーター | 値 | dev差分 | 備考 |
|------------|-----|--------|------|
| compute_environment_name | `helloworld-tenant-A-batch-CE-fargate` | — | |
| type | `MANAGED` | — | |
| compute_resources.type | `FARGATE` | — | Fargate タスクとして実行 |
| compute_resources.max_vcpus | `16` | dev=4 / stg=8 | 最大 vCPU（Fargate の場合はタスク数制御） |
| compute_resources.subnets | Private-Batch-1a, Private-Batch-1c | — | NW-001 §4.2 |
| compute_resources.security_group_ids | sg-batch-B | — | §6 参照 |
| state | `ENABLED` | — | |
| タグ: pattern | `batch` | — | GC-002 §4.6 |
| タグ: compliance | `ismap` | — | |

### 2.1 EC2 CE パラメーター（参考・大規模バッチ要件確定時のみ）

| パラメーター | 値 | 備考 |
|------------|-----|------|
| compute_resources.type | `EC2` | |
| compute_resources.allocation_strategy | `BEST_FIT_PROGRESSIVE` | |
| compute_resources.instance_types | `["m5.large", "m5.xlarge"]` | |
| compute_resources.min_vcpus | `0` | アイドル時 0 台 |
| compute_resources.max_vcpus | `64` | |
| compute_resources.image_id | CIS Hardened AMI（SEC-001 §9 VN-6） | |
| compute_resources.launch_template.launch_template_id | 暗号化 EBS（CMK）を含む LT | |
| ec2_configuration.image_type | `ECS_AL2` | |

---

## 3. Job Queue

根拠: GC-002 §6.2

| パラメーター | 値 | dev差分 | 備考 |
|------------|-----|--------|------|
| job_queue_name | `helloworld-tenant-A-batch-queue` | — | |
| state | `ENABLED` | — | |
| priority | `100` | — | 複数キュー使用時の優先度 |
| compute_environment_order[0].compute_environment | Fargate CE ARN | — | |
| compute_environment_order[0].order | `1` | — | |
| タグ: pattern | `batch` | — | |
| タグ: compliance | `ismap` | — | |

---

## 4. Job Definition

根拠: GC-002 §6.2

| パラメーター | 値 | dev差分 | 備考 |
|------------|-----|--------|------|
| job_definition_name | `helloworld-tenant-A-batch-job` | — | |
| type | `container` | — | |
| platform_capabilities | `["FARGATE"]` | — | |
| container_properties.image | `<account-id>.dkr.ecr.ap-northeast-1.amazonaws.com/helloworld/batch-pattern-B:latest` | — | §5 ECR 参照 |
| container_properties.vcpus | `2` | dev=0.5 | Fargate 小数 vCPU 可 |
| container_properties.memory | `4096` | dev=1024 | MB 単位 |
| container_properties.job_role_arn | batchJobRole-B ARN | — | §7 参照 |
| container_properties.execution_role_arn | batchTaskExecutionRole ARN | — | ECR pull / Logs |
| container_properties.log_configuration.log_driver | `awslogs` | — | |
| container_properties.log_configuration.options.awslogs-group | `/helloworld/batch/tenant-A/pattern-B` | — | |
| container_properties.log_configuration.options.awslogs-region | `ap-northeast-1` | — | |
| container_properties.fargate_platform_configuration.platform_version | `LATEST` | — | |
| container_properties.network_configuration.assign_public_ip | `DISABLED` | — | |
| container_properties.environment | `[{TENANT_ID: A}, {S3_OUTPUT_BUCKET: helloworld-tenant-A-output}, ...]` | — | |
| retry_strategy.attempts | `3` | dev=1 | ジョブ失敗時リトライ |
| timeout.attempt_duration_seconds | `3600` | dev=300 | ジョブタイムアウト（1時間） |
| タグ: pattern | `batch` | — | |

---

## 5. ECR リポジトリ（パターン B 専用）

根拠: GC-002 §6.2 / NW-001 §8.1（B は ECR Endpoint 必須）

| パラメーター | 値 | 備考 |
|------------|-----|------|
| repository_name | `helloworld/batch-pattern-B` | パターン B 専用（公開サービスとは分離） |
| image_tag_mutability | `IMMUTABLE` | |
| scan_on_push | `true` | SEC-001 §9.1 VN-7 ECR Image Scanning 必須 |
| encryption_type | `KMS` | |
| kms_key | アプリ共通 CMK ARN | |
| タグ: pattern | `batch` | |
| タグ: compliance | `ismap` | |

---

## 6. セキュリティグループ（sg-batch-B）

根拠: SEC-001 §6.3 / NW-001 §8.1

| 方向 | プロトコル | ポート | 送信元/宛先 | 説明 |
|------|----------|-------|-----------|-----|
| In | — | — | なし | Batch ジョブはアウトバウンド処理 |
| Out | TCP | 443 | sg-vpc-endpoint | ECR / Batch / Logs / S3 / STS / Monitoring / KMS Endpoint |
| Out | TCP | 443 | S3 プレフィックスリスト | S3 Gateway Endpoint |

---

## 7. IAM ロール

根拠: SEC-001 §4.5, §9.1

### 7.1 batchServiceRole-B

| 項目 | 値 |
|-----|-----|
| ロール名 | `batchServiceRole-B-tenant-A` |
| Trusted Entity | `batch.amazonaws.com` |
| 管理ポリシー | `AWSBatchServiceRole` |
| 追加制限 | Resource は自テナント Batch 環境・キューに限定 |
| Permission Boundary | `PB-ServiceRole` |

### 7.2 batchTaskExecutionRole（ECR pull / Logs）

| 項目 | 値 |
|-----|-----|
| ロール名 | `batchTaskExecutionRole-B-tenant-A` |
| Trusted Entity | `ecs-tasks.amazonaws.com` |
| 管理ポリシー | `AmazonECSTaskExecutionRolePolicy` |
| 追加 Action | `kms:Decrypt`, `kms:DescribeKey`（ECR/Logs CMK） |
| Permission Boundary | `PB-ServiceRole` |

### 7.3 batchJobRole-B（ジョブ実行ロール）

| 項目 | 値 |
|-----|-----|
| ロール名 | `batchJobRole-B-tenant-A` |
| Trusted Entity | `ecs-tasks.amazonaws.com` |
| 許可 Action | `s3:GetObject`, `s3:PutObject`（`helloworld-tenant-A-output`）; `kms:Decrypt`, `kms:GenerateDataKey`（テナント A データ CMK）; `logs:CreateLogStream`, `logs:PutLogEvents` |
| テナント条件 | `aws:ResourceTag/tenant = A` |
| Permission Boundary | `PB-ServiceRole` |

---

## 8. EventBridge ルール（Batch トリガ）

| パラメーター | 値 | dev差分 | 備考 |
|------------|-----|--------|------|
| rule_name | `helloworld-tenant-A-pattern-B-schedule` | — | |
| schedule_expression | `cron(0 2 * * ? *)` | dev=`rate(60 minutes)` | 日次: 毎日 02:00 UTC（QA-102 仮定） |
| state | `ENABLED` | dev=`DISABLED` | |
| ターゲット | `batch:SubmitJob` API | — | |
| job_name | `helloworld-A-batch-job` | — | |
| job_queue | Job Queue ARN | — | |
| job_definition | Job Definition ARN | — | |
| タグ: pattern | `batch` | — | |

---

## 9. Batch Logs グループ

| パラメーター | 値 | dev差分 | 備考 |
|------------|-----|--------|------|
| log_group_name | `/helloworld/batch/tenant-A/pattern-B` | — | |
| retention_in_days | `90` | dev=7 / stg=30 | |
| kms_key_id | アプリ共通 CMK ARN | — | ISMAP LG-17 |

---

## 10. S3 成果物バケット（パターン B）

| パラメーター | 値 | 備考 |
|------------|-----|------|
| bucket_name | `helloworld-tenant-A-output` | パターン A/B/C で共用可（prefix 分離） |
| versioning | `enabled` | |
| encryption | SSE-KMS（テナント A データ CMK） | |
| block_public_access | 全ブロック ON | |
| タグ: pattern | `batch` | |
| タグ: compliance | `ismap` | |

> S3 バケットはパターン A と共用（`pattern-B/` prefix で分離）し、重複作成しない。
> S3 ライフサイクル設定・バージョニング詳細は **PARAM-005 §7 の共用バケット定義に従う**（M-2 対応）。

---

## 11. CloudWatch アラーム（パターン B 固有）

> 実装アラーム数: **2**（helloworld-B-batch-job-failed / helloworld-B-batch-job-pending）。
> `helloworld-B-batch-job-duration` は設計検討済みだが、カスタムメトリクス Publish 基盤（Lambda → CloudWatch）の追加実装が必要なため**将来拡張**とする（H-2 対応）。

| アラーム名 | メトリクス / 条件 | アクション | 備考 |
|---------|---------------|---------|------|
| `helloworld-B-batch-job-failed` | Batch FailedJobCount >= 1 (1 期間, 5 分) | SNS 通知 | ジョブ失敗検知 |
| `helloworld-B-batch-job-pending` | Batch PendingJobCount > 10 (1 期間, 10 分) | SNS 通知 | キュー積み残し検知 |
| `helloworld-B-batch-job-duration` | (EventBridge: BatchJobStateChange SUCCEEDED, Duration > 3600s) | SNS 通知 | **将来拡張**: 長時間ジョブ検知（カスタムメトリクス）。現行実装には含まれない |

---

## 12. 構築リソース種別数（パターン B 固有）・主要差分

| リソース種別 | 数量（1テナント） | 見積按分備考 |
|------------|---------------|-----------|
| Batch Compute Environment | 1（Fargate CE） | |
| Job Queue | 1 | |
| Job Definition | 1 | |
| ECR リポジトリ（Batch 専用） | 1 | パターン A/C との差分 |
| IAM ロール（Batch 固有） | 3（ServiceRole/ExecutionRole/JobRole） | |
| SG（sg-batch-B） | 1 | |
| EventBridge ルール | 1 | |
| CloudWatch Logs グループ | 1 | |
| CloudWatch アラーム（固有） | 2（実装）※将来拡張: job-duration | §11 注記参照 |

**パターン B 固有リソース: 9 種（12 リソース）**

### 主要差分（他パターンとの比較）

| 比較点 | パターン A | パターン B | パターン C |
|-------|---------|---------|---------|
| 固有リソース種別数 | 8 種 | 9 種 | **11 種（最多）** |
| ECR Endpoint 要否 | 不要 | **必要** | **必要** |
| Batch Endpoint 要否 | 不要 | **必要（固有）** | 不要 |
| IAM ロール数 | 1 | **3**（ServiceRole/ExecutionRole/JobRole） | 2（TaskRole/AutoScalingRole） |
| 固有アラーム数 | 4 | **2（実装）**※将来拡張: job-duration | 5 |
| 設計・構築工数（相対） | 小 | **大（最多）** | 中 |
| 常時コスト | 低（実行時のみ） | 中（CE 管理） | 中（最小ワーカー） |
| OS パッチ責務 | なし | EC2 CE 時あり | なし |

> 「最多」ラベルの整理: 固有リソース種別数は C=11 が最多、工数・実装難度は B が最大（Batch L1 実装・EC2 CE オプション対応）。
