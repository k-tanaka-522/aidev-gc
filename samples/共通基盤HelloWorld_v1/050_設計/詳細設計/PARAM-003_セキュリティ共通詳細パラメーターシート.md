---
artifact_id: PARAM-003
title: セキュリティ共通詳細パラメーターシート（KMS CMK / IAM / GuardDuty / SecurityHub / Config / CloudTrail）
version: 1.0
status: draft
author: "[infra-iac] (iac-implementation)"
reviewer: ""
approved_by: ""
created_at: 2026-06-01
updated_at: 2026-06-01
phase: 4
dependencies:
  - artifact: SEC-001
    title: セキュリティ基本設計書
    section: "§4 IAM設計 / §5 KMS/暗号化 / §7 ConMon/CSPM"
    reason: "KMS CMK・IAMロール/Permission Boundary・Config Rules・GuardDuty・SecurityHub 各設計の具体値を継承"
  - artifact: GC-002
    title: GC環境・システム全体構成 基本設計書
    section: "§4.3 SCP / §4.5 GCAS-SSO / §4.6 タグ統制"
    reason: "SCP骨子・タグ統制規約を継承"
---

# セキュリティ共通詳細パラメーターシート

## 改訂履歴

| バージョン | 更新日 | 更新者 | 変更内容 | ステータス |
|-----------|--------|--------|--------|----------|
| 1.0 | 2026-06-01 | infra-iac | 初版作成。SEC-001 基本設計書を CDK 実装入力レベルのパラメーターシートに展開 | draft |

---

## 1. 凡例・環境差分の考え方

| 環境 | 主な差分点 |
|------|----------|
| dev | Config Rules は 一部 Count モード / 通知のみ。GuardDuty Findings は通知のみ |
| stg | Config Rules 有効（自動修復は限定）。GuardDuty 有効 |
| prod | 全設定フル。Config 自動修復（明確な項目のみ）。GuardDuty High Severity 通知即時 |

> 自動適用層（Security Base: CloudTrail Org Trail / Config Recorder / GuardDuty Org 有効化 / SecurityHub 委任管理）は CDK 管理外。本シートはテナント Workloads 側で追加する統制のみを対象とする。

---

## 2. KMS CMK

根拠: SEC-001 §5.2, §5.3

### 2.1 テナント別データ CMK（テナント A / B 各々）

| パラメーター | テナント A | テナント B | dev差分 | 備考 |
|------------|----------|----------|--------|------|
| alias | `alias/helloworld-tenant-A-data` | `alias/helloworld-tenant-B-data` | — | |
| description | `Tenant A data CMK for S3/SQS/EBS` | 同左（B） | — | |
| key_usage | `ENCRYPT_DECRYPT` | 同左 | — | |
| key_spec | `SYMMETRIC_DEFAULT` | 同左 | — | AES-256 |
| enable_key_rotation | `true` | 同左 | — | 年1回自動ローテーション |
| multi_region | `false` | 同左 | — | QA-107: 単一 Region 基本 |
| pending_window_in_days | `30` | 同左 | — | ScheduleDeletion 待機期間 |
| key_policy | テナント A サービスロールのみ kms:Decrypt 許可（SEC-001 §5.4 キーポリシー JSON） | B 用同等 | — | DenyCrossTenant 込み |
| タグ: tenant | `A` | `B` | — | |
| タグ: compliance | `ismap` | 同左 | — | |
| タグ: cost_center | `tenant-A` | `tenant-B` | — | |

### 2.2 アプリ共通 CMK（テナント横断のアプリ層）

| パラメーター | 値 | dev差分 | 備考 |
|------------|-----|--------|------|
| alias | `alias/helloworld-app-common` | — | ECR / Logs / Lambda 環境変数 / Secrets |
| description | `App common CMK for ECR/Logs/Lambda` | — | |
| key_usage | `ENCRYPT_DECRYPT` | — | |
| key_spec | `SYMMETRIC_DEFAULT` | — | |
| enable_key_rotation | `true` | — | |
| multi_region | `false` | — | |
| key_policy | ecsTaskExecutionRole / lambdaExecRole-A / batchJobRole-B / ecsTaskRole-worker-C + autoScalingRole-C に kms:Decrypt 許可 | — | |
| タグ: compliance | `ismap` | — | |

---

## 3. IAM Permission Boundary

根拠: SEC-001 §4.3

| Boundary 名 | 対象ロール | 主な Deny |
|------------|----------|---------|
| `PB-Admin` | OrgAdmin | IAM/Org 破壊系・ガードレール改変 |
| `PB-Network` | NetworkAdmin | データ削除・IAM 変更 |
| `PB-Security` | SecurityAdmin | CloudTrail/Config 停止 |
| `PB-Developer` | TenantDeveloper | IAM/KMS/Org/破壊系 |
| `PB-ReadOnly` | ReadOnlyAuditor | 全 Write 系 |
| `PB-ServiceRole` | サービスロール全般 | IAM/Org/KMS 管理・ガードレール改変 |

> Permission Boundary JSON の詳細は SEC-001 §4.3 参照。CDK ではポリシーをマネージドポリシーとして作成し、`permissionsBoundary` プロパティでロールにアタッチする。

---

## 4. IAM ロール骨子（CDK 定義スコープ）

根拠: SEC-001 §4.2, §4.5

> ecsTaskExecutionRole / ecsTaskRole-online は PARAM-002 §10 参照。
> パターン固有ロール（lambdaExecRole-A / batchServiceRole-B / batchJobRole-B / ecsTaskRole-worker-C / autoScalingRole-C）は PARAM-005/006/007 参照。

### 共通サービスロール設定方針

| 項目 | 方針 |
|-----|------|
| Trusted Entity | `ecs-tasks.amazonaws.com` / `lambda.amazonaws.com` / `batch.amazonaws.com` 等サービス別 |
| インラインポリシー | 使用禁止（Config Rule: `iam-inline-policy-blocked`）。管理ポリシーをアタッチ |
| Permission Boundary | 全ワークロードロールに `PB-ServiceRole` をアタッチ |
| 最小権限 | Action は具体的なサービス操作のみ。Resource は自テナント ARN / タグ条件で限定 |
| 命名規則 | `<role-type>-<pattern>-tenant-<T>` 形式（例: `ecsTaskRole-worker-C-tenant-A`） |

---

## 5. Config Rules

根拠: SEC-001 §7.2

### 5.1 適用 Config Rules（テナント Workloads 側）

| グループ | ルール名 | 修復アクション | 重要度 | ISMAP |
|---------|---------|--------------|-------|-------|
| IAM | `iam-policy-no-statements-with-admin-access` | 通知のみ | HIGH | AC-2 |
| IAM | `iam-inline-policy-blocked` | 通知のみ | HIGH | AC-2 |
| IAM | `mfa-enabled-for-iam-console-access` | 通知のみ | HIGH | AC-3 |
| IAM | `access-keys-rotated` (maxAccessKeyAge=90) | 通知のみ | MEDIUM | AC-15 |
| NW | `ec2-security-group-audit` (0.0.0.0/0 Inbound) | 通知のみ | HIGH | NW-3 |
| NW | `vpc-flow-logs-enabled` | 通知のみ | HIGH | LG-7 |
| NW | `restricted-ssh` | **自動修復 (SG ルール削除)** | HIGH | NW-3 |
| NW | `vpc-endpoint-service-enabled` (s3, ecr.api 等) | 通知のみ | MEDIUM | NW-9 |
| Storage | `s3-bucket-public-read-prohibited` | **自動修復 (Block Public Access)** | HIGH | CR-2 |
| Storage | `s3-bucket-public-write-prohibited` | **自動修復** | HIGH | CR-2 |
| Storage | `s3-bucket-server-side-encryption-enabled` | 通知のみ | HIGH | CR-2 |
| Storage | `s3-bucket-versioning-enabled` | 通知のみ | MEDIUM | CR-4 |
| Storage | `encrypted-volumes` | 通知のみ | HIGH | CR-2 |
| Logging | `cloudtrail-enabled` | 通知のみ | HIGH | LG-1 |
| Logging | `cloudtrail-log-file-validation-enabled` | 通知のみ | HIGH | LG-4 |
| Logging | `multi-region-cloudtrail-enabled` | 通知のみ | HIGH | LG-13 |
| Logging | `cloudwatch-log-group-encrypted` | 通知のみ | HIGH | LG-17 |

> dev 環境では auto-remediation を全て無効にし通知のみ。prod では SSH 制限・S3 公開 Block の自動修復を有効化（誤修復リスクが低い項目のみ）。QA-110 に基づく判断。

### 5.2 Config 記録対象リソースタイプ

| 設定 | 値 | 備考 |
|-----|-----|------|
| recording_group | `allSupported = true` | |
| recording_frequency | `CONTINUOUS` | |
| delivery_channel (S3) | 自動適用層 Log Archive S3 | Import 参照 |

---

## 6. GuardDuty

根拠: SEC-001 §7.4

> Org 有効化・委任管理（Delegated Admin）は Security OU 自動適用層が担う（CDK 管理外、Import/SSM 参照）。本シートはテナント側 Findings 自動応答方針のパラメーターを定義する。

### 6.1 GuardDuty 機能設定（本アカウントで有効化済み前提）

| 機能 | 有効 | 備考 |
|-----|------|------|
| S3 Protection | `true` | S3 への異常アクセス検知 |
| EKS Protection | `false` | EKS 使用しないため |
| Lambda Protection | `true` | パターン A Lambda 異常挙動 |
| Malware Protection | `true` | EC2 / ECS タスク |
| RDS Protection | `false` | RDS 使用しないため |
| Runtime Monitoring (ECS) | `true` | パターン B/C Fargate ランタイム |

### 6.2 Findings 自動応答（EventBridge + SNS）

| パラメーター | 値 | 備考 |
|------------|-----|------|
| EventBridge ルール名 | `helloworld-guardduty-high-severity` | |
| イベントパターン | GuardDuty Finding severity >= 7.0 | HIGH 以上 |
| ターゲット | SNS トピック `helloworld-security-alerts` | |
| SNS サブスクリプション | セキュリティチームメール / Slack Webhook | |

> 自動隔離（SG 遮断）は dev/stg では無効。prod 移行時に承認の上で有効化（QA-110）。

---

## 7. SecurityHub

根拠: SEC-001 §7.4

> Delegated Admin / Org 集約は自動適用層。本シートはテナント側 Standards 適用設定。

| 設定項目 | 値 | 備考 |
|---------|-----|------|
| AWS Foundational Security Best Practices | `enabled` | FSBP v1.0 |
| CIS AWS Foundations Benchmark | `enabled` | CIS v1.4 |
| NIST SP 800-53 | `disabled` | 将来検討（§13 SEC-001） |
| Suppression ルール | 検証環境ノイズ除去（GuardDuty dev 誤検知等） | 運用設計で詳細化 |

---

## 8. IAM Access Analyzer

根拠: SEC-001 §7.3

| パラメーター | 値 | 備考 |
|------------|-----|------|
| analyzer_name | `helloworld-access-analyzer` | |
| analyzer_type | `ACCOUNT` | Org Analyzer は自動適用層 |
| 分析対象 | S3 / IAM Role / KMS / SQS / Lambda | |
| 実行頻度 | 継続的（自動）+ 週次レビュー | SEC-001 §6.5 |

---

## 9. CloudTrail（テナント追加設定）

根拠: SEC-001 §7.1

> Org Trail は自動適用層（Log Archive へ集約）。本シートはテナント側でデータイベントを追加する場合のパラメーター。

| パラメーター | 値 | dev差分 | 備考 |
|------------|-----|--------|------|
| データイベント (S3) | `s3:PutObject`, `s3:GetObject`（テナントバケット） | dev=無効（コスト） | 必要時のみ有効化 |
| データイベント (Lambda) | `lambda:InvokeFunction`（パターン A Lambda） | dev=無効 | 必要時のみ有効化 |
| log_group | 自動適用層 Log Archive S3 へ集約（CDK は定義しない） | — | Import 参照 |

---

## 10. SNS トピック（セキュリティアラート）

| パラメーター | 値 | 備考 |
|------------|-----|------|
| topic_name | `helloworld-security-alerts` | |
| encryption | CMK（アプリ共通） | |
| サブスクリプション | メール（セキュリティチーム） | |
| kms_master_key_id | アプリ共通 CMK ARN | |

---

## 11. 構築リソース種別数サマリ（セキュリティ共通部）

| リソース種別 | 数量 | 見積按分備考 |
|------------|------|-----------|
| KMS CMK（テナント別データ） | 2（テナント A/B） | テナント数分 |
| KMS CMK（アプリ共通） | 1 | 全体共通 |
| IAM Permission Boundary ポリシー | 6 | 全体共通 |
| IAM Permission Set（GCAS-SSO） | 5 | 全体共通 |
| Config Rules | 17 | 全体共通 |
| GuardDuty 追加機能設定 | 5 機能 | 全体共通 |
| EventBridge ルール（GuardDuty 応答） | 1 | 全体共通 |
| SNS トピック（セキュリティアラート） | 1 | 全体共通 |
| SecurityHub Standards 設定 | 2（FSBP/CIS） | 全体共通 |
| IAM Access Analyzer | 1 | 全体共通 |

**合計: セキュリティ共通リソース種別 約 10 種（CDK 管理分）**
> 自動適用層（CloudTrail Org Trail / Config Recorder / GuardDuty Org / SecurityHub 委任）は CDK 管理外、Import/SSM 参照のみ。
