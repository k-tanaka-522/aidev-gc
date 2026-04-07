---
description: ゼロトラスト設計原則（DS-310準拠、マイクロセグメンテーション、最小権限、継続的検証）
---

# ゼロトラスト設計原則

## ゼロトラストの定義と4本柱

### ゼロトラスト原則
「すべてのアクセスをデフォルト拒否（Deny All）し、明示的に許可したもののみアクセス可能にする」

### 4本柱

```
┌──────────────────┐
│   Zero Trust     │
├──────────────────┤
│ 1. Identity      │ ← ユーザー・デバイス認証
│ 2. Device        │ ← エンドポイント検疫
│ 3. Network       │ ← マイクロセグメンテーション
│ 4. Data & Apps   │ ← 資源ごとのアクセス制御
└──────────────────┘
```

## DS-310（セキュリティグループ閣議決定指針）への準拠

### DS-310 概要
日本政府が提示する情報セキュリティの指針。クラウド利用時のセキュリティ要件を定義。

### DS-310 対応マッピング

| DS-310 要件 | ゼロトラスト実装 | GC実装例 |
|-----------|-------------|---------|
| **C-1: 不可視化** | ネットワーク トラフィック可視化 | VPC Flow Logs + CloudWatch |
| **C-2: アクセス制御** | 最小権限の実装 | IAM ロール + SCP |
| **C-3: 侵入検知** | 脅威検知サービス | GuardDuty + SecurityHub |
| **C-4: 監査ログ** | 全アクセスログ記録 | CloudTrail + VPC Flow Logs |
| **C-5: 暗号化** | 転送時・保存時の暗号化 | TLS + KMS |
| **C-6: 認証** | 多要素認証（MFA） | MFA必須化 + TOTP/Passkey |
| **C-7: 権限委譲** | 権限分離、監査 | Permission Boundary + Access Analyzer |

## 柱1: Identity（認証・認可）

### ユーザー認証フロー

```
ユーザー
  ↓
IdP (Azure AD, Okta)
  ↓
MFA確認（TOTP + Passkey）
  ↓
Google Cloud Identity（IdentityDomain）
  ↓
IAM ロール割当
  ↓
リソースアクセス権限判定
```

### IAM ロール設計（最小権限）

**Principle**: ユーザーには「必要な権限のみ」を付与

```yaml
Application Developer:
  - EC2InstanceProfile:
    - Action: ec2:Describe*, ec2:Start*, ec2:Stop*
    - Resource: arn:aws:ec2:*:*:instance/dev-*
  - S3 Bucket:
    - Action: s3:GetObject, s3:PutObject
    - Resource: arn:aws:s3:::dev-bucket/app-code/*

Database Administrator:
  - RDS:
    - Action: rds:Describe*, rds:Modify*
    - Resource: arn:aws:rds:*:*:db:prod-*
  - CloudWatch Logs:
    - Action: logs:CreateLogGroup, logs:CreateLogStream
    - Resource: arn:aws:logs:*:*:*
```

### Permission Boundary の活用

```json
{
  "Statement": [
    {
      "Sid": "LimitEC2Actions",
      "Effect": "Allow",
      "Action": [
        "ec2:*",
        "elasticloadbalancing:*",
        "cloudwatch:*"
      ],
      "Resource": "*"
    },
    {
      "Sid": "DenyDANGEROUS",
      "Effect": "Deny",
      "Action": [
        "iam:*",
        "organizations:*",
        "ec2:TerminateInstances",
        "rds:DeleteDBInstance"
      ],
      "Resource": "*"
    }
  ]
}
```

## 柱2: Device（エンドポイント検疫）

### デバイス管理要件

| デバイス種別 | 検疫項目 | 確認方法 |
|-----------|--------|--------|
| **Windows** | OS Patch状態、Antivirus、Disk Encryption | Intune, SCCM |
| **macOS** | OS Patch状態、XProtect、FileVault | Jamf Pro |
| **Linux** | OS Patch状態、Firewall、SELinux | Landscape, Puppet |
| **Mobile** | Device Management登録、Passcode設定 | Intune, MDM |

### 検疫ポリシー例

```
IF デバイスが検疫ポリシルに非準拠:
  THEN
    - VPC 内リソースへのアクセス拒否
    - S3 バケットへのアクセス拒否
    - RDS データベースへのアクセス拒否
    - CloudWatch ロググループへのアクセス制限

IF OS Patch 未適用（>30日）:
  THEN
    - ネットワーク隔離（Quarantine VLAN）
    - ユーザー通知 & 修復指示
```

### エンドポイント検疫フロー

```
ユーザー デバイス
  ↓
Pre-Connect Assessment
  ├─ OS バージョン確認
  ├─ Antivirus 定義ファイル更新確認
  ├─ Disk Encryption有効化確認
  └─ Firewall有効化確認
  ↓
IF 不準拠:
  ├─ Remediation Guide 表示
  ├─ 自動更新トリガー
  └─ 準拠確認後にアクセス許可
```

## 柱3: Network（マイクロセグメンテーション）

### マイクロセグメンテーション 3層

```
Layer 1: Subnet 単位（ネットワークアドレス）
  ├─ Public: 10.0.1.0/24
  ├─ Private-APP: 10.0.11.0/24
  └─ Private-DB: 10.0.21.0/24

Layer 2: Security Group（ステートフル）
  ├─ sg-web: Inbound 80,443 from 0.0.0.0/0
  ├─ sg-app: Inbound 8080 from sg-web only
  └─ sg-db: Inbound 3306 from sg-app only

Layer 3: Network ACL（ステートレス）
  ├─ Public NACL: Inbound 80,443,22
  ├─ Private NACL: Inbound 1024-65535 (return traffic)
  └─ Protected NACL: Inbound 3306 のみ
```

### セキュリティグループ設計（Deny All原則）

```
デフォルト: すべて拒否

Web層 (sg-web):
  Inbound:
    - TCP 80 from 0.0.0.0/0 (HTTP)
    - TCP 443 from 0.0.0.0/0 (HTTPS)
  Outbound:
    - TCP 443 to 0.0.0.0/0 (外部API)
    - TCP 3306 to sg-app (DB)

APP層 (sg-app):
  Inbound:
    - TCP 8080 from sg-web only
  Outbound:
    - TCP 443 to 0.0.0.0/0 (外部)
    - TCP 3306 to sg-db (DB)

DB層 (sg-db):
  Inbound:
    - TCP 3306 from sg-app only
  Outbound:
    - TCP 443 to 0.0.0.0/0 (CloudWatch等)
```

## 柱4: Data & Apps（リソースアクセス制御）

### データ分類 & 暗号化戦略

| データ分類 | 保存時暗号化 | 転送時暗号化 | アクセス制限 |
|----------|-----------|----------|----------|
| **Public** | Optional | Optional | 制限なし |
| **Internal** | Optional | TLS必須 | 従業員のみ |
| **Confidential** | KMS必須 | TLS必須 | 承認者のみ |
| **Restricted** | KMS必須+MFA | TLS必須 | 最高権限のみ |

### リソースベースのアクセス制御

```
S3 Bucket Policy:
  {
    "Version": "2012-10-17",
    "Statement": [
      {
        "Sid": "DenyUnencryptedObjectUploads",
        "Effect": "Deny",
        "Principal": "*",
        "Action": "s3:PutObject",
        "Resource": "arn:aws:s3:::bucket/*",
        "Condition": {
          "StringNotEquals": {
            "s3:x-amz-server-side-encryption": "aws:kms"
          }
        }
      }
    ]
  }

RDS Resource Policy:
  {
    "Version": "2012-10-17",
    "Statement": [
      {
        "Effect": "Allow",
        "Principal": {
          "AWS": "arn:aws:iam::123456789012:role/EC2-App-Role"
        },
        "Action": "rds:DescribeDBInstances",
        "Resource": "arn:aws:rds:*:*:db/prod-*"
      }
    ]
  }
```

## 継続的検証（Continuous Verification）

### 定期的な検証フロー

```
Daily:
  ├─ GuardDuty Findings レビュー
  ├─ VPC Flow Logs 異常検知
  └─ CloudTrail API 呼び出しログ監視

Weekly:
  ├─ IAM Access Analyzer レビュー
  ├─ Config Rules コンプライアンス確認
  └─ SecurityHub Findings 分類

Monthly:
  ├─ IAM Permission 監査
  ├─ SG/NACL ルール棚卸し
  └─ デバイス検疫ステータス確認

Quarterly:
  ├─ ゼロトラスト実装完全性チェック
  ├─ 脅威分析 & 対策見直し
  └─ セキュリティテスト（侵入試験等）
```

### アノマリ検知

```
CloudWatch Anomaly Detector:
  - 通常のアクセスパターンを学習
  - 異常な API 呼び出しを自動検知
  - 例: Root ユーザー利用、失敗ログイン多数

GuardDuty ML Model:
  - ネットワークトラフィックの異常
  - API 呼び出しの異常
  - DNS クエリの異常（ボットネット検知）
```

## ゼロトラスト実装チェックリスト

- [ ] 全ユーザーに MFA が必須化（TOTP + Passkey）
- [ ] Permission Boundary が全 IAM ロールに適用
- [ ] セキュリティグループの「Deny All デフォルト」が実装
- [ ] Network ACL が Inbound 制御されている
- [ ] すべてのデータが TLS（転送時）で保護
- [ ] 機密データが KMS（保存時）で暗号化
- [ ] VPC Flow Logs が有効化、SIEM に送信中
- [ ] GuardDuty が有効化、Findings に対する自動応答フロー実装
- [ ] IAM Access Analyzer が定期的にレビューされている
- [ ] 月次のアクセス権限監査が実施されている
- [ ] デバイス検疫ポリシーが運用中
- [ ] 四半期ごとのセキュリティテスト（侵入試験）が計画中

## DS-310 準拠確認表

| 要件 | 実装内容 | 完了 |
|-----|--------|------|
| C-1: 不可視化 | VPC Flow Logs + CloudTrail | □ |
| C-2: アクセス制御 | IAM + SCP + SG | □ |
| C-3: 侵入検知 | GuardDuty + IDS/IPS | □ |
| C-4: 監査ログ | CloudTrail (Organizations level) | □ |
| C-5: 暗号化 | KMS + TLS | □ |
| C-6: 認証 | MFA必須化 | □ |
| C-7: 権限委譲 | Permission Boundary | □ |
