---
artifact_id: GC-002
title: GC環境・システム全体構成 基本設計書
version: 1.0
status: draft
author: "[infra-gc-environment] (gc-environment-design)"
reviewer: ""
approved_by: ""
created_at: 2026-06-01
updated_at: 2026-06-01
phase: 4
dependencies:
  - artifact: PROF-001
    title: 案件プロファイル
    section: "§9 アーキ比較対象 / §6 ネットワーク複雑度 / §7 GC利用方式"
    reason: "共同利用・省庁級・セキュリティ高・新規構築・3パターン比較という基本条件を全体構成の前提として継承"
  - artifact: TAIL-001
    title: テーラリングレポート
    section: "§4 成果物テーラリング / §5.3 ガバクラ標準IaC制約の設計反映"
    reason: "共通部＋3パターン固有部の構造、自動適用層非上書き原則を設計方針として採用"
  - artifact: WBS-001
    title: 標準WBS
    section: "§1.2 比較見積の構造ルール"
    reason: "共通部先行確定→パターン固有並行という設計順序の前提"
---

# 共同利用ガバメントクラウド Hello World アーキ比較検証 — GC環境・システム全体構成 基本設計書

## 改訂履歴

| バージョン | 更新日 | 更新者 | 変更内容 | ステータス |
|-----------|--------|--------|--------|----------|
| 1.0 | 2026-06-01 | infra-gc-environment | 初版作成。GC環境設計（Org/SCP/テナント分離/GCAS-SSO/テンプレート3層）＋システム全体構成＋3パターン比較アーキを記載。QA-003分離粒度はVPC/タグ分離を仮採用 | draft |

---

## 目次

<!-- TOC -->
1. 概要・目的
2. 現状分析・前提整理
3. 設計方針
4. GC環境設計
5. システム全体構成設計
6. 3パターン比較アーキ設計
7. 構成要素一覧（後続設計の入力）
8. セキュリティ考慮事項
9. リスク・制限事項
10. 今後の検討事項
付録
<!-- /TOC -->

---

## 1. 概要・目的

### 1.1 背景

本案件は「同一の Spring Boot 製 Hello World ワークロードを 3 つのバッチ／非同期アーキテクチャパターンで構築し、工数・コスト・運用負荷・拡張性を見積比較する」比較検証案件である（根拠: PROF-001 §1.1）。本設計書は、その**共通の土台となる GC 環境（Organizations／テナント分離／GCAS-SSO／テンプレート3層）と、システム全体構成、3パターン比較アーキの基本設計**を定義する。

本設計書は後続の以下の詳細設計の **入力（基準）** となる。

| 後続成果物 | 本設計書から渡す内容 |
|-----------|--------------------|
| NW（ネットワーク設計） | テナントVPC CIDR、サブネット区分、TGW/LGWAN接続前提、VPC Endpoint一覧 |
| SEC（セキュリティ設計） | SCP前提、KMS CMK対象、ConMon/CSPM適用範囲、IAM/SSOロール骨子 |
| MON（監視設計） | CloudWatch/CloudTrail/Config/SecurityHub/GuardDuty 配置 |
| IaC（CDK設計） | 共通スタック＋3パターン固有スタックの境界、自動適用層非上書きの原則 |
| EST/CST（見積・コスト） | 共通部／パターン固有部の構成要素一覧（工数・利用料の積算単位） |

### 1.2 目的・スコープ

- **対象**: 共同利用方式の GC 環境（Organizations メンバーアカウント前提）におけるアカウント構成・テナント分離・GCAS-SSO/CEP 連携・テンプレート3層適用方針、ならびにオンライン（ECS Fargate public/private）＋バッチ/非同期（A/B/C 3パターン）の全体アーキテクチャ。
- **本書のレベル**: 基本設計（パラメータ詳細値・IaC実装は後続フェーズ。本書は構成要素の網羅と方針の確定に主眼）。
- **スコープ外（TAIL-001 §4.3 準拠）**: 移行計画、本格運用設計（Runbook）、DR/バックアップ目標値、外部ASP連携、業務ロジック詳細。

### 1.3 制約条件・前提条件

| # | 前提・制約 | 出所 |
|---|----------|------|
| 1 | ベンダー払い出しの GC 環境（Organizations メンバーアカウント、SCP適用済） | PROF-001 §10.2 |
| 2 | GCAS-SSO(CEP) 連携が利用可能。IAMユーザー直接発行は避ける | TAIL-001 §5.3 |
| 3 | テンプレート3層体系（自動適用／必須適用／サンプル）が存在。**自動適用層は上書きしない** | 依頼前提・TAIL-001 §5.3 |
| 4 | IaC は AWS CDK (TypeScript)。CDKは必須適用＋任意層のみ表現 | PROF-001 §1 |
| 5 | セキュリティ高（ISMAP対応、KMS CMK、DS-310準拠、ConMon/CSPM常時監視） | PROF-001 §5 |
| 6 | ネットワーク複雑（LGWAN接続＋共同利用テナント分離＋閉域） | PROF-001 §6 |
| 7 | **QA-003（テナント分離粒度）は本書では VPC／サブネット／タグ分離を初期仮採用**（アカウント分離は将来オプション） | 依頼指示・PROF-001 §3.3 |
| 8 | リージョンは ap-northeast-1（東京）を主、ap-northeast-3（大阪）をDR候補（本案件はDRスコープ外） | 仮定（QA積み） |

---

## 2. 現状分析・前提整理

### 2.1 GC利用方式（根拠: PROF-001 §7）

共同利用（省庁級）。ベンダー払い出し環境に複数自治体テナントを分離。Organizations メンバーアカウント前提・SCP制約下で、GCAS-SSO(CEP)連携が必須。`gc-account-structure` スキルの「共同利用パターン」を採用基盤とする。

### 2.2 比較対象ワークロード（根拠: PROF-001 §9）

| 区分 | 内容 | パターン展開 |
|------|------|------------|
| オンライン（パブリック） | ECS Fargate（公開）＋ALB＋WAF | 全パターン共通 |
| オンライン（プライベート） | ECS Fargate（非公開）＋内部ALB＋VPC Endpoint | 全パターン共通 |
| バッチ/非同期 | A: Lambda / B: AWS Batch / C: SQS+ECS Fargate | 3パターン並行 |

### 2.3 未確定事項（QA管理）

| QA-ID | 項目 | 本書の扱い |
|-------|------|----------|
| QA-003 | テナント分離粒度（アカウント分離 or VPC/タグ分離） | **VPC/サブネット/タグ分離で仮確定**。アカウント分離は将来オプションとして併記 |
| QA-101 | テナント数・初期/将来の規模 | 初期2テナント（A/B）＋将来N拡張を仮置き |
| QA-102 | バッチ想定ワークロード特性（頻度・処理時間・並列度） | 比較表の前提として仮定義（§6.5） |
| QA-103 | LGWAN帯域・冗長・接続先 | NW設計で仮定義（本書は接続前提のみ） |

---

## 3. 設計方針

### 3.1 基本設計原則

1. **共通部先行確定 → パターン固有部並行**（WBS-001 §1.2）。比較の公正性のため、各パターンは同一の設計テンプレート（VPC配置／IAM最小権限／監視／タグ）を用いる。
2. **自動適用層は上書きしない**（最重要）。CDK は必須適用＋任意層のみを表現する。GCAS が払い出す Log Archive / Audit / SCP / 基本ガードレールは CDK 管理外とし、参照（ImportValue / SSM Parameter）に留める。
3. **SCP許可範囲内でのみリソース定義**。リージョン制限・サービス制限を逸脱しない。
4. **全データストアを KMS CMK で暗号化**（S3/ECR/Logs/SQS/EBS等、DS-310準拠）。
5. **全リソースにタグ統制**（environment / owner / cost_center / project / compliance=ismap）。
6. **テナント分離は VPC/サブネット/タグ分離**（QA-003 仮採用）。テナント横断の共通サービス（TGW/監視/SSO）は Shared Services 側に集約。

### 3.2 デジタル庁GCAS準拠事項（テンプレート3層）

`gc-template-catalog` の3層体系に GCAS の自動適用/必須適用/サンプルをマッピングする（§4.4）。第1層（Landing Zone / Security Base / Governance）は GCAS 自動適用相当として **非上書き**、第2層（Microservices等）を必須適用としてCDKで表現、第3層（Financial/Healthcare等）は本案件では不採用（Hello Worldのため）。

---

## 4. GC環境設計

> 構成図: ![Org/テナント構成図](./diagrams/GC-003-org-tenant-structure.drawio)
> 全体構成図: ![全体構成図](./diagrams/GC-002-overall-architecture.drawio)

### 4.1 Organizations 構成（共同利用パターン）

`gc-account-structure` の共同利用パターンを採用。OU深さは2段に留める（部門/テナント < 20 を想定、保守性重視）。

```
Organization Root（運営主体）
├─ Org Policy: SCP（混合型）/ Tag Policy / Backup Policy
├─ Security OU ★GCAS自動適用層（上書き禁止）
│   ├─ Log Archive Account     … CloudTrail/Config ログ集約（CMK, S3+Glacier永続）
│   ├─ Audit/Security Account  … SecurityHub/GuardDuty 委任管理（Delegated Admin）
│   └─ Identity Account        … GCAS-SSO / IAM Identity Center（CEP）
├─ Shared Services OU
│   ├─ Network Hub Account     … Transit Gateway / Direct Connect / LGWAN接続
│   └─ Shared Tooling Account  … CDK Toolkit / 共有ECR / 共通監視ダッシュボード
└─ Tenant Workloads OU
    └─ HelloWorld 共同利用アカウント（本案件スコープ）
        ├─ テナントA VPC (10.20.0.0/16, tag:tenant=A)
        ├─ テナントB VPC (10.21.0.0/16, tag:tenant=B)
        └─ テナントN VPC (10.2x.0.0/16) … VPC/タグ分離で水平拡張
```

| Folder/OU | 責任主体 | 主な役割 |
|-----------|---------|---------|
| Security OU | 運営主体セキュリティ責任者（GCAS自動適用） | ログ集約・監査・SSO。**上書き禁止** |
| Shared Services OU | 共通基盤運用チーム | TGW/LGWAN、CDK基盤、共有ECR |
| Tenant Workloads OU | 各テナント運用＋共通基盤チーム | Hello World ワークロード（VPC分離） |

### 4.2 テナント分離方式（QA-003: VPC/タグ分離を仮採用）

| 分離軸 | 採用方式 | 補足 |
|-------|---------|------|
| ネットワーク | **テナント毎に独立VPC**（10.20/16, 10.21/16, …） | CIDR重複なし。テナント間通信は原則遮断（必要時のみTGWで明示許可） |
| リソース帰属 | **タグ分離**（tenant=A/B/N）＋命名規則 | コスト配分・運用フィルタの基軸 |
| データ | **テナント毎に S3 バケット／SQS／ECR を分離**（CMKもテナント別キー推奨） | クロステナント参照をIAM/バケットポリシーで禁止 |
| 課金トレーサビリティ | cost_center タグ ＋ Cost Allocation Tag | テナント別請求按分 |

**判断根拠**: Hello World 比較検証では、テナント数が初期2＋将来N程度で、運用は共通基盤チームに集約される。アカウント分離（テナント毎メンバーアカウント）は分離強度が最も高いが、アカウント払い出し・SCP個別適用・CDKデプロイ先増加により**比較検証の純度と工数効率を損なう**。よって本案件は VPC/タグ分離を採用し、より強い分離が要求された場合（本番移行時等）にアカウント分離へ段階移行できる構造とする（§10）。

| 比較 | VPC/タグ分離（採用） | アカウント分離（将来オプション） |
|------|--------------------|----------------------------|
| 分離強度 | 中（NW+IAM+タグ） | 高（アカウント境界＋SCP） |
| 工数 | 低（同一スタックを複製） | 高（アカウント毎セットアップ） |
| 請求分離 | タグ按分 | アカウント単位で明確 |
| ブラストradius | 中 | 小 |
| 本案件適合 | ◎（比較検証・少テナント） | △（過剰） |

### 4.3 SCP前提（混合型）

`gc-account-structure` の混合型を採用。**自動適用層が定義する基本ガードレールを前提とし、本書はテナントOUに追加適用する想定の制約を整理する**（実際のSCP適用は運営主体/GCAS側、本書は設計提示に留める）。

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "DenyOrgBreakout",
      "Effect": "Deny",
      "Action": ["organizations:LeaveOrganization", "account:CloseAccount"],
      "Resource": "*"
    },
    {
      "Sid": "DenyGuardrailTampering",
      "Effect": "Deny",
      "Action": [
        "cloudtrail:StopLogging", "cloudtrail:DeleteTrail",
        "config:StopConfigurationRecorder", "config:DeleteConfigurationRecorder",
        "guardduty:DeleteDetector", "guardduty:DisassociateFromMasterAccount",
        "securityhub:DisableSecurityHub",
        "kms:DisableKey", "kms:ScheduleKeyDeletion"
      ],
      "Resource": "*"
    },
    {
      "Sid": "DenyRegionRestriction",
      "Effect": "Deny",
      "Action": "*",
      "Resource": "*",
      "Condition": {
        "StringNotEquals": { "aws:RequestedRegion": ["ap-northeast-1", "ap-northeast-3"] }
      }
    },
    {
      "Sid": "RequireIsmapTag",
      "Effect": "Deny",
      "Action": ["ec2:RunInstances", "s3:CreateBucket", "sqs:CreateQueue", "ecr:CreateRepository"],
      "Resource": "*",
      "Condition": { "Null": { "aws:RequestTag/compliance": "true" } }
    }
  ]
}
```

> 注: `aws:RequestedRegion` のリージョン制限は許可リージョン以外を拒否（DS/運用整合）。タグ強制は代表サービス例。実運用ではTag Policyと併用する。CDKは本SCPで許可された範囲内でのみリソースを定義する。

### 4.4 テンプレート3層適用方針（GCAS自動適用とのマッピング）

| 層 | テンプレート | GCAS区分 | 本案件の扱い | CDK表現 | カスタマイズLevel |
|----|-----------|---------|------------|--------|-----------------|
| 第1層 | Landing Zone | **自動適用** | 上書き禁止（参照のみ） | × | Level1（禁止） |
| 第1層 | Security Base（IAM/KMS/ログ基盤） | **自動適用** | 上書き禁止。CMK等は委任範囲で追加 | △（任意CMKのみ） | Level1〜2 |
| 第1層 | Governance（SCP/Tag） | **自動適用** | 前提。テナント追加制約のみ提示 | × | Level1 |
| 第1層 | Network Base（VPC/ルーティング/DNS） | **必須適用** | テナントVPCはCDKで構築（CIDRは推奨範囲内） | ○ | Level2（CIDR/リージョン） |
| 第2層 | Microservices（ECS Fargate） | 必須適用 | オンラインpublic/private＋パターンB/CのFargate | ○ | Level2〜3 |
| 第2層 | （バッチ向け）Data/Job 系 | 必須適用 | パターンA(Lambda)/B(Batch)/C(SQS+Fargate) | ○ | Level3 |
| 第3層 | Financial/Healthcare 等 | 任意 | **不採用**（Hello Worldのため特殊業界要件なし） | × | — |

**適用順序（依存関係）**: Landing Zone → Security Base → Network Base → Governance（自動適用）→（CDK）Network/Microservices/Job 系。

### 4.5 GCAS-SSO / CEP 連携設計

`gc-gcas-sso` に準拠。

| 項目 | 設計方針 |
|------|---------|
| IdP | **IAM Identity Center（旧 SSO）を中核**。コーポレートIdP（Azure AD/Okta等）がある場合はSAML/OIDCでフェデレーション（パターン1/2）。本案件サンプルでは Identity Center 単体でも成立（パターン3） |
| ロール割当 | グループ→Permission Set マッピング。IAMユーザー直接発行は禁止（TAIL-001 §5.3） |
| MFA | 管理者/特権は**必須**（TOTP＋Passkey）。一般は導入後段階的に必須化（gc-gcas-sso MFA表） |
| 緊急アクセス | break-glass 管理者を別途準備（SSO障害時手順を文書化） |

**グループ ⇔ Permission Set マッピング（骨子）**:

| グループ | Permission Set | 主な権限範囲 |
|---------|----------------|------------|
| GC-Admin | OrgAdmin | Org/SCP参照、Shared/Tenant の管理（自動適用層は不可） |
| GC-Network | NetworkAdmin | Network Hub（TGW/DX/VPC）、Route53 |
| GC-Security | SecurityAdmin | Audit/Security、SecurityHub/GuardDuty/Config（読み取り＋是正） |
| GC-AppDev | TenantDeveloper | Tenant Workloads の Fargate/Lambda/Batch/SQS/ECR/S3（最小権限・テナント条件付き） |
| GC-Auditor | ReadOnlyAuditor | Org/Billing/ログの参照のみ |

**CEP 事前準備チェック（gc-gcas-sso CEPチェックリスト）**: SCP準拠、IAM Access Analyzer、VPC Flow Logs 全VPC、CloudTrail Org単位、ログS3+Glacier永続、GuardDuty/Security Hub/Config Rules 有効化 —— いずれも Security OU の自動適用層＋本設計のテナントVPC側 Flow Logs で充足する。

### 4.6 タグ統制

| タグキー | 必須 | 値の例 | 用途 |
|---------|------|-------|------|
| environment | ✓ | dev / stg / prod | 環境識別 |
| owner | ✓ | team-helloworld@example.go.jp | 責任者 |
| cost_center | ✓ | tenant-A / tenant-B / shared | コスト配分 |
| project | ✓ | helloworld-archcmp | プロジェクト |
| compliance | ✓ | ismap | コンプライアンス（SCP/Tag Policyで強制） |
| tenant | ✓（テナント資源） | A / B / N | テナント分離軸 |
| pattern | 推奨（バッチ資源） | lambda / batch / sqs-fargate | 比較対象識別（見積按分に直結） |

---

## 5. システム全体構成設計

> 全体構成図: ![全体構成図](./diagrams/GC-002-overall-architecture.drawio)

### 5.1 全体像（経路俯瞰）

```
[住民] → インターネット → CloudFront + WAF → ALB(公開) → ECS Fargate パブリックサービス
[自治体庁舎/職員] → LGWAN → DirectConnect → Transit Gateway → 内部ALB → ECS Fargate プライベートサービス
オンライン → (起動/送信) → バッチ・非同期 [A: Lambda / B: AWS Batch / C: SQS+ECS Fargate]
全リソース → VPC Endpoint 経由でAWS API（S3/ECR/Logs/SQS/Batch）へ閉域アクセス
ログ/監査 → CloudTrail/Config → Security OU(Log Archive/Audit) へ集約
```

### 5.2 テナントVPC内サブネット構成（共通テンプレート）

| サブネット | CIDR（テナントA例） | 配置リソース | 公開性 |
|-----------|-------------------|------------|-------|
| Public | 10.20.0.0/24, 10.20.1.0/24 | 公開ALB、NAT GW | インターネット公開（WAF経由） |
| Private - App | 10.20.10.0/24, 10.20.11.0/24 | ECS Fargate public/private サービス、内部ALB | 非公開 |
| Private - Batch/非同期 | 10.20.20.0/24 | **比較対象 A/B/C を配置** | 非公開 |
| Protected - Data | 10.20.30.0/24 | VPC Endpoint、データ系（S3はゲートウェイEP） | 閉域 |

> Multi-AZ（ap-northeast-1a / 1c）構成。各AZにPublic/Privateを対で配置（可用性）。詳細CIDR・ルートテーブルはNW設計（後続）で確定。

### 5.3 オンライン処理（全パターン共通の土台）

| 区分 | 経路 | 主要サービス | 構成要素 |
|------|------|------------|---------|
| パブリックサービス | 住民 → CloudFront → WAF → 公開ALB → Fargate | CloudFront, WAF, ALB, ECS Fargate, ECR | Fargateサービス/タスク定義、ターゲットグループ、SG、ACM証明書、オートスケール（CPU/リクエスト数） |
| プライベートサービス | 職員 → LGWAN → DX → TGW → 内部ALB → Fargate | 内部ALB, ECS Fargate, VPC Endpoint | 内部ALB（internal）、Private DNS、SG（庁内CIDR限定）、VPC Endpoint |

共通基盤: ECR（イメージ）、KMS CMK（暗号化）、CloudWatch（メトリクス/ログ）、CloudTrail（API監査）、Config/SecurityHub/GuardDuty（ConMon/CSPM）、GCAS-SSO、タグ統制。

### 5.4 バッチ・非同期処理（3パターンの配置）

3パターンとも **Private Subnet - Batch/非同期（10.20.20.0/24）** に配置し、VPC Endpoint 経由でAWS APIへ閉域アクセス。トリガは EventBridge（スケジュール）／オンラインFargateからの起動／S3イベントを共通の入口とする。詳細は §6。

---

## 6. 3パターン比較アーキ設計

> 比較構成図: ![3パターン比較図](./diagrams/GC-004-batch-pattern-comparison.drawio)

### 6.1 パターンA: Lambda（軽量・イベント駆動）

| 項目 | 内容 |
|------|------|
| データフロー | EventBridge（スケジュール/イベント）→ Lambda関数（VPC Lambda, ENI）→ 成果物 S3(CMK)。失敗時 → SQS DLQ |
| 採用AWSサービス | Lambda, EventBridge, SQS(DLQ), CloudWatch Logs, S3, KMS CMK, VPC Endpoint |
| 主な構成要素 | Lambda関数、実行ロール（最小権限）、EventBridgeルール、DLQ、ENI（VPC接続）、Logsグループ、予約済み同時実行数 |
| 制約 | 実行時間最大15分、メモリ/一時ストレージ上限。長時間・大規模バッチは不適 |

### 6.2 パターンB: AWS Batch（大規模・長時間バッチ）

| 項目 | 内容 |
|------|------|
| データフロー | EventBridge → Job Queue → Compute Environment（Fargate/EC2）でジョブ実行（ECRイメージ pull）→ S3(CMK)。ログ → CloudWatch |
| 採用AWSサービス | AWS Batch（Compute Environment / Job Queue / Job Definition）, ECR, EventBridge, CloudWatch Logs, S3, KMS CMK, VPC Endpoint |
| 主な構成要素 | Compute Environment、Job Queue、Job Definition、ジョブ実行ロール／サービスロール、ECRリポジトリ、起動ルール |
| 制約 | 構成要素が最多。設計・構築工数が最大級。短時間多数の小ジョブにはオーバーヘッド大 |

### 6.3 パターンC: SQS + ECS Fargate（非同期メッセージング・キュー深度連動スケール）

| 項目 | 内容 |
|------|------|
| データフロー | Producer（オンラインFargate/EventBridge）→ SQSキュー(CMK)→ ECS Fargateワーカー（ポーリング）→ S3(CMK)。再配信超過 → DLQ。キュー深度（ApproximateNumberOfMessages）連動で Application Auto Scaling が scale out/in |
| 採用AWSサービス | SQS（標準/FIFO）, DLQ, ECS Fargate（サービス/タスク定義）, Application Auto Scaling, ECR, CloudWatch Alarm, S3, KMS CMK, VPC Endpoint |
| 主な構成要素 | SQSキュー＋DLQ、ECSサービス／タスク定義、スケーリングポリシー（Target Tracking: キュー深度／メッセージ数）、CloudWatchアラーム、実行ロール |
| 制約 | スケーリング設計（メトリクス・しきい値・クールダウン）が肝。常時最小タスク維持でアイドルコストが発生し得る |

### 6.4 比較観点マトリクス（設計上の差分）

> 比較軸は REQ-002（アーキ比較評価軸定義書）で重み付けを確定する前提の**定性比較**（PROF-001 §3.3 / リスク）。

| 観点 | A: Lambda | B: AWS Batch | C: SQS+ECS Fargate |
|------|----------|--------------|-------------------|
| **性能（処理特性）** | 短時間・高頻度イベントに最適。15分制約あり。コールドスタート有 | 長時間・大規模・並列バッチに最適。起動レイテンシ大 | 中〜長時間の非同期処理に最適。ポーリング間隔依存。スループットはワーカー数で調整 |
| **コスト** | 実行時間課金。低頻度なら最安。高頻度・長時間は割高化 | ジョブ実行時のみ課金（Fargate/EC2）。アイドル0だが管理リソースあり | 常時最小タスク＋スケールでアイドルコスト発生。高負荷時は効率的 |
| **運用負荷** | 最低。サーバ管理不要、構成要素少 | 高。CE/Queue/JobDef/イメージ運用、スケーリング監視 | 中。ECSサービス＋スケーリング＋DLQ監視。コンテナ運用知識要 |
| **拡張性** | 同時実行数で自動スケール（上限・スロットリング考慮） | キュー＋CEで大規模水平拡張。バッチ並列度が高い | キュー深度連動で滑らかにスケール。バックプレッシャ制御が容易 |
| **構築工数（CDK・相対）** | 小（最小） | 大（最多の構成要素） | 中 |
| **適合ユースケース** | 軽量定期処理、イベント変換、通知 | 夜間バッチ、大量データ処理、ML前処理 | 非同期ジョブ受付、流量平準化、疎結合連携 |
| **ISMAP/共通制約** | VPC Lambda＋ENI、CMK、Logs、最小IAM | ジョブ/サービスロール分離、ECRスキャン、CMK | SQS CMK、ECS最小権限、DLQ必須、CMK |

### 6.5 比較前提（仮定ワークロード・QA-102）

| パラメータ | 仮定値 | 備考 |
|-----------|-------|------|
| 実行頻度 | 軽量: 5分毎 / バッチ: 日次 / 非同期: 不定（バースト） | REQ-002で確定 |
| 1処理時間 | 軽量: 数秒〜数十秒 / バッチ: 数十分 / 非同期: 数秒〜数分 | 同上 |
| 並列度 | 軽量: 低 / バッチ: 高 / 非同期: 中（キュー深度連動） | 同上 |

---

## 7. 構成要素一覧（後続設計の入力）

後続のNW/SEC/MON/IaC/EST設計が漏れなく拾えるよう、構成要素を区分別に列挙する。

### 7.1 共通部（1回計上）

| カテゴリ | 構成要素 |
|---------|---------|
| ネットワーク | テナントVPC（/16）、Public/Private-App/Private-Batch/Protected-Data サブネット（Multi-AZ）、IGW、NAT GW、ルートテーブル、SG/NACL、VPC Endpoint（S3 GW型、ECR/Logs/SQS/Batch/STS/SSM IF型）、TGW Attachment、DX/LGWAN接続前提 |
| 公開系 | CloudFront、WAF（Web ACL）、公開ALB、ACM証明書、Route53 |
| オンライン | ECS Cluster、Fargateサービス×2（public/private）、タスク定義、内部ALB、ターゲットグループ、Application Auto Scaling |
| コンテナ基盤 | ECR（イメージスキャン有効）、CDK Toolkit（Shared Tooling） |
| データ/暗号 | S3（CMK）、KMS CMK（共通＋テナント別）、Secrets Manager（必要時） |
| セキュリティ/監査 | IAM（SSO Permission Set）、SCP前提、CloudTrail（Org）、Config Rules、Security Hub、GuardDuty、IAM Access Analyzer、VPC Flow Logs |
| 監視 | CloudWatch（メトリクス/Logs/アラーム/ダッシュボード）、SNS（通知） |
| GC環境 | Organizations OU、GCAS-SSO(CEP)、Identity Center、タグ統制（Tag Policy） |
| アプリ | Spring Boot Hello World スケルトン（コンテナ） |

### 7.2 パターン固有部（各々独立計上）

| パターン | 固有構成要素 |
|---------|------------|
| A: Lambda | Lambda関数、実行ロール、EventBridgeルール、DLQ(SQS)、ENI(VPC)、Logsグループ、予約同時実行 |
| B: AWS Batch | Compute Environment、Job Queue、Job Definition、ジョブ/サービスロール、専用ECR、起動ルール |
| C: SQS+ECS Fargate | SQSキュー＋DLQ、ECSワーカーサービス/タスク定義、スケーリングポリシー、CloudWatchアラーム、実行ロール |

---

## 8. セキュリティ考慮事項

（SEC設計の入力。ISMAP統制との対応を明示）

| 項目 | 設計 | ISMAP対応（例） |
|------|------|----------------|
| アクセス制御 | GCAS-SSO＋最小権限Permission Set、IAMユーザー非発行、テナント条件付きロール | ISMAP アクセス制御（3.1系） |
| 暗号化 | 全データストア KMS CMK（DS-310準拠）、転送時TLS、SQS/ECR/S3/Logs CMK | ISMAP 暗号（3.x） |
| 監査ログ | CloudTrail Org単位、S3+Glacier永続、Config構成監視 | ISMAP ログ取得・保全 |
| 脅威検知 | GuardDuty、Security Hub集約、Config Rules（ConMon/CSPM常時） | ISMAP 監視・検知 |
| 境界防御 | WAF、SG最小開放、プライベートサービス閉域、VPC Endpoint | ISMAP 通信制御 |
| ガードレール | SCP（ガードレール改変・リージョン逸脱・タグ欠落を拒否）、自動適用層非上書き | ISMAP 構成管理 |

> ISMAP統制番号の具体マッピングはSEC設計書で確定（本書は対応領域の提示に留める）。

---

## 9. リスク・制限事項

| # | リスク／制限 | 対応方針 |
|---|------------|---------|
| 1 | **自動適用層をCDKが上書き**するリスク | CDKは必須適用＋任意層のみ。自動適用リソースは Import/SSM参照に限定。Phase4設計レビューで確認（TAIL-001 §7.2） |
| 2 | SCP制約によるCDKデプロイ失敗 | Phase4で許可サービス/リージョンを事前確認。リージョンは ap-northeast-1/3 に限定 |
| 3 | テナント分離粒度（QA-003）の後戻り | VPC/タグ分離で開始し、アカウント分離へ段階移行可能な構造（§4.2, §10） |
| 4 | アーキ比較評価軸未定義 | REQ-002で性能/コスト/運用/拡張性の重み付けを確定（本書は定性比較） |
| 5 | バッチ想定ワークロード未確定 | §6.5で仮定義。REQ-002/サイジングで確定 |
| 6 | 3パターン設計の粒度不揃い | 同一設計テンプレート（VPC配置/IAM/監視/タグ）を全パターン適用 |

---

## 10. 今後の検討事項

1. **テナント分離の段階移行パス**: VPC/タグ分離 →（本番要件発生時）→ アカウント分離。移行はテナント単位でメンバーアカウント払い出し→VPC/スタック複製→DNS/TGW切替の順（移行はスコープ外だが構造は確保）。
2. REQ-002 でのアーキ比較評価軸の重み付け確定 → §6.4 を定量化。
3. LGWAN具体仕様（QA-103）確定後、TGW/DXルーティングをNW設計で確定。
4. KMSキー方針（共通鍵 vs テナント別鍵）のコスト/分離トレードオフをSEC設計で確定。

---

## 付録

### A. 関連成果物・図

| ID | 種別 | パス |
|----|------|------|
| GC-002 | 本設計書 | `./GC-002_GC環境システム全体構成基本設計書.md` |
| GC-002-fig | 全体構成図 | `./diagrams/GC-002-overall-architecture.drawio` |
| GC-003-fig | Org/テナント構成図 | `./diagrams/GC-003-org-tenant-structure.drawio` |
| GC-004-fig | 3パターン比較図 | `./diagrams/GC-004-batch-pattern-comparison.drawio` |

### B. レファレンス

- デジタル庁 GC全般的ガイド（https://guide.gcas.cloud.go.jp/general/overview-explanation）
- GCAS（https://gcas.cloud.go.jp/）
- ISMAP 管理基準
- スキル: gc-account-structure / gc-template-catalog / gc-gcas-sso / drawio-diagram-generator
