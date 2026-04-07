---
artifact_id: BAK-001
title: バックアップ・DR設計書
version: 1.0
status: draft
author: infra-backup-dr
created_at: 2026-04-06
updated_at: 2026-04-06
phase: 4
dependencies:
  - artifact: REQ-001
    title: 要件定義書
    reason: RTO/RPO要件（住民ポータル RTO4h/RPO1h、庁内業務 RTO8h/RPO4h）
  - artifact: SEC-001
    title: セキュリティ設計書
    reason: KMS CMKによるバックアップ暗号化設計との整合
  - artifact: NW-001
    title: ネットワーク設計書
    reason: RDS Multi-AZ、フェイルオーバー時のDNS切替経路との連携
---

## 改訂履歴

| バージョン | 更新日 | 更新者 | 変更内容 |
|-----------|--------|--------|--------|
| 1.0 | 2026-04-06 | infra-backup-dr | 初版作成 |

---

## 1. 概要・目的

さくら市マイナンバーサービス基盤は住民向けポータル・庁内業務システム・バッチ処理の3システムをGC（AWS ap-northeast-1 東京）上で稼働させる。マイナンバー関連個人情報を取り扱う最重要基盤として、システム障害・データ消失・ランサムウェア攻撃等に対する強固な事業継続体制が求められる。

**目的:**
- RFP記載のRTO/RPO要件を達成するバックアップ戦略・DR構成を定義する
- AWS Backup・S3 CRR・RDS Multi-AZを組み合わせた統合バックアップ設計を提供する
- Pilot Light構成によるコスト効率の高いDR環境（大阪リージョン）を設計する
- 月次リストアテスト計画によりRTO/RPO達成の継続的な実証を担保する

---

## 2. バックアップ/DR設計方針

### 2.1 RTO/RPO要件と設計対応方針

| 対象システム | RTO要件 | RPO要件 | 設計対応 |
|------------|--------|--------|---------|
| 住民向けポータル | 4時間 | 1時間 | RDS Multi-AZ自動フェイルオーバー + Route 53ヘルスチェック。RPO1hはRDS PITR（継続WALアーカイブ）で対応 |
| 庁内業務システム | 8時間 | 4時間 | Pilot Light起動（RDSスナップショットリストア2〜3h + ECS展開1h）でRTO8h達成。RPO4hは日次バックアップ + RDS自動バックアップで対応 |
| バッチ処理 | 12時間 | 24時間 | Pilot Light起動 + 手動バッチ再実行でRTO12h達成。RPO24hは日次スナップショットで対応 |

### 2.2 DR戦略: Pilot Light採用

**採用理由:**
1. **RTO要件との適合性**: 住民ポータルのRTO4時間はウォームスタンバイを必要とするほど短くなく、コールドバックアップではRTO達成が困難。Pilot Lightが最適なバランス。
2. **コスト効率**: Active-Active（常時2リージョン稼働）と比較して大阪リージョンコストを約80%削減。
3. **マイナンバーシステムの特性**: 庁内業務・バッチはRTO8〜12hで許容されるため段階起動が有効。

**Pilot Light常時稼働コンポーネント（大阪）:**
- VPCネットワーク基盤（サブネット・SG・ルートテーブル）
- RDSスナップショット（自動複製）
- ECSタスク定義（登録済み・タスク数=0）
- S3バケット（CRRにより常時同期）
- AWS Backup Vault（複製先）

### 2.3 バックアップ保持期間ポリシー

| データ種別 | 頻度 | 保持（本番） | アーカイブ | 保存先 |
|----------|------|-----------|---------|------|
| RDS 自動バックアップ | 継続（PITR） | 35日 | - | AWS Backup / S3 |
| RDS 手動スナップショット | 日次 03:00 JST | 30日 | 1年（Glacier） | AWS Backup Vault |
| EBS スナップショット | 日次 02:00 JST | 30日 | 1年（Glacier） | AWS Backup Vault |
| S3 オブジェクト | バージョニング継続 | 無期限 | 1年後Glacier移行 | S3 + Glacier |
| ElastiCache スナップショット | 日次 01:00 JST | 7日 | - | ElastiCache内蔵 |

---

## 3. AWS Backup設計

### 3.1 バックアッププラン: `sakura-city-prod-backup-plan`

**ルール1: 日次バックアップ（30日保持）**

```json
{
  "RuleName": "DailyBackup-30days",
  "ScheduleExpression": "cron(0 18 * * ? *)",
  "StartWindowMinutes": 60,
  "CompletionWindowMinutes": 180,
  "Lifecycle": { "DeleteAfterDays": 30 },
  "DestinationBackupVaultName": "sakura-prod-vault",
  "CopyActions": [{
    "DestinationBackupVaultArn": "arn:aws:backup:ap-northeast-3:ACCOUNT_ID:backup-vault:sakura-dr-vault",
    "Lifecycle": { "DeleteAfterDays": 30 }
  }]
}
```

**ルール2: 月次アーカイブ（1年保持）**

```json
{
  "RuleName": "MonthlyArchive-1year",
  "ScheduleExpression": "cron(0 18 1 * ? *)",
  "Lifecycle": {
    "MoveToColdStorageAfterDays": 30,
    "DeleteAfterDays": 365
  },
  "DestinationBackupVaultName": "sakura-prod-vault"
}
```

### 3.2 バックアップボールト設計

#### 東京リージョン（Primary Vault）

| 設定項目 | 値 |
|---------|---|
| Vault名 | `sakura-prod-vault` |
| KMS CMK | プロジェクト専用CMK |
| アクセスポリシー | OrganizationDeny + 明示的Allow |
| Vault Lock | Compliance Mode（設定予定） |

**Vault アクセスポリシー:**

```json
{
  "Statement": [{
    "Sid": "DenyDeleteExceptAdmin",
    "Effect": "Deny",
    "Principal": "*",
    "Action": [
      "backup:DeleteBackupVault",
      "backup:DeleteRecoveryPoint",
      "backup:UpdateRecoveryPointLifecycle"
    ],
    "Resource": "*",
    "Condition": {
      "StringNotEquals": {
        "aws:PrincipalArn": "arn:aws:iam::ACCOUNT_ID:role/BackupAdminRole"
      }
    }
  }]
}
```

#### 大阪リージョン（DR Vault）

| 設定項目 | 値 |
|---------|---|
| Vault名 | `sakura-dr-vault` |
| KMS CMK | 大阪リージョン専用CMK |
| 用途 | 東京からのクロスリージョンバックアップ受信専用 |

---

## 4. RDS バックアップ設計

### 4.1 自動バックアップ設定

| 設定項目 | 値 | 備考 |
|---------|---|------|
| BackupRetentionPeriod | 35日 | RFP要件30日にマージン |
| PreferredBackupWindow | 17:00-18:00 UTC（02:00-03:00 JST） | 低トラフィック時間帯 |
| MultiAZ | true | フェイルオーバー対応 |
| StorageEncrypted | true | KMS CMK |
| DeletionProtection | true | 誤削除防止 |

### 4.2 ポイントインタイムリカバリ（PITR）

- **保持期間**: 35日間
- **復旧精度**: 5分単位
- **RPO達成**: 住民ポータルRPO=1時間、庁内RPO=4時間いずれも達成可能

```bash
# PITR実行例
aws rds restore-db-instance-to-point-in-time \
  --source-db-instance-identifier sakura-prod-postgres \
  --target-db-instance-identifier sakura-restore-test \
  --restore-time 2026-04-06T02:00:00Z \
  --db-instance-class db.r6g.large \
  --multi-az \
  --no-publicly-accessible
```

---

## 5. S3 レプリケーション設計

### 5.1 バケット構成

| バケット名 | リージョン | 役割 |
|----------|---------|------|
| `sakura-city-documents-prod-nrt` | ap-northeast-1（東京） | 住民提出PDF格納（Primary） |
| `sakura-city-documents-dr-kix` | ap-northeast-3（大阪） | CRRレプリカ（DR） |

### 5.2 S3 CRR設定（東京 → 大阪）

```json
{
  "Rules": [{
    "ID": "ReplicateAllToOsaka",
    "Status": "Enabled",
    "Destination": {
      "Bucket": "arn:aws:s3:::sakura-city-documents-dr-kix",
      "StorageClass": "STANDARD_IA",
      "ReplicationTime": {
        "Status": "Enabled",
        "Time": { "Minutes": 15 }
      },
      "Metrics": {
        "Status": "Enabled",
        "EventThreshold": { "Minutes": 15 }
      }
    }
  }]
}
```

- **RTC（Replication Time Control）**: 有効。99.99%のオブジェクトを15分以内に複製保証
- **S3 Object Lock（Compliance Mode）**: 30日保持。ランサムウェア対策

### 5.3 S3 ライフサイクルポリシー

```json
{
  "Rules": [{
    "ID": "ArchiveToGlacier",
    "Transitions": [
      { "Days": 30, "StorageClass": "GLACIER" },
      { "Days": 365, "StorageClass": "DEEP_ARCHIVE" }
    ]
  }]
}
```

---

## 6. ElastiCache バックアップ設計

| 設定項目 | 値 |
|---------|---|
| スナップショット保持期間 | 7日 |
| 取得時刻 | 毎日 01:00 JST |
| DR対応 | コールドスタート（RDSから再構築）|

ElastiCacheはキャッシュ用途のため、DR時はコールドスタート方式でRDSから再構築。キャッシュウォームアップ時間（約15分）をRTO計算に含む。

---

## 7. DR設計（Pilot Light構成）

### 7.1 東京/大阪の構成差分

| コンポーネント | 東京（Primary） | 大阪（DR: Pilot Light） |
|------------|--------------|---------------------|
| ECS Fargate | 稼働中 | タスク定義登録済み・タスク数=0 |
| RDS PostgreSQL | Multi-AZ稼働中 | スナップショット待機（常時複製） |
| ElastiCache Redis | クラスター稼働中 | 停止（フェイルオーバー時に起動） |
| S3 バケット | Primary（書き込み可能） | CRRレプリカ（読み取り専用） |
| ALB | 稼働中 | 設定済み・トラフィックなし |
| Route 53 | Primaryレコード（ヘルスチェック有効） | Secondaryフェイルオーバーレコード |
| VPC基盤 | 稼働中 | 稼働中（常時稼働） |

### 7.2 フェイルオーバー手順

**総所要時間見積もり（RTO達成計算）:**

| ステップ | 内容 | 所要時間 |
|---------|-----|---------|
| Step 1 | 障害確認・DR宣言 | 15分 |
| Step 2 | RDSスナップショットリストア | 90分 |
| Step 3 | ECSタスクスケールアウト | 30分 |
| Step 4 | ElastiCache起動 | 15分 |
| Step 5 | DNS切替確認 | 15分 |
| Step 6 | 動作確認・ユーザー通知 | 15分 |
| **合計** | | **180分（3時間）** |

住民ポータル RTO=4時間 → **3時間で達成（1時間マージン確保）**

**Step 2: RDS リストア**

```bash
SNAPSHOT_ARN=$(aws backup list-recovery-points-by-backup-vault \
  --backup-vault-name sakura-dr-vault \
  --region ap-northeast-3 \
  --query 'RecoveryPoints[?ResourceType==`RDS`] | sort_by(@, &CreationDate) | [-1].RecoveryPointArn' \
  --output text)

aws backup start-restore-job \
  --recovery-point-arn "${SNAPSHOT_ARN}" \
  --metadata '{"DBInstanceIdentifier":"sakura-dr-postgres","DBInstanceClass":"db.r6g.large","MultiAZ":"true","Engine":"postgres"}' \
  --iam-role-arn "arn:aws:iam::ACCOUNT_ID:role/BackupRestoreRole" \
  --resource-type RDS \
  --region ap-northeast-3
```

**Step 3: ECS スケールアウト**

```bash
aws ecs update-service \
  --cluster sakura-dr-cluster \
  --service sakura-portal-service \
  --desired-count 4 \
  --region ap-northeast-3

aws ecs update-service \
  --cluster sakura-dr-cluster \
  --service sakura-gyomu-service \
  --desired-count 2 \
  --region ap-northeast-3
```

**Step 5: Route 53 手動フェイルオーバー（自動切替未完了の場合）**

```bash
aws route53 change-resource-record-sets \
  --hosted-zone-id HOSTED_ZONE_ID \
  --change-batch '{
    "Changes": [{
      "Action": "UPSERT",
      "ResourceRecordSet": {
        "Name": "portal.sakura-city.lg.jp",
        "Type": "A",
        "TTL": 60,
        "ResourceRecords": [{"Value": "ALB_DNS_OSAKA"}]
      }
    }]
  }'
```

### 7.3 RPO達成データ同期設計

| リソース | 同期方式 | 実績RPO |
|---------|---------|--------|
| RDS PostgreSQL | PITR（35日保持、5分精度） | 5分。全RPO要件達成 |
| S3 バケット | S3 CRR（RTC有効、15分保証） | 15分。RPO1h達成 |
| ElastiCache | キャッシュのみ、RDSから再構築 | - |
| EBS | AWS Backup日次スナップショット | 最大24時間。バッチRPO24h達成 |

### 7.4 フェイルバック手順（東京復旧後）

1. 東京リージョンの障害解消を確認
2. 大阪RDSのスナップショット取得（フェイルオーバー後の更新データを保全）
3. 大阪S3の差分データを東京S3へ手動同期（CRRは一方向のため）
4. 東京RDSを大阪スナップショットからリストア
5. ECSを東京リージョンで再起動
6. Route 53のTTLを段階的に延長し東京へ切り戻し
7. 大阪DR環境のタスク数を0に戻す（Pilot Light状態に戻す）

---

## 8. リストアテスト設計

### 8.1 月次リストアテスト（毎月第2土曜日）

**09:00〜12:00: RDS リストアテスト**

```bash
# 前日スナップショットをステージング環境へリストア
SNAPSHOT_ARN=$(aws backup list-recovery-points-by-backup-vault \
  --backup-vault-name sakura-prod-vault \
  --query 'RecoveryPoints[?ResourceType==`RDS`] | sort_by(@, &CreationDate) | [-1].RecoveryPointArn' \
  --output text)

aws backup start-restore-job \
  --recovery-point-arn "${SNAPSHOT_ARN}" \
  --metadata '{"DBInstanceIdentifier":"sakura-restore-test","DBInstanceClass":"db.t3.medium","MultiAZ":"false"}' \
  --iam-role-arn "arn:aws:iam::ACCOUNT_ID:role/BackupRestoreRole" \
  --resource-type RDS
```

**検証項目:**

| 検証項目 | 合格基準 |
|---------|---------|
| RDSリストア完了時間 | 90分以内 |
| データ整合性（レコード件数） | 本番との差 0.01%以内 |
| アプリケーション接続確認 | HTTP 200 |
| PITRテスト（1時間前時点） | 指定時刻データの正確な復元 |

**13:00〜15:00: S3 CRR到達確認**

| 検証項目 | 合格基準 |
|---------|---------|
| CRRオブジェクト到達 | 15分以内に大阪到達 |
| Object Lock保護確認 | 保持期間内オブジェクト削除が拒否される |

### 8.2 年次DRフェイルオーバーテスト（4月・10月）

ステージング環境を使ったDR全体フローのテストを年2回実施。実RTO計測・業務動作確認・フェイルバック手順検証。

---

## 9. バックアップ監視設計

### 9.1 CloudWatch アラーム

| アラーム名 | メトリクス | 閾値 | 通知先 |
|----------|---------|-----|------|
| `BackupJobFailed-sakura-prod` | NumberOfBackupJobsFailed | ≥1 | `sakura-backup-alert` SNS |
| `S3-CRR-ReplicationLatency-High` | ReplicationLatency | >900秒 | `sakura-backup-alert` SNS |
| `RDS-AutoBackup-Disabled` | Config Rule NON_COMPLIANT | - | `sakura-security-alert` SNS |

### 9.2 AWS Config ルール

| Config Rule | 目的 |
|------------|-----|
| `rds-automatic-backups-enabled` | RDS自動バックアップ有効確認 |
| `rds-multi-az-support` | Multi-AZ有効確認 |
| `s3-bucket-versioning-enabled` | S3バージョニング有効確認 |
| `s3-bucket-replication-enabled` | S3 CRR有効確認 |
| `encrypted-volumes` | EBS暗号化確認 |
| `backup-plan-min-frequency-and-min-retention-check` | バックアップ頻度・保持期間確認 |

---

## 10. 費用試算

| カテゴリ | 月額概算 | 年額概算 |
|---------|---------|---------|
| 東京バックアップストレージ（RDS/EBS/S3） | 約 $190/月 | 約 $2,280/年 |
| 大阪DR（Pilot Light常時稼働） | 約 $76/月 | 約 $912/年 |
| CloudWatch・Config監視 | 約 $30/月 | 約 $360/年 |
| **合計（通常時）** | **約 $296/月** | **約 $3,552/年** |

**参考: Active-Active比較**
- Active-Active追加コスト: 推定 +$1,700〜$2,000/月
- **Pilot Light採用による削減効果: 約85%削減**

---

## 11. リスク・制限事項

| リスク | 影響 | 確率 | 対応策 |
|------|-----|-----|------|
| RDSリストア時間が90分超過（DB増大時） | 高 | 中 | 半年ごとにリストア時間計測、インスタンスサイズ調整 |
| S3 CRR遅延（大量アップロード時） | 中 | 低 | RTCで99.99%を15分以内保証 |
| Pilot Light環境のIaCドリフト | 中 | 中 | 月次Drift Detection、年2回DR訓練 |
| Object Lock設定後のバケット削除不可 | 中 | 低 | 設定前にプロジェクト責任者承認必須 |

---

## 付録 A: バックアップスケジュール一覧

| 時刻（JST） | 実行内容 | 対象 |
|-----------|--------|------|
| 01:00 | ElastiCacheスナップショット | 本番Redisクラスター |
| 02:00 | EBSスナップショット（AWS Backup） | 全本番EBSボリューム |
| 03:00 | RDS手動スナップショット（AWS Backup） | 本番RDSインスタンス |
| 03:00〜04:00 | クロスリージョン複製（→大阪） | 上記スナップショット |
| 継続 | S3 CRR（オブジェクト変更時即時） | 住民提出PDFバケット |
| 継続 | RDS自動バックアップ（トランザクションログ） | 本番RDSインスタンス |

## 付録 B: IAM ロール設計（バックアップ用）

| ロール名 | 用途 | ポリシー |
|---------|-----|--------|
| `BackupAdminRole` | AWS Backupプラン管理 | AWSBackupFullAccess |
| `BackupRestoreRole` | リストアジョブ実行 | AWSBackupServiceRolePolicyForRestores |
| `S3ReplicationRole` | S3 CRR実行 | S3レプリケーション用カスタムポリシー |
