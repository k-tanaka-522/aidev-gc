---
description: ISMAP 305管理策のうちインフラ担当分（アクセス制御、暗号化、ログ管理、ネットワーク分離、脆弱性管理等のカテゴリ別対応方針）
---

# ISMAP 305管理策 インフラ実装ガイド

## ISMAP（政府情報システムセキュリティ管理基準）概要

ISMAP305は、政府情報システムのセキュリティ認証制度。金融・医療・公共機関等のセキュリティ高要件業種が対象。

## インフラ担当の管理策（約80項目）

### カテゴリ1: アクセス制御（AC系） - 15項目

| 管理策ID | 管理策名 | インフラ実装 | 実装責任 |
|---------|--------|-----------|--------|
| AC-1 | ユーザー登録・削除管理 | IdP (Azure AD) + IAM ロール自動削除 | Identity Admin |
| AC-2 | アクセス権の最小化 | IAM Permission Boundary + SCP | Security Team |
| AC-3 | ユーザー認証 | MFA（TOTP + Passkey）必須化 | Security Team |
| AC-4 | アクセス制御の実装 | SG/NACL + IAM Policy | Network/Security |
| AC-5 | 特権アカウント管理 | AWS SSM Session Manager + CloudTrail | Security/Operations |
| AC-6 | 共有アカウント禁止 | Identity-based Policy のみ使用 | Security Team |
| AC-7 | デフォルト設定変更 | Hardened AMI + Config Rules | Security/Operations |
| AC-8 | リモートアクセス制御 | VPN + Bastion + MFA | Network Team |
| AC-9 | アクセス監査ログ | CloudTrail Organizations-level | Operations/Audit |
| AC-10 | 権限委譲管理 | STS AssumeRole 監査 | Security Team |
| AC-11 | グループベース権限管理 | Azure AD Group ← → IAM Role | Identity Admin |
| AC-12 | サービスアカウント管理 | IRSA (IAM Roles for Service Accounts) | Security/DevOps |
| AC-13 | 退職者アカウント処理 | 自動無効化 + リソース削除 | Identity Admin |
| AC-14 | 一時的アクセス許可 | Temporary Credentials (STS) with TTL | Security Team |
| AC-15 | パスワードポリシー | 複雑性要件 + 定期変更 + HashiCorp Vault | Security Team |

### カテゴリ2: 暗号化（CR系） - 12項目

| 管理策ID | 管理策名 | インフラ実装 | 実装責任 |
|---------|--------|-----------|--------|
| CR-1 | 転送時の暗号化 | TLS 1.2+ (CloudFront, ALB, RDS) | Network/Security |
| CR-2 | 保存時の暗号化 | KMS CMK for EBS, S3, RDS, DynamoDB | Security Team |
| CR-3 | 鍵管理 | KMS Key Policy + Rotation (年1回) | Security Team |
| CR-4 | バックアップ暗号化 | AWS Backup + KMS | Backup Admin |
| CR-5 | 通信パスワード暗号化 | KMS Secrets Manager | DevOps Team |
| CR-6 | 鍵交換方式 | TLS Perfect Forward Secrecy | Network Team |
| CR-7 | 鍵の廃棄 | KMS Key Disable + Schedule Deletion (30day) | Security Team |
| CR-8 | 暗号化アルゴリズム | AES-256, RSA-2048以上 | Security Team |
| CR-9 | 証明書管理 | ACM + Auto Renewal + CloudWatch | Operations Team |
| CR-10 | 暗号化強度検証 | Config Rules for Encryption Check | Security Team |
| CR-11 | 初期化ベクトル | AWS 標準（AESIV自動生成） | 標準準拠 |
| CR-12 | ハイブリッド暗号化 | S3 Server-Side Encryption で実装 | Security Team |

### カテゴリ3: ログ管理（LG系） - 18項目

| 管理策ID | 管理策名 | インフラ実装 | 実装責任 |
|---------|--------|-----------|--------|
| LG-1 | API呼び出しログ記録 | CloudTrail (Organizations level) | Operations/Audit |
| LG-2 | ログ保存期間 | S3 + Glacier (最小: 監査対象期間+1年) | Operations |
| LG-3 | ログアクセス制限 | S3 BucketPolicy + IAM | Security Team |
| LG-4 | ログ改ざん防止 | CloudTrail Log File Validation + MFA Delete | Security Team |
| LG-5 | ログ整合性確認 | CloudTrail Digest Files | Operations |
| LG-6 | ログ分析 | CloudWatch Logs Insights + SIEM (Splunk) | Security Team |
| LG-7 | ネットワークログ | VPC Flow Logs (All Traffic) | Network Team |
| LG-8 | アプリケーションログ | CloudWatch Logs (Centralized) | DevOps/App Team |
| LG-9 | セキュリティイベント | GuardDuty + SecurityHub → EventBridge | Security Team |
| LG-10 | ログ監視アラート | CloudWatch Alarms + SNS | Operations |
| LG-11 | ログの時刻同期 | NTP Sync (AWS Systems Manager) | Operations |
| LG-12 | ログの外部送信 | Kinesis Firehose → Splunk/S3 | Security/Operations |
| LG-13 | 監査証跡保全 | CloudTrail に Organizations Account ID 含める | Operations |
| LG-14 | トラブルシューティングログ | X-Ray + CloudWatch Logs | DevOps |
| LG-15 | ログ廃棄手順 | Lifecycle Policy (S3 to Glacier to Delete) | Operations |
| LG-16 | ログ監視の自動化 | Lambda → Splunk API | Security Team |
| LG-17 | ログ保管時の暗号化 | S3-KMS + Transit-TLS | Security Team |
| LG-18 | ログレビュー頻度 | 日次 (GUI) + 月次 (Audit Report) | Operations/Audit |

### カテゴリ4: ネットワーク分離（NW系） - 14項目

| 管理策ID | 管理策名 | インフラ実装 | 実装責任 |
|---------|--------|-----------|--------|
| NW-1 | VPC 分離 | VPC Peering / TransitGateway | Network Team |
| NW-2 | Subnet 分離 | Public/Private/Protected 3層 | Network Team |
| NW-3 | セキュリティグループ | Deny All デフォルト + 明示的許可 | Security/Network |
| NW-4 | NACL設定 | Stateless ルール | Network Team |
| NW-5 | ファイアウォール | WAF (CloudFront, ALB) | Security Team |
| NW-6 | VPN暗号化 | Site-to-Site VPN / ClientVPN | Network Team |
| NW-7 | DMZ実装 | Public Subnet (ALB/NAT) | Network Team |
| NW-8 | ネットワークセグメンテーション | マイクロセグメンテーション | Security Team |
| NW-9 | 外部接続制御 | VPC Endpoint + Gateway | Network Team |
| NW-10 | ネットワークアドレス変換 | NAT Gateway (高可用性) | Network Team |
| NW-11 | IPアドレス管理 | IPAM設計 + DHCP設定 | Network Team |
| NW-12 | DNS分離 | Route53 Private Hosted Zone | Network Team |
| NW-13 | トラフィック監視 | VPC Flow Logs + Network Analytics | Operations |
| NW-14 | 外部ネットワーク接続 | LGWAN / DirectConnect | Network Team |

### カテゴリ5: 脆弱性管理（VN系） - 12項目

| 管理策ID | 管理策名 | インフラ実装 | 実装責任 |
|---------|--------|-----------|--------|
| VN-1 | セキュリティ更新適用 | Systems Manager Patch Manager | Operations |
| VN-2 | 脆弱性スキャン | Inspector + Custom Scanning | Security Team |
| VN-3 | 侵入テスト | 年2回以上の外部テスト実施 | Security Team |
| VN-4 | 脆弱性追跡 | Config Rules Compliance Tracking | Security Team |
| VN-5 | 脆弱性対応計画 | Runbook + Automation | Operations |
| VN-6 | セキュアなAMI | Hardened AMI (CIS Benchmark) | Security Team |
| VN-7 | コンテナセキュリティ | ECR Image Scanning + Pod Security Policy | DevOps |
| VN-8 | 依存関係管理 | Software Composition Analysis (SCA) | DevOps |
| VN-9 | セキュアなCI/CD | Code Pipeline + Code Build Signing | DevOps |
| VN-10 | 定期的なレビュー | Monthly Vulnerability Review | Security Team |
| VN-11 | 脆弱性DBの更新 | SecurityHub + National CVE DB | Security Team |
| VN-12 | ホワイトソース同期 | WhiteSource / Dependabot 統合 | DevOps |

### カテゴリ6: 物理・環境セキュリティ（PE系） - 5項目

| 管理策ID | 管理策名 | インフラ実装 | 実装責任 |
|---------|--------|-----------|--------|
| PE-1 | データセンター選定 | GC リージョン（日本国内） | 調達 |
| PE-2 | アクセス制限 | IAM + MFA | Security Team |
| PE-3 | 物理媒体管理 | GC による自動廃棄 | 標準準拠 |
| PE-4 | ネットワーク物理分離 | VPC / Network Isolation | Network Team |
| PE-5 | バックアップ媒体管理 | S3 + Glacier Vault Lock | Operations |

### カテゴリ7: インシデント対応（IR系） - 4項目

| 管理策ID | 管理策名 | インフラ実装 | 実装責任 |
|---------|--------|-----------|--------|
| IR-1 | インシデント検出 | GuardDuty + SecurityHub + CloudWatch Alarms | Security Team |
| IR-2 | インシデント対応計画 | Runbook + Automation (EventBridge → Lambda) | Operations/Security |
| IR-3 | インシデントログ保全 | CloudTrail + Immutable S3 | Operations |
| IR-4 | インシデント報告 | SOAR + Slack Integration | Security Team |

## ISMAP305 準拠確認チェックリスト

### アクセス制御（AC系）
- [ ] AC-1: IdP から IAM ロールへの自動デプロビジョニング
- [ ] AC-2: Permission Boundary が全 IAM ロールに適用
- [ ] AC-3: MFA（TOTP + Passkey）が全ユーザー必須化
- [ ] AC-4: SG/NACL 設定が "Deny All デフォルト"
- [ ] AC-5: Bastion + Session Manager でなく特権アカウント監視
- [ ] AC-9: CloudTrail Organizations-level で Organizations 統一
- [ ] AC-15: パスワード複雑性ポリシー実装

### 暗号化（CR系）
- [ ] CR-1: TLS 1.2+ が全通信で有効化
- [ ] CR-2: KMS CMK で EBS, S3, RDS, DynamoDB 暗号化
- [ ] CR-3: KMS キーローテーション年1回設定
- [ ] CR-4: AWS Backup + KMS でバックアップ暗号化
- [ ] CR-9: ACM 証明書の自動更新設定

### ログ管理（LG系）
- [ ] LG-1: CloudTrail Organizations-level で全 API 記録
- [ ] LG-2: ログ保存期間 監査対象期間+1年以上
- [ ] LG-4: CloudTrail Log File Validation + MFA Delete
- [ ] LG-7: VPC Flow Logs （全VPC、All Traffic）
- [ ] LG-10: CloudWatch Alarms で異常検知
- [ ] LG-12: Splunk 等 SIEM への外部送信

### ネットワーク分離（NW系）
- [ ] NW-2: Public/Private/Protected 3層 Subnet 構成
- [ ] NW-3: Security Group "Deny All" デフォルト
- [ ] NW-8: マイクロセグメンテーション実装（SG/NACL多層）
- [ ] NW-13: VPC Flow Logs でトラフィック監視

### 脆弱性管理（VN系）
- [ ] VN-1: Systems Manager Patch Manager 月1回以上実行
- [ ] VN-2: Inspector スキャン 月1回以上
- [ ] VN-3: 年2回以上の侵入テスト実施
- [ ] VN-6: CIS Benchmark に基づく Hardened AMI

### インシデント対応（IR系）
- [ ] IR-1: GuardDuty + SecurityHub が有効化
- [ ] IR-2: インシデント対応計画（Runbook）存在
- [ ] IR-3: CloudTrail Immutable S3 保存

## 実装優先順位（推奨）

| Priority | 管理策 | 工期 | 効果 |
|----------|-------|------|------|
| P1 | AC-2,3,4 / CR-1,2 / LG-1,2 / NW-2,3 | 2～4週 | 基盤セキュリティ |
| P2 | AC-5,9 / LG-4,7 / VN-1,2 / NW-8 | 4～6週 | 可視化・検知 |
| P3 | AC-13 / LG-12 / VN-3,6 / IR-1,2 | 6～10週 | 継続的改善 |
