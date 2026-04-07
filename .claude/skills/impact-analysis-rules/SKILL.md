---
description: 成果物間の依存関係マップ（要件→設計→IaC→テストのトレーサビリティ）、変更種別ごとの影響波及パターン
---

# インパクト分析ルール

## 1. 成果物依存関係マップ

### 1.1 全体依存図

```
要件フェーズ
  ├─ 業務要件定義書 (REQ-001)
  ├─ 非機能要件定義書 (NF-REQ-001)
  └─ 現行システム調査書 (AS-IS-001)
       ↓ [依存]
       ↓
設計フェーズ
  ├─ ネットワーク設計書 (NET-DESIGN-001)
  │   ├─ VPC / Subnet 設計
  │   ├─ ルーティング設計
  │   ├─ セキュリティグループ設計
  │   └─ DNS 設計
  ├─ セキュリティ設計書 (SEC-DESIGN-001)
  │   ├─ IAM 設計
  │   ├─ 暗号化戦略
  │   └─ ネットワークセキュリティ
  ├─ 監視・ログ設計書 (MON-DESIGN-001)
  │   ├─ メトリクス設計
  │   ├─ ログ集約設計
  │   └─ アラーム設計
  ├─ バックアップ・DR 設計書 (BACKUP-DESIGN-001)
  │   ├─ バックアップ戦略
  │   ├─ RPO / RTO 設定
  │   └─ リストア手順
  └─ コスト最適化設計書 (COST-DESIGN-001)
       ├─ リソースサイジング
       ├─ 利用方式（オンデマンド / RI / Savings Plans）
       └─ コスト監視設計
       ↓ [依存]
       ↓
実装フェーズ
  ├─ Terraform / CloudFormation コード (IaC)
  │   ├─ network.tf (ネットワーク設計に対応)
  │   ├─ security.tf (セキュリティ設計に対応)
  │   ├─ compute.tf (コンピュート設計に対応)
  │   ├─ database.tf (DB設計に対応)
  │   ├─ monitoring.tf (監視設計に対応)
  │   ├─ backup.tf (バックアップ設計に対応)
  │   └─ variables.tf (全設計値を変数化)
  ├─ 環境構築手順書 (BUILD-PROCEDURE)
  ├─ IaC デプロイメント手順書 (IaC-DEPLOY)
  └─ 構成管理レジストリ (CMR)
       ↓ [依存]
       ↓
テストフェーズ
  ├─ テスト計画書 (TEST-PLAN)
  │   ├─ 単体テスト計画
  │   ├─ 結合テスト計画
  │   ├─ 性能テスト計画
  │   └─ セキュリティテスト計画
  ├─ テストケース定義書 (TEST-CASE)
  │   ├─ ネットワーク疎通テスト
  │   ├─ セキュリティテスト
  │   ├─ 監視テスト
  │   └─ バックアップ・DR テスト
  └─ テスト実行ログ / 結果報告書 (TEST-RESULT)
       ↓ [依存]
       ↓
移行・運用フェーズ
  ├─ 移行計画書 (MIGRATION-PLAN)
  ├─ 移行手順書 (MIGRATION-PROCEDURE)
  ├─ Go/No-Go チェックリスト (GO-NOGO-CHECKLIST)
  ├─ Runbook / 運用手順書 (RUNBOOK)
  ├─ 監視・アラート設定 (MONITORING-CONFIG)
  └─ 料金最適化ガイドライン (COST-GUIDE)
```

---

## 2. 成果物の詳細な依存関係テーブル

### 2.1 要件 → 設計への影響

| 要件 ID | 要件内容 | 影響を受ける設計書 | 具体的な影響 |
|--------|--------|-----------------|-----------|
| REQ-001 | システムは東京リージョンで動作 | NET-DESIGN-001 | VPC リージョン = ap-northeast-1 |
| REQ-002 | ユーザ数 10,000 名（ピーク時） | COST-DESIGN-001 | EC2 インスタンスタイプ / 数を決定 |
| NF-REQ-003 | SLA: 99.5% / 月 | BACKUP-DESIGN-001, MON-DESIGN-001 | Multi-AZ 構成、RTO 1時間以内 |
| NF-REQ-004 | API レスポンス < 500ms | COST-DESIGN-001, NET-DESIGN-001 | キャッシュサーバ（ElastiCache）導入 |
| NF-REQ-005 | ISMAP 準拠 | SEC-DESIGN-001 | 暗号化 / ログ / IAM の詳細設定 |
| NF-REQ-006 | オンプレとの通信必須 | NET-DESIGN-001 | DirectConnect / VPN トンネル構築 |
| NF-REQ-007 | データ保持期間 7 年 | BACKUP-DESIGN-001 | S3 長期保存（Glacier への遷移） |
| NF-REQ-008 | 決済情報を扱う（PCI DSS準拠） | SEC-DESIGN-001 | HSM / 専有サーバ検討 |

### 2.2 設計 → IaC への影響

| 設計書 | 設計項目 | 対応する IaC ファイル | 具体的な IaC リソース |
|--------|--------|------------------|------------------|
| NET-DESIGN-001 | VPC CIDR: 10.0.0.0/16 | network.tf | aws_vpc (cidr_block = "10.0.0.0/16") |
| NET-DESIGN-001 | Subnet A (Public): 10.0.1.0/24 | network.tf | aws_subnet (cidr_block = "10.0.1.0/24", map_public_ip = true) |
| NET-DESIGN-001 | Subnet B (Private): 10.0.10.0/24 | network.tf | aws_subnet (cidr_block = "10.0.10.0/24", map_public_ip = false) |
| NET-DESIGN-001 | インターネットゲートウェイ | network.tf | aws_internet_gateway |
| NET-DESIGN-001 | NAT ゲートウェイ | network.tf | aws_nat_gateway |
| SEC-DESIGN-001 | IAM ロール: EC2-API-Role | security.tf | aws_iam_role (name = "EC2-API-Role") |
| SEC-DESIGN-001 | IAM ポリシー: S3 ReadOnly | security.tf | aws_iam_policy_attachment |
| SEC-DESIGN-001 | KMS 鍵 (EBS 暗号化用) | security.tf | aws_kms_key (description = "EBS Encryption Master Key") |
| MON-DESIGN-001 | CloudWatch メトリクス: CPU | monitoring.tf | aws_cloudwatch_metric_alarm (metric_name = "CPUUtilization") |
| MON-DESIGN-001 | CloudWatch Logs グループ | monitoring.tf | aws_cloudwatch_log_group (name = "/aws/ec2/app-logs") |
| BACKUP-DESIGN-001 | RDS バックアップ保持期間 7 日 | database.tf | aws_db_instance (backup_retention_period = 7) |
| COST-DESIGN-001 | EC2 インスタンスタイプ t3.large | compute.tf | aws_instance (instance_type = "t3.large") |

### 2.3 IaC → テストへの影響

| IaC ファイル | リソース | 影響を受けるテスト | テストケース例 |
|-----------|---------|-----------------|-----------|
| network.tf | Security Group (ingress 443) | セキュリティテスト TC-SEC-001 | HTTPS 通信 OK、HTTP は拒否 |
| network.tf | Route Table (10.0.1.0/24 → IGW) | ネットワーク疎通テスト TC-NET-002 | Public Subnet から インターネット出力確認 |
| security.tf | IAM Role AssumePolicy | IAM テスト TC-IAM-005 | AssumeRole で別ロール引き継ぎ確認 |
| monitoring.tf | CloudWatch Alarm (CPU > 80%) | 監視テスト TC-MON-002 | CPU 80% 超過でアラーム発火 |
| database.tf | RDS Multi-AZ | DR テスト TC-DR-001 | Primary AZ 停止 → Secondary AZ へ自動フェイルオーバー |

---

## 3. 変更の種別ごとの影響波及パターン

### 3.1 変更パターン: ネットワーク CIDR 変更

**変更内容**: VPC CIDR を 10.0.0.0/16 → 10.10.0.0/16 に変更

**影響波及ツリー**:

```
変更: VPC CIDR 変更 (10.0.0.0/16 → 10.10.0.0/16)
  ├─ [設計書への影響]
  │   ├─ ネットワーク設計書 (NET-DESIGN-001)
  │   │   ├─ VPC セクション: CIDR 値更新
  │   │   ├─ Subnet セクション: 全 CIDR 値更新
  │   │   ├─ ルーティング設計: Route Table 全行更新
  │   │   └─ オンプレ連携 DirectConnect: BGP Peer アドレス再設定
  │   └─ セキュリティ設計書 (SEC-DESIGN-001)
  │       └─ オンプレ側ファイアウォール ACL: 許可 CIDR 値更新
  │
  ├─ [IaC への影響]
  │   ├─ network.tf
  │   │   ├─ aws_vpc cidr_block = "10.10.0.0/16"
  │   │   ├─ aws_subnet cidr_block の全値更新（AZ 毎）
  │   │   ├─ aws_route_table の全ルート更新
  │   │   ├─ aws_ec2_network_insights_path (traffic から の更新)
  │   │   └─ aws_vpn_gateway route propagation の再設定
  │   ├─ security.tf
  │   │   └─ aws_security_group ingress rules (cidr_blocks更新)
  │   └─ database.tf
  │       └─ aws_db_subnet_group (subnet_ids 再指定)
  │
  ├─ [テストへの影響]
  │   ├─ テスト計画書 (TEST-PLAN) - 更新
  │   ├─ ネットワーク疎通テスト (TC-NET-001～007)
  │   │   └─ テストケース CIDR 値を新値で再実施
  │   ├─ セキュリティテスト (TC-SEC-*)
  │   │   └─ セキュリティグループ ルール再検証
  │   └─ DR テスト (TC-DR-*)
  │       └─ フェイルオーバー時の ルーティング確認
  │
  ├─ [移行への影響]
  │   ├─ 移行計画書 (MIGRATION-PLAN)
  │   │   └─ Phase 1: VPC 再作成手順追加
  │   ├─ Go/No-Go チェックリスト
  │   │   ├─ DirectConnect 接続確認 (新 CIDR で)
  │   │   ├─ ファイアウォール ACL 更新確認 (オンプレ側)
  │   │   └─ 全ての疎通テストクリア確認
  │   └─ Runbook / 運用手順書
  │       └─ トラブルシューティング例: CIDR 競合による通信失敗
  │
  └─ [工数への影響]
      ├─ 設計書修正: 4 時間
      ├─ IaC 修正（Terraform 再実行）: 8 時間
      ├─ テスト実施: 12 時間
      ├─ 環境構築（新VPC）: 6 時間
      ├─ データ移行: 8 時間
      ├─ 移行リハーサル: 4 時間
      └─ 合計: 42 時間（1 週間）
```

---

### 3.2 変更パターン: RDS インスタンスタイプ変更

**変更内容**: RDS db.t3.medium → db.m5.large に変更

**影響波及ツリー**:

```
変更: RDS インスタンスタイプ変更 (t3.medium → m5.large)
  ├─ [設計書への影響]
  │   ├─ コスト最適化設計書 (COST-DESIGN-001)
  │   │   ├─ DB リソース価格: 更新
  │   │   └─ 月額コスト試算: 更新
  │   ├─ 性能設計書（あれば）
  │   │   ├─ DB スペック表: vCPU / メモリ更新
  │   │   └─ 想定スループット: 更新
  │   └─ バックアップ設計書 (BACKUP-DESIGN-001)
  │       └─ バックアップサイズ推定: わずか影響
  │
  ├─ [IaC への影響]
  │   └─ database.tf
  │       └─ aws_db_instance instance_class = "db.m5.large"
  │
  ├─ [テストへの影響]
  │   ├─ テスト計画書: 性能テスト項目を修正（期待スループット上方修正）
  │   ├─ 性能テスト (TC-PERF-001)
  │   │   ├─ DB クエリレスポンスタイム再測定
  │   │   ├─ 同時接続数テスト再実施（コネクション数上限拡大）
  │   │   └─ バルク書き込みテスト再実施（スループット向上確認）
  │   └─ ダウンタイムテスト
  │       └─ インスタンス変更時の停止時間測定（通常 1-2 分）
  │
  ├─ [移行への影響]
  │   ├─ 移行計画書: DB インスタンスタイプ変更メンテナンス時間追加
  │   ├─ 移行手順書: メンテナンス時間中のダウンタイム対応（必要な場合）
  │   └─ Go/No-Go チェックリスト
  │       ├─ db.m5.large インスタンス起動確認
  │       ├─ 新インスタンスでの接続確認
  │       └─ 性能テスト基準クリア確認
  │
  ├─ [運用への影響]
  │   ├─ Runbook: メンテナンス手順 に メモリ監視アラート値更新項目追加
  │   └─ コスト監視: 月額コスト目標値更新（+X 万円）
  │
  └─ [工数への影響]
      ├─ 設計書修正: 1 時間
      ├─ IaC 修正: 0.5 時間
      ├─ テスト実施: 6 時間（性能テスト再実施）
      ├─ メンテナンス実行: 0.5 時間（ダウンタイム）
      └─ 合計: 8 時間
```

---

### 3.3 変更パターン: セキュリティグループ ルール追加

**変更内容**: DB セキュリティグループに、新しいアプリケーション サーバからの通信許可を追加

**影響波及ツリー**:

```
変更: DB セキュリティグループ ルール追加
      (ingress rule: app-sg-new → port 5432)
  ├─ [設計書への影響]
  │   └─ セキュリティ設計書 (SEC-DESIGN-001)
  │       ├─ セキュリティグループ セクション: DB-SG ルール更新
  │       └─ ネットワークセキュリティ図: 更新
  │
  ├─ [IaC への影響]
  │   ├─ security.tf
  │   │   └─ aws_security_group_rule (ingress, source: app-sg-new, port: 5432)
  │   └─ （compute.tf 内に新アプリ SG の定義が既に存在）
  │
  ├─ [テストへの影響]
  │   ├─ セキュリティテスト (TC-SEC-*)
  │   │   ├─ TC-SEC-002: 新アプリ SG から DB へのポート 5432 接続確認 → 成功
  │   │   ├─ TC-SEC-003: 他の SG からの同ポート接続 → 拒否
  │   │   └─ TC-SEC-004: 異なるポート（5433 など）へのアクセス → 拒否確認
  │   └─ 結合テスト (TC-INT-*)
  │       └─ 新アプリ → DB への通信確認
  │
  ├─ [移行への影響]
  │   ├─ 移行計画書: 新アプリサーバのセキュリティグループ設定 をフェーズに追加
  │   └─ Go/No-Go チェックリスト: セキュリティグループ ルール確認項目追加
  │
  └─ [工数への影響]
      ├─ 設計書修正: 0.5 時間
      ├─ IaC 修正: 0.25 時間
      ├─ テスト実施: 2 時間
      └─ 合計: 2.75 時間
```

---

## 4. IaC への影響分析テンプレート

```
【IaC 変更影響分析】

変更内容: [変更の概要]
要件 ID: [対応する要件]
影響度: [高 / 中 / 低]

【1. 変更対象リソース】
  - Terraform Module: [module-name]
  - 影響ファイル: [file.tf]
  - 変更リソース数: [N個]

  | リソース種別 | リソース ID | 変更内容 | 理由 |
  |-----------|-----------|--------|------|
  | aws_xxx | resource-id-1 | プロパティ変更 | 仕様変更対応 |

【2. 関連リソースへの波及効果】
  - 依存リソース: [list]
  - 再作成が必要なリソース: [list]
  - Rolling Update で対応可能なリソース: [list]

【3. テストへの影響】
  - 再実施必須テスト: [list]
  - 影響度が高いテスト: [list]

【4. デプロイ時のダウンタイム】
  - 予定ダウンタイム: [XXX 分]
  - リカバリ手順: [list]

【5. ロールバック計画】
  - ロールバック実行時間: [XXX 分]
  - 既存バックアップ: [あり / なし]
  - 復帰可能状態: [確認 / 未確認]

【6. 追加工数見積】
  - IaC 修正: [X 時間]
  - テスト実施: [X 時間]
  - デプロイ・検証: [X 時間]
  - 合計: [X 時間]
```

---

## 5. 影響分析チェックリスト

```
【影響分析チェックリスト】

□ 変更内容を明確に言語化した
□ 関連する全設計書を確認した
□ IaC への影響を把握した
□ テストケースの再検討を行った
□ 工数を見積もった
□ リスク評価を実施した
□ ロールバック計画を立案した
□ ステークホルダーに報告した
□ 承認を得た
```

