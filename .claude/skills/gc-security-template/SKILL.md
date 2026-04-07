---
description: GCセキュリティテンプレートの設定項目一覧（Config Rules、GuardDuty、SecurityHub、IAM Access Analyzer等のGC推奨設定）
---

# GC セキュリティテンプレート設定項目一覧

## Config Rules（コンプライアンス監視）

### グループ1: IAM セキュリティ

| Rule ID | Rule Name | 説明 | 重要度 |
|---------|-----------|------|--------|
| root-account-mfa-enabled | Root Account MFA | ルートアカウントの MFA 有効化確認 | 高 |
| iam-policy-no-statements-with-admin-access | Admin Policy禁止 | Admin 権限ポリシーの直接割当を検出 | 高 |
| iam-inline-policy-blocked | Inline Policy禁止 | インラインポリシー使用を検出 | 中 |
| access-keys-rotated | アクセスキー定期更新 | 90日以上未更新キーを検出 | 高 |
| mfa-enabled-for-iam-console-access | IAMユーザーMFA | コンソールアクセスユーザーのMFA確認 | 高 |
| principal-policy-review-required | ポリシー棚卸し | 直接 Policy 割当の検出 | 中 |

### グループ2: ネットワーク セキュリティ

| Rule ID | Rule Name | 説明 | 重要度 |
|---------|-----------|------|--------|
| ec2-security-group-audit-failed | SG監査 | デフォルトSG or 0.0.0.0/0許可を検出 | 高 |
| vpc-flow-logs-enabled | VPC Flow Logs | Flow Logs 有効化確認 | 高 |
| restricted-ssh | SSH制限 | Port 22 を 0.0.0.0/0 に許可する SG 検出 | 高 |
| nacl-no-unrestricted-ingress-http | NACL HTTP制限 | NACL で HTTP (80) が Inbound で許可されていないか確認 | 中 |
| vpc-endpoint-service-enabled | VPC Endpoint設置 | 必須 VPC Endpoint（S3, DynamoDB）設置確認 | 中 |

### グループ3: ストレージ セキュリティ

| Rule ID | Rule Name | 説明 | 重要度 |
|---------|-----------|------|--------|
| s3-bucket-public-read-prohibited | S3 Public Read禁止 | パブリック読み取り設定を検出 | 高 |
| s3-bucket-public-write-prohibited | S3 Public Write禁止 | パブリック書き込み設定を検出 | 高 |
| s3-bucket-versioning-enabled | S3 バージョニング | バージョニング有効化確認 | 中 |
| s3-bucket-server-side-encryption-enabled | S3 暗号化 | SSE 有効化確認（KMS推奨） | 高 |
| s3-bucket-default-lock-enabled | S3 Object Lock | 重要バケットでのObject Lock確認 | 中 |
| encrypted-volumes | EBS 暗号化 | EBS ボリューム暗号化確認 | 高 |

### グループ4: ログ・監査

| Rule ID | Rule Name | 説明 | 重要度 |
|---------|-----------|------|--------|
| cloudtrail-enabled | CloudTrail 有効化 | Organizations 単位で有効化確認 | 高 |
| cloudtrail-log-file-validation-enabled | CloudTrail 検証 | ログファイル検証有効化確認 | 高 |
| multi-region-cloudtrail-enabled | CloudTrail マルチRegion | マルチRegion 有効化確認 | 高 |
| cloudwatch-log-group-encrypted | CloudWatch Logs 暗号化 | ログ暗号化（KMS）確認 | 中 |
| dynamodb-pitr-enabled | DynamoDB PITR | Point-in-Time Recovery 有効化 | 中 |

### グループ5: データベース

| Rule ID | Rule Name | 説明 | 重要度 |
|---------|-----------|------|--------|
| rds-encryption-enabled | RDS 暗号化 | 保存時の暗号化確認 | 高 |
| rds-multi-az-enabled | RDS Multi-AZ | Multi-AZ 有効化確認 | 中 |
| rds-storage-encrypted | RDS ストレージ暗号化 | ストレージ暗号化確認 | 高 |
| aurora-encryption-enabled | Aurora 暗号化 | クラスタの暗号化確認 | 高 |

## GuardDuty（脅威検知）

### デフォルト有効なFindings

| Finding Type | 説明 | 応答アクション |
|-------------|------|-------------|
| Backdoor.EC2/Spambot | EC2 がスパムボットとして検知 | インスタンス隔離、イメージ確認 |
| Backdoor.RDS/Spambot | RDS スパムボット検知 | DB アクセス監査、ユーザー確認 |
| CryptoCurrency:EC2/BitcoinTool | 仮想通貨マイニング検知 | インスタンス終了、コスト確認 |
| Trojan.EC2/Suspicious.Network | 疑わしいネットワーク通信 | VPC Flow Logs 確認、遮断 |
| Trojan.RDS/Suspicious.Query | RDS 疑わしいクエリ | Database Audit Logs 確認 |
| UnauthorizedAccess.EC2 | EC2 への不正アクセス試行 | SecurityGroup ルール確認、補修 |

### 自動応答設定

```json
EventBridge Rule: "GuardDuty-High-Severity"

Trigger: GuardDuty Finding (Severity >= 7)
Actions:
  1. SNS Notification → Security Team
  2. Lambda → Auto Remediation
     - Isolate SG (Block ingress/egress)
     - Create SNS Alert
     - Invoke SOAR (Slack notification)
  3. CloudWatch Logs → SIEM (Splunk)
```

## Security Hub（セキュリティ統合）

### 統合Standards（コンプライアンス フレームワーク）

| Standard | 対象項目数 | 対応政府規制 |
|----------|---------|-----------|
| **AWS Foundational Security Best Practices** | 150+ | 共通 |
| **CIS AWS Foundations Benchmark v1.4.0** | 220+ | PCI-DSS, HIPAA準拠 |
| **PCI DSS v3.2.1** | 120+ | クレジットカード決済 |
| **SOC 2** | 100+ | SaaS企業 |
| **NIST SP 800-53 Rev. 5** | 350+ | 米国政府機関 |

### カスタムルール例

```json
Rule: "RDS 暗号化未設定"
Severity: HIGH
Resources: AWS::RDS::DBInstance
Condition:
  {
    "Attribute": "encrypted",
    "Value": false
  }
Action: Auto-remediation enabled
```

## KMS（キー管理サービス）

### マスターキー設計

| キー種別 | 用途 | 所有者 | 回転周期 |
|---------|------|-------|---------|
| **Org Master Key** | Organizations 全体共通暗号化 | Organizations Admin | 年1回 |
| **App Master Key** | アプリケーション秘密情報 | App Team | 年1回 |
| **Data Master Key** | DB/ストレージ暗号化 | DBA | 年2回 |
| **Backup Master Key** | バックアップ暗号化 | Backup Admin | 年1回 |

### キーポリシー例

```json
{
  "Sid": "Enable IAM policies",
  "Effect": "Allow",
  "Principal": {
    "AWS": "arn:aws:iam::123456789012:root"
  },
  "Action": "kms:*",
  "Resource": "*"
}

{
  "Sid": "Allow EC2 to use key",
  "Effect": "Allow",
  "Principal": {
    "Service": "ec2.amazonaws.com"
  },
  "Action": [
    "kms:Decrypt",
    "kms:GenerateDataKey"
  ],
  "Resource": "*"
}

{
  "Sid": "Deny unencrypted uploads",
  "Effect": "Deny",
  "Principal": "*",
  "Action": "kms:Decrypt",
  "Resource": "*",
  "Condition": {
    "StringEquals": {
      "kms:EncryptionContext:Department": "NotFinance"
    }
  }
}
```

## WAF（Web Application Firewall）

### Web ACL ルールセット

| ルール | 説明 | アクション |
|-------|------|---------|
| **AWSManagedRulesCommonRuleSet** | OWASP Top 10 検出（SQLi, XSS等） | Block or Count |
| **AWSManagedRulesLinuxRuleSet** | Linux固有攻撃検出 | Block |
| **AWSManagedRulesKnownBadInputsRuleSet** | 既知の悪意ある入力 | Block |
| **RateLimitingRule** | DDoS対策（1000req/5min以上） | Block |
| **GeoBlockingRule** | 地政学的フィルタ（特定国からのアクセス禁止） | Block |
| **IPReputationListRule** | 悪質 IP リスト | Block |

### CloudFront 連携時の設定

```
CloudFront (Origin)
    ↓
WAF (ALB/CloudFront attachment)
    ↓
Backend (EC2/ECS)

WAF Rules:
  - X-Forwarded-For ヘッダから実クライアント IP 抽出
  - CloudFront X-Amzn-Trace-Id で通信追跡
```

## IAM Access Analyzer

### 分析対象リソース

| リソース | 検査項目 | 検出パターン |
|---------|--------|----------|
| **S3 Bucket** | パブリック アクセス | BucketPolicy: Principal: "*" |
| **IAM Role** | 信頼できないプリンシパル | AssumeRolePolicyDocument: External Account |
| **KMS Key** | 信頼できないユーザー | KeyPolicy: Principal: "*" with Decrypt action |
| **Lambda Function** | 不適切な権限委譲 | ResourceBasedPolicy: Principal: "*" |

### アラート設定例

```
Finding: "S3 Bucket allows public access"
Severity: HIGH
Recommendation: Remove BucketPolicy statement with Principal: "*"
Auto-Remediation: Enable (λ削除)
```

## Secrets Manager（シークレット管理）

### 秘密情報の分類

| 秘密タイプ | 保存対象 | 回転周期 | アクセス制限 |
|-----------|--------|--------|-----------|
| **DBPassword** | RDS パスワード | 30日 | App Team Only |
| **APIKey** | 外部 API キー | 60日 | System Integration |
| **SSHKey** | SSH 秘密鍵 | 需要時（変更ない） | Admin Only |
| **TLSCert** | SSL/TLS証明書 | 証明書有効期に同じ | DevOps Team |

### 自動ローテーション設定

```
Lambda Function: rotate-rds-password
  Trigger: Secrets Manager rotation (30日ごと)
  処理:
    1. 新パスワード生成
    2. RDS ユーザーパスワード更新
    3. Secrets Manager 値更新
    4. アプリケーション環境変数リロード
```

## セキュリティ設定チェックリスト

- [ ] Config Rules が全グループ（IAM/Network/Storage/Logging/DB）設定済み
- [ ] GuardDuty が Organizations レベルで有効化
- [ ] GuardDuty Findings に対する自動応答フローが存在
- [ ] Security Hub が有効化、3つ以上の Standards 統合
- [ ] KMS マスターキー設計が完了（キー/用途対応表）
- [ ] KMS キーローテーションポリシーが設定済み
- [ ] WAF ルールセットが ALB/CloudFront に適用
- [ ] IAM Access Analyzer による分析結果がレビュー済み
- [ ] Secrets Manager で全秘密情報が一元管理
- [ ] 自動ローテーション設定が実装済み（パスワード、API鍵等）
