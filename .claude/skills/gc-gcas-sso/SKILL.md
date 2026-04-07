---
description: GCAS-SSO設定（CEP設定、MFA要件、IdP連携、ロール設計）
---

# GCAS-SSO設定ガイド

## GCAS（Google Cloud Assured Secure Services）申請プロセス

### 申請条件
- 対象: 金融機関、医療機関、公共機関等のセキュリティ高要求業種
- 申請期間: 通常 3～6ヶ月
- 審査項目:
  - 組織形態（会社登記簿）
  - セキュリティポリシー
  - インシデント対応計画
  - 監査ログ保全方法

### 申請必須要件
- GC Organizations 構成の事前設計
- IAM ロール設計（最小権限ベース）
- SSO 統合方針の明記

## CEP（Compliance Environment Program）設定

### CEP とは
GC 環境のセキュリティをさらに強化するための環境設定パッケージ

### CEP 有効化に必要な事前準備

| 項目 | 説明 | 実施主体 |
|-----|------|--------|
| **Organizations 構成** | Landing Zone に準拠した Org構成 | GC環境設計 |
| **IAM Policy** | SCP による権限制限 | Organizations 管理者 |
| **VPC Flow Logs** | ネットワークログ取得 | ネットワーク運用 |
| **CloudTrail** | API 監査ログ取得 | セキュリティ運用 |
| **GuardDuty** | 脅威検知サービス有効化 | セキュリティ運用 |
| **Security Hub** | セキュリティ統合ダッシュボード | セキュリティ運用 |
| **Config** | リソース構成監視 | ガバナンス運用 |

## IdP連携パターン

### パターン1: Azure AD（Microsoft Entra ID）連携

**適用シーン**: Microsoft 365 既導入企業

**設定フロー**:
```
Azure AD
    ↓
Google Cloud Identity（IdentityDomain）
    ↓
Organizations
    ↓
IAM ロール割当
```

**設定項目**:
```yaml
Azure AD側:
  - Application登録（GC側）
  - ClientID, ClientSecret取得
  - Redirect URI: https://accounts.google.com/o/oauth2/v2/auth/callback
  - 同期対象ユーザー: セキュリティグループで制御

GC Identity側:
  - IdP連携設定（SAML or OIDC）
  - ユーザーシンク設定
  - グループシンク設定
  - 属性マッピング
```

### パターン2: Okta 連携

**適用シーン**: Okta をコーポレート IdP として利用

**設定フロー**: Azure AD と同様だが、Okta アプリケーション側での設定

**Okta側アプリケーション設定例**:
```
App Name: Google Cloud
SSO方式: SAML 2.0
Identity Provider Issuer: https://okta-company.okta.com
Single Sign-On URL: https://accounts.google.com/...
Entity ID: https://accounts.google.com/...
```

### パターン3: Google Cloud Identity 単体（IdP統合なし）

**適用シーン**: 新規導入、IdP 統合不要

**メリット**: シンプル
**デメリット**: 既存ID管理システムとの同期なし、手動管理

## SSO 統合に必須の情報収集

| 項目 | 入手先 | 利用目的 |
|-----|-------|--------|
| **IdP Metadata URL** | IdP 管理画面 | GC Identity 側の連携設定 |
| **Entity ID / Issuer** | IdP | SAML/OIDC 認証フロー |
| **Certificate** | IdP | 署名検証 |
| **同期対象ユーザー一覧** | 人事システム | 初期同期 |
| **グループマッピング表** | ドメイン設計 | GC IAM ロール割当 |

## MFA（多要素認証）方針

### MFA レベル別の導入

| レベル | 実装 | 対象 | 段階 |
|-------|------|------|------|
| **必須** | TOTP（Authenticator アプリ）+ Passkey | 管理者全員、特権ユーザー | 初期導入時 |
| **推奨** | TOTP + Security Key（YubiKey等） | 全従業員 | 導入後1-2ヶ月 |
| **オプション** | 物理的な Passkey | 超高権限ユーザー | 3ヶ月以降 |

### 導入スケジュール例

```
Week 1-2: 管理者のみ MFA 必須化
  └─ 機器配布、設定サポート

Week 3-4: 全従業員に MFA 推奨通知
  └─ オプショナル期間（1ヶ月）

Week 5-8: 全従業員に MFA 必須化へ段階的移行
  └─ ヘルプデスク対応体制整備

Week 9+: セキュリティキー導入推進
  └─ 超高権限ユーザーから実施
```

## IAM ロール設計（SSO連携時）

### Azure AD グループ ← → GC IAM ロール マッピング例

```yaml
Azure AD Security Groups:
  - GCP-Admin-Team          # Organizations 管理者
  - GCP-Network-Team        # ネットワーク設計・運用
  - GCP-Security-Team       # セキュリティ運用
  - GCP-App-Dev-Team        # アプリケーション開発者
  - GCP-Finance-Auditors    # 監査・経理

↓ (属性マッピング)

GC IAM Roles:
  GCP-Admin-Team
    └─ Organizations Policy Administrator (Root)
       Project Editor (Network, Logging, Security projects)

  GCP-Network-Team
    └─ Project Editor (Network project)
       Compute Network Admin
       Cloud DNS Admin

  GCP-Security-Team
    └─ Project Editor (Security project)
       Security Admin
       CloudTrail/Config Editor

  GCP-App-Dev-Team
    └─ Project Editor (Application projects)
       Compute Instance Admin
       Cloud SQL Admin (適切なデータベースのみ)

  GCP-Finance-Auditors
    └─ Viewer (Organizations)
       Billing Account Viewer
```

### ロール設定上の注意点

- **Permission Boundary**: 開発者に過度な権限を付与しない
- **条件付きロール**: 特定時間帯・IPアドレス範囲のみ権限有効化
  ```json
  {
    "bindings": [
      {
        "role": "roles/compute.admin",
        "members": ["group:gcp-app-dev-team@company.iam.gserviceaccount.com"],
        "condition": {
          "expression": "resource.name.startsWith('projects/prod-') && request.time.getHours('America/New_York') >= 9 && request.time.getHours('America/New_York') <= 17"
        }
      }
    ]
  }
  ```

## SSO 統合のセキュリティチェックリスト

- [ ] IdP との通信が HTTPS で暗号化
- [ ] SAML Assertion に署名が有効
- [ ] ユーザーシンク周期が明記（日次 or リアルタイム）
- [ ] 自動脱活（離職時のアカウント無効化）フロー が定義
- [ ] MFA 要件が明記（全員必須か、ロール別か）
- [ ] 管理者アカウント（バックドア用）が別途準備
- [ ] SSO 障害時の緊急アクセス手順が文書化
- [ ] ロール変更（昇進・異動）時の自動更新フロー が実装

## CEP 設定チェックリスト

- [ ] Organizations Policy (SCP) が GC CEP 推奨設定に準拠
- [ ] IAM Access Analyzer が有効化
- [ ] VPC Flow Logs が全 VPC で有効化
- [ ] CloudTrail が Organizations 単位で有効化
- [ ] CloudTrail ログが S3 + Glacier で永続保管
- [ ] GuardDuty が有効化、通知設定完了
- [ ] Security Hub が有効化、カスタムルール設定完了
- [ ] Config Rules が GC 推奨ルール で設定
- [ ] Abnormal Behavior Detection が有効化
