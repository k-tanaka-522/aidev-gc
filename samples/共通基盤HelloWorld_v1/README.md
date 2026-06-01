# 共同利用ガバメントクラウド Hello World アーキ比較検証（見積サンプル）

> **目的**: Spring Boot 製の Hello World ワークロードを題材に、**バッチ・非同期処理の 3 アーキテクチャパターン**（Lambda / AWS Batch / SQS+ECS Fargate）を設計・構築要素まで洗い出し、**工数を見積比較**するためのサンプル案件です。
>
> ⚠️ 本成果物は **見積サンプルの概算** です。工数・パラメータはサンプル前提の代表値であり、実案件では要件確定後に精緻化が必要です。

---

## 1. 案件プロファイル

| 軸 | 設定 |
|----|------|
| GC 利用方式 | **共同利用方式**（ベンダー払い出し環境に複数自治体テナントを分離） |
| 自治体規模 | 省庁級 |
| セキュリティ | 高（ISMAP 対応 / DS-310 準拠 / ConMon・CSPM） |
| ネットワーク | 複雑（LGWAN + DirectConnect + テナント分離） |
| 移行方式 | 新規構築 |
| IaC | **AWS CDK (TypeScript)**、ガバクラ標準準拠 |
| アプリ実装 | インフラ(CDK)中心、Spring Boot は Hello World スケルトン |

---

## 2. システム構成

```
                          ┌──────────── オンライン処理（全パターン共通）────────────┐
   インターネット ──▶ CloudFront ─▶ WAF ─▶ 公開ALB ─▶ ECS Fargate(public service)
   庁内/LGWAN ──▶ DX ─▶ TGW ─▶ 内部ALB ─────────────▶ ECS Fargate(private service)
                          └──────────────────────────────────────────────────────┘

                          ┌──────────── バッチ・非同期処理（3パターン比較）────────┐
   パターン A  ：  EventBridge ─▶ Lambda ─▶ (DLQ / S3)
   パターン B  ：  EventBridge ─▶ AWS Batch (Compute Env / Job Queue / Job Definition)
   パターン C  ：  SQS ─▶ ECS Fargate Worker（キュー深度連動 Auto Scaling）─▶ DLQ
                          └──────────────────────────────────────────────────────┘
```

- **オンライン処理**: ECS Fargate（パブリックサービス + プライベートサービス）— 全パターン共通
- **バッチ・非同期処理**: 上記 A / B / C を比較対象として全て設計・構築・見積

---

## 3. 🎯 3パターン工数見積比較（核心成果）

| 項目 | A: Lambda | B: AWS Batch | C: SQS+ECS Fargate |
|------|-----------|--------------|--------------------|
| **固有工数** | **57 人日（最小）** | **88 人日（最大）** | **72 人日（中）** |
| 単一採用時 総工数（共通823 + 固有） | 880 人日 | 911 人日 | 895 人日 |
| 固有リソース種別数 | 8 | 9 | **11（最多）** |
| IAM ロール数 | 1 | **3** | 2 |
| CDK 構成 | L2 中心 | **L1 必須**(CE/JQ/JD) | L2 + AutoScaling |
| 固有アラーム数 | 4 | 2 | 5 |
| CDK コード行数 | 254 | 268 | 336 |

### 工数ドライバー分析
固有工数の順序は **A < C < B**。これは *リソース種別数*（A<B<C）ではなく、**L1 必須数・IAM ロール数 ＝ 実装難度**の順序に一致します。**B が最大なのは AWS Batch の L1 多用（CE/JQ/JD 三層）＋ロール 3 分離**が主因です。

### 採用推奨指針
| パターン | 向いているケース |
|---------|----------------|
| **A: Lambda** | 軽量・短時間・低頻度。最小工数＆運用負荷。Hello World 相当に最適 |
| **C: SQS+Fargate** | 長時間処理・キュー制御・既存コンテナ資産活用。バランス型 |
| **B: AWS Batch** | 大規模並列・本格バッチ。工数最大だがスケール要件で正当化 |

> 見積 3 手法（ボトムアップ / 類推 / 3 点）のクロスチェック乖離 **±3%**。3 点見積レンジ 835〜1,406 人日。

---

## 4. 成果物マップ

```
samples/共通基盤HelloWorld_v1/
├── README.md                      ← 本ファイル
├── 00_案件立ち上げ/
│   ├── PROF-001_案件プロファイル.md
│   ├── TAIL-001_テーラリングレポート.md     # エージェント/スキル有効化・比較見積構造
│   └── WBS-001_標準WBS.md
├── 050_設計/
│   ├── 基本設計/
│   │   ├── GC-002_GC環境システム全体構成基本設計書.md   # アカウント/テナント分離/SSO/全体構成
│   │   ├── NW-001_ネットワーク基本設計書.md             # VPC/サブネット/LGWAN/DX/TGW
│   │   ├── SEC-001_セキュリティ基本設計書.md            # IAM/KMS/WAF/ConMon/ISMAP305
│   │   └── diagrams/                                    # draw.io 構成図 7枚
│   └── 詳細設計/
│       ├── PARAM-001_ネットワーク詳細パラメーターシート.md
│       ├── PARAM-002_オンライン系詳細パラメーターシート.md
│       ├── PARAM-003_セキュリティ共通詳細パラメーターシート.md
│       ├── PARAM-004_監視共通詳細パラメーターシート.md
│       ├── PARAM-005_パターンA_Lambda詳細パラメーターシート.md
│       ├── PARAM-006_パターンB_AWSBatch詳細パラメーターシート.md
│       └── PARAM-007_パターンC_SQS+ECSFargate詳細パラメーターシート.md
├── 060_IaC/
│   ├── CDK設計書.md               # スタック分割/Construct設計/cdk-nag/デプロイ手順
│   └── cdk/                        # CDK コード（TypeScript, 25ファイル/4,873行）
└── 020_見積/
    └── EST-001_設計構築要素一覧_3パターン比較見積書.md   # ★最終成果物
```

### 読む順番（推奨）
1. **本 README**（全体像） → 2. `020_見積/EST-001`（比較結論） → 3. `050_設計/基本設計/GC-002`（構成） → 4. `060_IaC/CDK設計書.md`（実装方針）

---

## 5. CDK コード構成

```
060_IaC/cdk/
├── bin/app.ts                     # 9スタック定義・依存制御・cdk-nag(AwsSolutionsChecks)
├── lib/
│   ├── common/                    # config / tags / ssm-refs（自動適用層の参照ヘルパ）
│   ├── constructs/                # kms / vpc / security-groups / vpc-endpoints
│   └── stacks/
│       ├── security-stack.ts          # KMS CMK / IAM / GuardDuty / Config Rules
│       ├── network-stack.ts           # VPC / サブネット / NACL / TGW Attachment
│       ├── online-stack.ts            # ECS Fargate(public/private) / ALB×2 / ECR
│       ├── waf-regional-stack.ts      # WAF(REGIONAL)
│       ├── waf-cloudfront-stack.ts    # WAF(CLOUDFRONT) + CloudFront ※us-east-1
│       ├── monitoring-stack.ts        # Logs / Alarm / Dashboard
│       ├── pattern-a-lambda-stack.ts       # パターンA
│       ├── pattern-b-batch-stack.ts        # パターンB
│       └── pattern-c-sqs-fargate-stack.ts  # パターンC
├── test/                          # ユニットテスト 3スイート
├── cdk.json / package.json / tsconfig.json
└── README.md                      # デプロイ/ロールバック手順
```

### デプロイ（イメージ）
```bash
cd 060_IaC/cdk
npm install
npx cdk synth                       # 合成（テンプレート生成）
npx cdk deploy -c pattern=A --all   # パターンA をデプロイ（A|B|C で切替）
```
> ⚠️ Spring Boot アプリの ECR イメージ参照はプレースホルダです。実デプロイには別途イメージビルドが必要です。

---

## 6. ガバクラ標準（デジタル庁 2025 年標準）の反映

| 標準要素 | 本サンプルでの反映 |
|----------|-------------------|
| テンプレート 3 層体系 | 自動適用層は **CDK 管理外（Import/SSM 参照のみ・上書き禁止）**、必須適用＋任意層のみ CDK 表現 |
| アカウント統制 | Organizations メンバーアカウント前提、SCP 制約下の設計、GCAS-SSO(CEP) 連携 |
| ConMon / CSPM | GuardDuty / SecurityHub / Config Rules / IAM Access Analyzer / CloudTrail |
| 暗号化 | KMS CMK（テナント別キー）、DS-310 準拠 |
| タグ統制 | `environment / owner / cost_center / project / compliance=ismap / tenant / pattern` の 7 キー |
| リージョン制限 | ap-northeast-1（CloudFront WAF のみ us-east-1 別スタック） |

---

## 7. 品質・検証ステータス

| 検証 | 結果 |
|------|------|
| 抜け漏れ検知（@infra-gap-detector） | **88 / 100**（致命的な構造欠落なし） |
| 整合性チェック（@infra-qa） | **条件付き PASS**（設計矛盾 0・コード品質 A・見積妥当性 実測突合一致） |
| 検証指摘の修正 | C-1/H-1/H-2/M-1/M-2 **対応済**（比較数値を CDK 実体・EST-001 に統一） |

### 未確定事項（仮定で作成）
オープン QA 17 件・ISSUE 6 件は作業仮定を置いて作成しています（評価軸の重み付け、バッチのワークロード特性、LGWAN 詳細仕様 等）。詳細は `outputs/80_PM/02_課題QA管理/` の `QA_LOG.md` / `ASSUMPTION_LOG.md` を参照。実値が決まれば成果物の再生成が可能です。

---

## 8. 生成プロセス

本サンプルは aidev-gc フレームワークの専門エージェント群により、以下のフローで生成しました：

```
@tailoring（立ち上げ）
  → @infra-gc-environment / @infra-network / @infra-security（基本設計）
  → @infra-iac（詳細設計パラメーターシート → CDK設計書＋コード）
  → @infra-estimation（3パターン見積比較）
  → @infra-gap-detector / @infra-qa（検証）
  → 指摘修正
```
