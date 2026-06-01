---
artifact_id: IaC-001
title: CDK設計書（HelloWorld アーキ比較検証）
version: 1.1
status: draft
author: "[infra-iac] (iac-implementation)"
reviewer: ""
approved_by: ""
created_at: 2026-06-01
updated_at: 2026-06-01
phase: 4
dependencies:
  - artifact: PARAM-001
    title: ネットワーク詳細パラメーターシート
    reason: "VPC/SG/Endpoint/NACL/TGW Attach の CDK 実装入力"
  - artifact: PARAM-002
    title: オンライン系詳細パラメーターシート
    reason: "ECS Fargate/ALB/CloudFront/WAF/ECR の CDK 実装入力"
  - artifact: PARAM-003
    title: セキュリティ共通詳細パラメーターシート
    reason: "KMS CMK/IAM PB/Config Rules/GuardDuty/SecurityHub の CDK 実装入力"
  - artifact: PARAM-004
    title: 監視共通詳細パラメーターシート
    reason: "CloudWatch Logs/Alarm/Dashboard の CDK 実装入力"
  - artifact: PARAM-005
    title: パターンA Lambda詳細パラメーターシート
    reason: "Lambda/EventBridge/DLQ の CDK 実装入力"
  - artifact: PARAM-006
    title: パターンB AWS Batch詳細パラメーターシート
    reason: "Batch CE/Job Queue/Job Definition の CDK 実装入力"
  - artifact: PARAM-007
    title: パターンC SQS+ECS Fargate詳細パラメーターシート
    reason: "SQS/Worker ECS/Auto Scaling の CDK 実装入力"
  - artifact: GC-002
    title: GC環境・システム全体構成 基本設計書
    reason: "自動適用層非上書き原則・タグ統制・3パターン境界の前提"
---

# CDK設計書 — HelloWorld アーキ比較検証

## 改訂履歴

| バージョン | 更新日 | 更新者 | 変更内容 | ステータス |
|-----------|--------|--------|--------|----------|
| 1.0 | 2026-06-01 | infra-iac | 初版作成。PARAM-001〜007 を入力に、全スタック・Construct 設計・デプロイ手順・自動適用層非上書き担保を記載 | draft |
| 1.1 | 2026-06-01 | infra-iac | 検証指摘 C-1/H-1/H-2/M-1/M-2 対応: 付録 A にパターン固有アラームはインライン実装である旨を注記（M-1 対応） | draft |

---

## 1. 概要・目的

本書は「共同利用ガバメントクラウド Hello World アーキ比較検証」案件のIaC実装設計書である。
AWS CDK (TypeScript) を用いて PARAM-001〜007 のパラメーターシートを実装に落とし込む。

### 1.1 ツール選択根拠

| 観点 | 選択 | 根拠 |
|------|------|------|
| IaC ツール | AWS CDK (TypeScript) | PROF-001 §1 案件確定。型安全・cdk-nag統合・テスト容易性 |
| 言語 | TypeScript | チーム標準 + CDK L2/L3 活用 |
| CDK バージョン | v2 (aws-cdk-lib ^2.133.0) | 安定版 LTS |
| Policy as Code | cdk-nag (AwsSolutionsChecks) | synth 時にセキュリティルール自動検査 |

---

## 2. スタック分割方針

### 2.1 スタック一覧

```
HelloWorldApp
├── SecurityStack          # KMS CMK / IAM PB / Config / GuardDuty / SecurityHub
├── NetworkStack           # VPC / Subnet / RT / IGW / NAT / TGW Attach / VPC Endpoint / SG / NACL / Flow Logs
├── OnlineStack            # ECR / ECS Cluster+Service(public/private) / ALB(公開/内部) / Route53 PHZ
├── WafRegionalStack       # WAF Web ACL (REGIONAL, ap-northeast-1) — ALB 用
├── WafCloudFrontStack     # WAF Web ACL (CLOUDFRONT, us-east-1) + CloudFront Distribution
├── MonitoringStack        # CW Logs / Alarms / Dashboard / SNS Topics
├── PatternALambdaStack    # Lambda / EventBridge / DLQ(SQS) / S3 / Alarms
├── PatternBBatchStack     # Batch CE / Job Queue / Job Definition / ECR(B) / Alarms
└── PatternCSqsFargateStack# SQS / DLQ / ECR(C) / ECS Worker / Auto Scaling / Alarms
```

### 2.2 スタック間依存関係

```
SecurityStack ──────────────────────┐
      ↓ (CMK ARN → SSM)             │
NetworkStack                         │ (全スタックが CMK / SG 参照)
      ↓ (VPC ID / Subnet IDs)       │
OnlineStack ────────────────────────┤
WafRegionalStack ────────────────────┤
WafCloudFrontStack ─────────────────┤
MonitoringStack ─────────────────────┤
PatternALambdaStack ─────────────────┤
PatternBBatchStack ──────────────────┤
PatternCSqsFargateStack ─────────────┘
```

### 2.3 スタック分割基準

| 分割基準 | 説明 |
|---------|------|
| リージョン境界 | WafCloudFrontStack は us-east-1（CloudFront WAF 制約）。他は ap-northeast-1 |
| 変更頻度 | セキュリティ/ネットワーク（低頻度）とアプリ/パターン（高頻度）を分離 |
| パターン選択 | `-c pattern=A|B|C` でパターン固有スタックのみデプロイ可能 |
| 自動適用層境界 | 自動適用層リソースは SecurityStack/NetworkStack で Import/SSM 参照のみ |

---

## 3. Construct 設計

### 3.1 Construct 階層

```
L2/L3 標準 Construct（CDK 標準）
  ├── aws-ec2: Vpc, SecurityGroup, CfnTransitGatewayAttachment
  ├── aws-ecs: Cluster, FargateTaskDefinition, FargateService
  ├── aws-elasticloadbalancingv2: ApplicationLoadBalancer, ApplicationListener
  ├── aws-cloudfront: Distribution, CfnWebACL (WAFv2 は L1 使用)
  ├── aws-kms: Key, Alias
  ├── aws-iam: Role, ManagedPolicy, PermissionsBoundary
  ├── aws-lambda: Function
  ├── aws-batch: CfnComputeEnvironment, CfnJobQueue, CfnJobDefinition (L1)
  ├── aws-sqs: Queue
  ├── aws-ecr: Repository
  ├── aws-s3: Bucket
  ├── aws-cloudwatch: Alarm, Dashboard
  └── aws-sns: Topic

カスタム Construct（lib/constructs/）
  ├── HelloWorldVpcConstruct       # VPC + Subnet + RT + IGW + NAT + Flow Logs
  ├── VpcEndpointConstruct         # Interface/Gateway VPC Endpoint 一括作成
  ├── HelloWorldSecurityGroupConstruct # 全 SG を一括定義
  ├── HelloWorldKmsConstruct       # テナント別 CMK + アプリ共通 CMK
  └── HelloWorldAlarmConstruct     # 共通アラーム設定ファクトリ
```

### 3.2 L1 使用箇所と理由

| リソース | Construct レベル | 理由 |
|---------|----------------|------|
| AWS Batch (CE/JQ/JD) | L1 (CfnXxx) | CDK に安定 L2 が存在しない（PARAM-006 Phase3 注意） |
| WAFv2 Web ACL | L1 (CfnWebACL) | WAFv2 の L2 は aws-wafv2 に存在しない |
| TGW Attachment | L1 (CfnTransitGatewayAttachment) | TGW は通常 L1 |
| NACL Rules | L1 (CfnNetworkAclEntry) | 細かいルール番号制御が必要 |

---

## 4. パラメーター管理

### 4.1 3層管理方式

```
cdk.json#context.<env>   ← 環境差分値（dev/stg/prod の主要数値）
      ↓
lib/common/config.ts     ← 型定義・バリデーション・Context 読み込みロジック
      ↓
各 Stack コンストラクタ   ← EnvConfig を受け取り実装
```

### 4.2 -c オプションによるパターン選択

```bash
# 全スタックデプロイ（共通 + 全パターン）
cdk deploy --all -c environment=prod

# パターン A のみデプロイ
cdk deploy --all -c environment=prod -c pattern=A

# パターン選択ロジック（bin/app.ts）
const batchPattern = loadBatchPattern(app);  // undefined = 全スタック
if (!batchPattern || batchPattern === 'A') {
  new PatternALambdaStack(app, ...);
}
if (!batchPattern || batchPattern === 'B') {
  new PatternBBatchStack(app, ...);
}
if (!batchPattern || batchPattern === 'C') {
  new PatternCSqsFargateStack(app, ...);
}
```

### 4.3 SSM Parameter Store（自動適用層 → テナント層の参照渡し）

| SSM パス | 方向 | 内容 |
|---------|------|------|
| `/helloworld/network/tgw-id` | 自動適用層 → CDK 参照 | TGW ID（PARAM-001 §7） |
| `/helloworld/network/hub-vpc-id` | 自動適用層 → CDK 参照 | Hub VPC ID |
| `/helloworld/security/log-archive-bucket` | 自動適用層 → CDK 参照 | Log Archive S3 |
| `/helloworld/security/app-common-cmk-arn` | SecurityStack 出力 → 他スタック参照 | アプリ共通 CMK ARN |
| `/helloworld/tenant-A/sqs-queue-url` | PatternCStack 出力 → Worker 参照 | SQS URL（PARAM-007 §5.1 環境変数） |

---

## 5. 環境分離

### 5.1 環境別設定差分（cdk.json Context 値）

| 設定項目 | dev | stg | prod |
|---------|-----|-----|------|
| natGateways | 1 | 2 | 2 |
| flowLogsRetentionDays | 7 | 30 | 90 |
| logsRetentionDays | 7 | 30 | 90 |
| ecsDesiredCount | 1 | 1 | 2 |
| ecsCpu | 256 | 512 | 512 |
| ecsMemory | 512 | 1024 | 1024 |
| albDeletionProtection | false | false | true |
| wafMode | count | block | block |
| tgwAttach | false | false | true |
| enableAutoScaling | false | true | true |

### 5.2 リージョン制約

| スタック | リージョン | 理由 |
|---------|----------|------|
| WafCloudFrontStack | us-east-1 | CloudFront WAF (scope=CLOUDFRONT) は us-east-1 必須（PARAM-002 §8.1） |
| 他全スタック | ap-northeast-1 | ガバクラ標準リージョン |

---

## 6. 自動適用層非上書き担保

### 6.1 原則

GC テンプレート体系（自動適用層 / 必須適用層 / サンプル）のうち、**自動適用層が作成したリソースをCDKが上書き・変更・削除することを一切禁止する**（根拠: GC-002 §1.3 制約3 / gc-iac-best-practices §1）。

### 6.2 担保手段

| 手段 | 実装 |
|------|------|
| SSM 参照のみ | 自動適用層リソースは `ssm.StringParameter.valueForStringParameter()` で参照のみ（lib/common/ssm-refs.ts） |
| CDK で作成しない | CloudTrail Org Trail / Config Recorder / GuardDuty Org 有効化 / SecurityHub 委任管理は CDK スタックに含めない |
| cdk-nag | AwsSolutionsChecks で IAM/Security 違反を synth 時に検出 |
| NACL の default VPC ルール | デフォルト NACL を変更せず、専用 NACL を作成してサブネットに関連付ける |
| アカウントレベル設定 | Account-level の GuardDuty 有効化・SecurityHub 集約は Security OU 自動適用層の責務。CDK は `GuardDuty: enabled = true` 前提の参照設定のみ |

### 6.3 cdk-nag 統合

```typescript
// 全スタックに適用（bin/app.ts）
import { Aspects } from 'aws-cdk-lib';
import { AwsSolutionsChecks } from 'cdk-nag';

Aspects.of(app).add(new AwsSolutionsChecks({ verbose: true }));
```

主要チェックルール:
- `AwsSolutions-IAM4`: AWS マネージドポリシーの過剰権限
- `AwsSolutions-IAM5`: ワイルドカードアクション
- `AwsSolutions-EC23`: SG のインバウンド全開放
- `AwsSolutions-ECS4`: Container Insights 有効
- `AwsSolutions-S1`: S3 アクセスログ
- `AwsSolutions-KMS5`: KMS Key Rotation

---

## 7. デプロイ手順

### 7.1 初回デプロイ（Bootstrap）

```bash
# CDK Bootstrap（初回のみ、アカウント・リージョンごと）
npx cdk bootstrap aws://<account-id>/ap-northeast-1
npx cdk bootstrap aws://<account-id>/us-east-1  # WafCloudFrontStack 用

# 依存関係インストール
cd samples/共通基盤HelloWorld_v1/060_IaC/cdk
npm install
```

### 7.2 通常デプロイ

```bash
# synth（テンプレート生成・cdk-nag チェック）
npm run synth -- -c environment=dev

# diff（変更確認）
npm run diff -- -c environment=dev

# dev 全スタックデプロイ
npm run deploy:dev

# prod 特定パターン
cdk deploy -c environment=prod -c pattern=A \
  "HelloWorld-prod-SecurityStack" \
  "HelloWorld-prod-NetworkStack" \
  "HelloWorld-prod-PatternALambdaStack"
```

### 7.3 デプロイ順序（依存関係）

```
1. SecurityStack        （CMK作成・SSM出力）
2. NetworkStack         （VPC/SG作成・SecurityStack参照）
3. OnlineStack          （ECS/ALB作成・Network参照）
4. WafRegionalStack     （ALB WAF・Network参照）
5. WafCloudFrontStack   （CloudFront+WAF、us-east-1）
6. MonitoringStack      （Alarm/Dashboard・全スタック参照）
7. PatternXxxStack      （パターン固有・全共通スタック参照）
```

### 7.4 ロールバック

| 手順 | コマンド | 注意 |
|------|---------|------|
| CDK ロールバック | `cdk deploy --rollback` | CloudFormation ロールバック |
| 手動ロールバック | AWS Console の CloudFormation スタックで「ロールバック」 | stateful リソース（S3/SQS）は手動確認 |
| ドリフト検知 | `cdk diff -c environment=prod` | 手作業変更を確認 |

---

## 8. タグ統制

### 8.1 必須タグ 7 キー（GC-002 §4.6）

| タグキー | 値（例） | 付与方法 |
|---------|---------|---------|
| environment | dev / stg / prod | `applyTags()` ヘルパー |
| owner | team-helloworld@example.go.jp | 固定値 |
| cost_center | tenant-A | テナント ID から自動生成 |
| project | helloworld-archcmp | 固定値 |
| tenant | A / B | コンテキスト値 |
| compliance | ismap | 固定値（SCP 必須） |
| pattern | lambda / batch / sqs-fargate / common | パターン識別 |

### 8.2 適用実装

```typescript
// 各 Stack constructor の末尾で呼び出す
import { applyTags } from '../common/tags';

applyTags(this, env, config.tenantId, 'A'); // パターン A の場合
applyTags(this, env, config.tenantId);       // 共通スタックの場合（pattern='common'）
```

---

## 9. CI/CD パイプライン

### 9.1 GitHub Actions フロー

```
PR → synth + cdk-nag チェック → diff コメント投稿 → レビュー承認
main マージ → deploy dev（自動）→ deploy stg（自動）→ deploy prod（Manual Approval）
```

### 9.2 主要チェック

- `npm run build`: TypeScript コンパイル
- `npm test`: Jest アサーションテスト
- `cdk synth`: テンプレート生成 + cdk-nag
- `cdk diff`: 変更差分

---

## 10. ドリフト検知

| 項目 | 内容 |
|------|------|
| 検知方式 | CloudFormation Drift Detection（日次 EventBridge スケジュール） |
| 通知先 | SNS `helloworld-security-alerts`（PARAM-003 §10） |
| 修復方針 | `cdk diff` で確認 → PR 経由で `cdk deploy` |

---

## 付録A. ファイル構成

```
060_IaC/cdk/
├── bin/app.ts                          # App エントリポイント。スタック登録・パターン選択
├── lib/
│   ├── common/
│   │   ├── config.ts                   # 型定義・Context 読み込み（既存）
│   │   ├── tags.ts                     # タグ 7 キーヘルパー（既存）
│   │   └── ssm-refs.ts                 # 自動適用層 SSM 参照ヘルパー（既存）
│   ├── constructs/
│   │   ├── vpc.ts                      # HelloWorldVpcConstruct（PARAM-001 §2〜8）
│   │   ├── vpc-endpoints.ts            # VpcEndpointConstruct（PARAM-001 §9）
│   │   ├── security-groups.ts          # HelloWorldSecurityGroupConstruct（PARAM-001 §10）
│   │   ├── kms.ts                      # HelloWorldKmsConstruct（PARAM-003 §2）
│   │   └── alarms.ts                   # HelloWorldAlarmConstruct（PARAM-004 §4 共通アラーム設定ファクトリ）
│   │                                   # ※パターン固有アラーム（A: 4件/B: 2件/C: 5件）は各 pattern-x-xxx-stack.ts 内にインライン実装。alarms.ts は共通監視アラームのみ
│   └── stacks/
│       ├── security-stack.ts           # PARAM-003
│       ├── network-stack.ts            # PARAM-001
│       ├── online-stack.ts             # PARAM-002（ECR/ECS/ALB/Route53）
│       ├── waf-regional-stack.ts       # PARAM-002 §8.2（ALB WAF, ap-northeast-1）
│       ├── waf-cloudfront-stack.ts     # PARAM-002 §7〜8.1（CF+WAF, us-east-1）
│       ├── monitoring-stack.ts         # PARAM-004
│       ├── pattern-a-lambda-stack.ts   # PARAM-005
│       ├── pattern-b-batch-stack.ts    # PARAM-006
│       └── pattern-c-sqs-fargate-stack.ts # PARAM-007
├── test/
│   ├── network-stack.test.ts
│   ├── security-stack.test.ts
│   └── pattern-stacks.test.ts
├── cdk.json                            # Context・環境設定（既存）
├── package.json                        # 依存パッケージ（既存）
├── tsconfig.json                       # TypeScript 設定（既存）
└── README.md
```

---

## 付録B. Phase3 引き継ぎ注意点

| 項目 | 注意内容 | 対応スタック |
|------|---------|------------|
| Batch Fargate CE は L1 使用 | `aws-batch` に安定 L2 なし。`CfnComputeEnvironment` で実装 | PatternBBatchStack |
| SQS 深度連動スケール | `ApproximateNumberOfMessages / RunningTaskCount` のカスタムメトリクス Publish が必要 | PatternCSqsFargateStack |
| WAF us-east-1 分離 | WafCloudFrontStack は `env: {region: 'us-east-1'}` で別リージョンスタック | WafCloudFrontStack |
| Lambda LogGroup 先行作成 | Lambda 自動作成前に CDK で LogGroup を作成し KMS 設定（PARAM-005 §2.3） | PatternALambdaStack |
| cdk-nag 抑制 | L1 Batch/WAF リソースでルール未対応の警告が出る場合は `NagSuppressions` で根拠明記の上 Suppress | 各 Pattern スタック |
| TGW Attachment は prod のみ | `config.tgwAttach` フラグで条件分岐。dev/stg は Attachment リソース作成しない | NetworkStack |
