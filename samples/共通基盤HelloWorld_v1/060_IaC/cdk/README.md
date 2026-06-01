# HelloWorld Architecture Comparison CDK App

共通基盤 HelloWorld アーキテクチャ比較サンプル の AWS CDK (TypeScript) 実装です。  
PARAM-001〜007 のパラメーターシートを CDK コードに落とし込んだ、デプロイ可能なスケルトンです。

**設計書:** `../CDK設計書.md`  
**作成日:** 2026-06-01  
**対応ツール:** AWS CDK v2 (aws-cdk-lib ^2.133.0)

---

## 前提条件

| 要件 | バージョン |
|------|-----------|
| Node.js | v20 以上 |
| AWS CDK CLI | ^2.133.0 |
| TypeScript | ^5.4.2 |
| AWS 認証情報 | 設定済みプロファイル |

```bash
npm install -g aws-cdk
npm install
```

---

## ディレクトリ構成

```
cdk/
├── bin/
│   └── app.ts                      # CDK App エントリポイント
├── lib/
│   ├── common/
│   │   ├── config.ts               # 環境別設定型定義・ローダー
│   │   ├── tags.ts                 # タグ統制 7 キーヘルパー
│   │   └── ssm-refs.ts             # 自動適用層 SSM 参照ヘルパー
│   ├── constructs/
│   │   ├── kms.ts                  # KMS CMK x2 (tenant-data / app-common)
│   │   ├── vpc.ts                  # VPC / Subnet(10) / RT(6) / IGW / NAT GW
│   │   ├── security-groups.ts      # SG x9
│   │   └── vpc-endpoints.ts        # S3 Gateway + Interface x11
│   └── stacks/
│       ├── security-stack.ts       # KMS / Permission Boundary / GuardDuty / Config
│       ├── network-stack.ts        # VPC / SG / VPC Endpoint / NACL / Route53 PHZ
│       ├── online-stack.ts         # ECS Fargate / ALB (public+internal) / ECR
│       ├── waf-regional-stack.ts   # WAF REGIONAL (ap-northeast-1)
│       ├── waf-cloudfront-stack.ts # WAF CLOUDFRONT + CloudFront (us-east-1)
│       ├── monitoring-stack.ts     # CloudWatch Alarms / Dashboard / SNS
│       ├── pattern-a-lambda-stack.ts   # Pattern A: Lambda
│       ├── pattern-b-batch-stack.ts    # Pattern B: AWS Batch
│       └── pattern-c-sqs-fargate-stack.ts  # Pattern C: SQS + ECS Fargate
├── test/
│   ├── network-stack.test.ts       # VPC / SG / NACL / PHZ テスト
│   ├── security-stack.test.ts      # KMS / IAM / GuardDuty / Config テスト
│   └── pattern-stacks.test.ts      # Pattern A/B/C テスト
├── cdk.json                        # Context 定義（環境別設定）
├── package.json
├── tsconfig.json
└── README.md                       # 本ファイル
```

---

## スタック構成と依存関係

```
SecurityStack
    └──> NetworkStack
              └──> OnlineStack
              │         └──> WafRegionalStack (assoc)
              │         └──> MonitoringStack
              │         └──> PatternALambdaStack
              │         └──> PatternBBatchStack
              │         └──> PatternCSqsFargateStack
              └──> WafCloudFrontStack (us-east-1, 別スタック)
```

全スタックのデプロイ順序は `bin/app.ts` の `addDependency()` で制御しています。

---

## 環境切り替え

`-c environment=<dev|stg|prod>` で環境を選択します（デフォルト: dev）。  
環境別設定は `cdk.json` の `context.<env>` セクションに定義されています。

| パラメーター | dev | stg | prod |
|-------------|-----|-----|------|
| NAT GW 数 | 1 | 2 | 2 |
| ECS desiredCount | 1 | 2 | 3 |
| ECS CPU | 256 | 512 | 512 |
| ALB 削除保護 | false | false | true |
| WAF モード | count | block | block |
| TGW アタッチ | false | false | true |
| Auto Scaling | false | true | true |

---

## パターン切り替え

`-c pattern=A|B|C` でアプリケーションパターンを選択します。  
未指定の場合は全パターンスタックをデプロイします。

| パターン | 説明 | 主要スタック |
|---------|------|------------|
| A | Lambda + EventBridge | PatternALambdaStack |
| B | AWS Batch (Fargate) | PatternBBatchStack |
| C | SQS + ECS Fargate Worker | PatternCSqsFargateStack |

---

## コマンド一覧

### ビルド・テスト

```bash
# TypeScript コンパイル
npm run build

# テスト実行
npm test

# テストカバレッジ（要 jest --coverage 設定追加）
npm test -- --coverage
```

### CDK 操作

```bash
# dev 環境の差分確認
cdk diff --all -c environment=dev

# dev 環境 synth（CFn テンプレート生成）
cdk synth --all -c environment=dev

# dev 環境 全スタックデプロイ（承認なし）
npm run deploy:dev

# stg 環境 全スタックデプロイ
npm run deploy:stg

# prod 環境 全スタックデプロイ（承認が必要）
npm run deploy:prod

# Pattern A のみ dev 環境にデプロイ
npm run deploy:pattern
# または
cdk deploy --all -c environment=dev -c pattern=A

# Pattern B のみ stg 環境にデプロイ
cdk deploy --all -c environment=stg -c pattern=B

# 特定スタックのみデプロイ
cdk deploy TestSecurityStack -c environment=dev
```

### CDK Bootstrap（初回のみ）

```bash
# ap-northeast-1 リージョン Bootstrap
cdk bootstrap aws://<account-id>/ap-northeast-1

# us-east-1 リージョン Bootstrap（WafCloudFrontStack 用）
cdk bootstrap aws://<account-id>/us-east-1
```

---

## デプロイ順序（手動実行時）

1. `SecurityStack` — KMS CMK 作成（他スタックが ARN 参照）
2. `NetworkStack` — VPC / SG / VPC Endpoint 作成
3. `OnlineStack` — ECS Cluster / ALB 作成
4. `WafRegionalStack` — Regional WAF 作成（ALB に手動アソシエーション）
5. `WafCloudFrontStack` — us-east-1: CloudFront WAF + Distribution 作成
6. `MonitoringStack` — CloudWatch Alarms / Dashboard 作成
7. `PatternALambdaStack` / `PatternBBatchStack` / `PatternCSqsFargateStack` — アプリパターン

---

## ロールバック方法

### CDK ロールバック（CloudFormation ベース）

```bash
# CloudFormation スタックのロールバック（前バージョンに戻す）
aws cloudformation cancel-update-stack --stack-name <stack-name>

# または前回成功 commit の CDK コードで再デプロイ
git checkout <previous-commit>
cdk deploy --all -c environment=prod
```

### 個別スタックのロールバック優先度

| スタック | ロールバック方法 |
|---------|---------------|
| SecurityStack | KMS キーは削除不可（30日 pendingWindow）。ポリシー変更のみロールバック可 |
| NetworkStack | SG / NACL 変更はロールバック可。VPC 削除は ECS/RDS 停止後のみ |
| OnlineStack | ECS サービス更新（circuit breaker 有効）。ALB は削除保護解除が必要 |
| Pattern スタック | 個別スタック destroy → 再 deploy で再構築可 |

---

## 自動適用層との共存（重要）

ガバメントクラウド自動適用層（Security Base / Network Base）が管理するリソースは
CDK で作成・変更しないでください。

**CDK で参照のみ行うリソース（SSM Parameter Store 経由）:**

| リソース | SSM パス |
|---------|---------|
| Transit Gateway ID | `/helloworld/network/tgw-id` |
| Network Hub VPC ID | `/helloworld/network/hub-vpc-id` |
| Log Archive S3 バケット | `/helloworld/security/log-archive-bucket` |
| GuardDuty 委任管理 Account ID | `/helloworld/security/guardduty-admin-account-id` |

**CDK で作成しないリソース:**
- CloudTrail Org Trail（自動適用層管理）
- Config Recorder・Delivery Channel（自動適用層管理）
- GuardDuty Org 有効化（自動適用層管理）
- SecurityHub 委任管理設定（自動適用層管理）
- Network Hub VPC・TGW 本体（自動適用層管理）

---

## cdk-nag（Policy as Code）

`bin/app.ts` で `AwsSolutionsChecks` をグローバルに適用しています。

```typescript
Aspects.of(app).add(new AwsSolutionsChecks({ verbose: true }));
```

`cdk synth` 実行時にセキュリティルールチェックが自動実行されます。  
意図的な例外は `NagSuppressions.addResourceSuppressions()` で理由を明記して抑制しています。

---

## タグ統制（7 キー必須）

全リソースに以下の 7 タグが `applyTags()` によって自動付与されます。

| タグキー | 値の例 | 説明 |
|---------|-------|------|
| environment | dev / stg / prod | デプロイ環境 |
| owner | team-helloworld@example.go.jp | 担当チーム |
| cost_center | tenant-A | コスト集計単位 |
| project | helloworld-archcmp | プロジェクト識別子 |
| tenant | A | テナント識別子 |
| compliance | ismap | コンプライアンスフレームワーク |
| pattern | lambda / batch / sqs-fargate / common | アプリパターン |

---

## Phase3 引き継ぎ注意事項

詳細は `CDK設計書.md 付録B` を参照してください。主要な注意点:

1. **Lambda LogGroup 先行作成** — Lambda 関数作成前に LogGroup を CDK で定義し CMK を指定
2. **AWS Batch L1 コンストラクト** — aws-batch L2 が存在しないため CfnComputeEnvironment 使用
3. **WAF us-east-1 分離** — CloudFront 用 WAF は WafCloudFrontStack で us-east-1 にデプロイ
4. **SQS 深度連動スケール** — Pattern C の Auto Scaling は MathExpression でキュー深度比を算出
5. **CDK Bootstrap 2 リージョン** — ap-northeast-1 と us-east-1 の両方で bootstrap 必要
6. **ECR イメージ** — スケルトン段階は `PLACEHOLDER` タグ。Phase4 でアプリ CI/CD から更新
7. **TGW Attachment** — prod のみ。SSM から TGW ID を取得（自動適用層が事前設定済み前提）

---

## トラブルシューティング

### `cdk synth` が AwsSolutions-xxx エラーで失敗する

cdk-nag のルール違反です。該当スタックの `NagSuppressions` を追加するか、
設計を修正してください。

### `AWS::CloudFormation::CustomResource` が作成される

CDK の一部コンストラクト（`BucketDeployment` 等）は Lambda バックドの Custom Resource を
生成します。VPC 内 Lambda の場合は NAT GW または VPC Endpoint が必要です。

### `Context value 'X' not found` エラー

`cdk.json` の `context` セクションに該当環境の設定が不足しています。
`cdk.json` の `dev` / `stg` / `prod` セクションを確認してください。

### TGW Attachment が prod でエラーになる

SSM パラメーター `/helloworld/network/tgw-id` が未設定の可能性があります。
自動適用層の設定完了後、SSM に TGW ID を登録してから再デプロイしてください。

---

## 参考リンク

- [AWS CDK v2 Developer Guide](https://docs.aws.amazon.com/cdk/v2/guide/)
- [cdk-nag Rules](https://github.com/cdklabs/cdk-nag)
- [ガバメントクラウド技術ガイドライン](https://www.digital.go.jp/policies/gov-cloud/)
- [ISMAP クラウドサービスリスト](https://www.ismap.go.jp/)
