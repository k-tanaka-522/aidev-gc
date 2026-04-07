---
description: GC推奨構成のコスト算定パターン（小規模/中規模/大規模の参考構成と概算コスト）
---

# GC推奨構成とコスト算定

## 小規模構成（Web+DB、100～1000ユーザー）

### アーキテクチャ

```
インターネット
    ↓
Route53 (DNS)
    ↓
CloudFront (CDN)
    ↓
ALB (1台)
    ↓
EC2 (2台, t3.small, Auto Scaling 1～3台)
    ↓
RDS (db.t3.micro, Single-AZ, 20GB)
    ↓
ElastiCache (1台, cache.t3.micro, オプション)
    ↓
S3 (ログ, 静的コンテンツ)
```

### リソース構成表

| リソース | 仕様 | 数量 | 月額費用 |
|---------|------|------|--------|
| **EC2** | t3.small | 2台 | ¥4,400 |
| **RDS** | db.t3.micro, gp2, 20GB | 1台 | ¥3,000 |
| **ALB** | Standard | 1台 | ¥2,000 |
| **NAT Gateway** | 1 AZ | 1台 | ¥3,200 |
| **CloudFront** | 10GB/月, 100K req | 1 | ¥2,000 |
| **Route53** | Hosted Zone, 1M queries | 1 | ¥500 |
| **S3** | ログ 10GB, 静的 5GB | 1 | ¥500 |
| **Data Transfer** | Out: 50GB/月 | - | ¥5,000 |
| **CloudWatch** | ログ 1GB/月 | - | ¥500 |
| **バックアップ** | - | - | ¥1,000 |
| | **合計（On-Demand）** | | **¥22,100** |
| | **1年 RI 適用後** | | **¥12,660** (43%削減) |

### RI/Savings Plans 推奨

```
EC2 t3.small ×2台:
  On-Demand: ¥4,400/月
  1年 RI: ¥2,640/月 (40%削減)

RDS db.t3.micro:
  On-Demand: ¥3,000/月
  1年 RI: ¥1,800/月 (40%削減)

購入推奨:
  ✓ EC2 1年 RI (前払い ¥31,680)
  ✓ RDS 1年 RI (前払い ¥21,600)
  合計投資: ¥53,280
  年間削減: ¥20,640 (30%削減)
```

## 中規模構成（マイクロサービス、1000～10000ユーザー）

### アーキテクチャ

```
インターネット
    ↓
CloudFront + WAF
    ↓
ALB (2台, Multi-AZ)
    ↓
ECS Cluster (3～10台, t3.medium, Auto Scaling)
    ├─ Web Service (3～5台)
    ├─ API Service (2～4台)
    └─ Worker Service (1～2台)
    ↓
RDS (db.t3.small, Multi-AZ, 100GB)
    ↓
ElastiCache (cache.t3.small, 2ノード)
    ↓
S3 (ユーザーファイル 50GB, ログ 100GB)
    ↓
ECR (コンテナイメージ)
    ↓
CloudWatch Logs + CloudWatch Dashboard
    ↓
AWS Backup (日次)
```

### リソース構成表

| リソース | 仕様 | 数量 | 月額費用 |
|---------|------|------|--------|
| **ECS + EC2** | t3.medium | 6台 (Avg) | ¥15,000 |
| **RDS** | db.t3.small, Multi-AZ, 100GB | 1 | ¥8,000 |
| **ALB** | Multi-AZ | 1 | ¥3,200 |
| **NAT Gateway** | 2 AZ | 2 | ¥6,400 |
| **ElastiCache** | cache.t3.small, 2ノード | 1 | ¥4,500 |
| **CloudFront** | 100GB/月, 1M req | 1 | ¥15,000 |
| **Route53** | Hosted Zone | 1 | ¥500 |
| **S3** | ユーザーファイル 50GB, ログ 100GB | 1 | ¥5,000 |
| **ECR** | プライベートレポジトリ, 30GB | 1 | ¥2,000 |
| **CloudWatch** | ログ 10GB/月, ダッシュボード | - | ¥5,000 |
| **Data Transfer** | Out: 200GB/月 | - | ¥20,000 |
| **AWS Backup** | RDS+S3 日次, 保持 7日 | - | ¥3,000 |
| | **合計（On-Demand）** | | **¥87,600** |
| | **Savings Plans 30% 適用後** | | **¥61,320** |

### RI/Savings Plans 推奨

```
ECS (t3.medium ×6台):
  On-Demand: ¥15,000/月
  Savings Plans (30%): ¥10,500/月

RDS (db.t3.small, Multi-AZ):
  On-Demand: ¥8,000/月
  1年 RI (35%): ¥5,200/月

ElastiCache (cache.t3.small ×2):
  On-Demand: ¥4,500/月
  1年 RI (40%): ¥2,700/月

推奨購入:
  ✓ Compute Savings Plans (1年, ¥10,500/月)
  ✓ RDS RI (1年, ¥62,400前払い)
  ✓ ElastiCache RI (1年, ¥32,400前払い)

  合計投資: ¥94,800
  年間削減: ¥26,400 (30%)
```

## 大規模構成（エンタープライズ、10000+ユーザー）

### アーキテクチャ

```
複数リージョン (Primary + DR):

【東日本リージョン (Primary)】
インターネット
    ↓
CloudFront (グローバル)
    ↓
Application Load Balancer (3台, Multi-AZ)
    ↓
ECS Cluster (20～50台, c5.xlarge, Auto Scaling)
├─ Web / API / Batch services (複数)
├─ Machine Learning Inference (GPU: g4dn.xlarge)
└─ Data Processing (Spark, PySpark)
    ↓
RDS (db.r5.2xlarge, Multi-AZ, 500GB)
    ├─ Read Replica (Read-heavy)
    └─ Aurora Global Database (DR用)
    ↓
ElastiCache (Cluster Mode, 10ノード, cache.r5.large)
    ↓
S3 (500GB+, Cross-Region Replication)
    ↓
OpenSearch (ログ分析, 3ノード)
    ↓
CloudWatch + DataDog/Splunk (SIEM)
    ↓
AWS Backup (継続的, 複数リージョン)
    ↓
AWS DMS (DB Migration, もし Hybrid)

【西日本リージョン (DR)】
  同等構成（本番トラフィックの 20%）
```

### リソース構成表

| リソース | 仕様 | 数量 | 月額費用 |
|---------|------|------|--------|
| **ECS + EC2 (Primary)** | c5.xlarge | 20台 (Avg) | ¥80,000 |
| **ECS + EC2 (DR)** | c5.xlarge | 4台 (Avg) | ¥16,000 |
| **RDS (Primary)** | db.r5.2xlarge, Multi-AZ, 500GB | 1 | ¥35,000 |
| **RDS (DR)** | db.r5.2xlarge, Multi-AZ, 500GB | 1 | ¥35,000 |
| **Aurora Global DB** | 同期レプリケーション | 1 | ¥10,000 |
| **RDS Read Replica** | db.r5.xlarge (Primary) | 2 | ¥20,000 |
| **ElastiCache** | cache.r5.large, Cluster Mode, 10ノード | 1 | ¥35,000 |
| **ALB (Primary)** | Multi-AZ | 2 | ¥6,400 |
| **ALB (DR)** | Multi-AZ | 1 | ¥3,200 |
| **NAT Gateway** | Primary 3AZ, DR 2AZ | 5 | ¥16,000 |
| **CloudFront** | 1TB/月, 10M req | 1 | ¥80,000 |
| **Route53** | Hosted Zone, DNS Failover | 2 | ¥1,000 |
| **S3** | ユーザーファイル 500GB, ログ 500GB, CRR | 1 | ¥30,000 |
| **ECR** | プライベートレポジトリ, 100GB | 1 | ¥5,000 |
| **OpenSearch** | t3.small, 3ノード, 500GB storage | 1 | ¥8,000 |
| **GPU (g4dn.xlarge)** | ML Inference, Part-time | 2 | ¥25,000 |
| **CloudWatch** | ログ 50GB/月, Custom Metrics | - | ¥20,000 |
| **Data Transfer** | Out: 1TB/月, Cross-Region | - | ¥100,000 |
| **AWS Backup** | 複数リージョン, 保持 30日 | - | ¥15,000 |
| **DirectConnect** | 10Gbps, 東京-大阪 | 1 | ¥50,000 |
| | **合計（On-Demand）** | | **¥595,600** |
| | **RI/SP 50% 適用後** | | **¥297,800** |

### RI/Savings Plans 推奨

```
ECS (c5.xlarge ×24台):
  On-Demand: ¥96,000/月
  3年 RI (55%): ¥43,200/月
  → 投資: ¥1,555,200 (3年前払い)

RDS (r5.2xlarge ×2):
  On-Demand: ¥70,000/月
  3年 RI (60%): ¥28,000/月
  → 投資: ¥1,008,000 (3年前払い)

ElastiCache (r5.large ×10):
  On-Demand: ¥35,000/月
  3年 RI (55%): ¥15,750/月
  → 投資: ¥567,000 (3年前払い)

推奨購入:
  ✓ 3年 RI: ECS + RDS + ElastiCache
  合計投資: ¥3,130,200
  年間削減: ¥238,050 (40%)
  ROI: 13ヶ月で投資回収
```

## コスト算定チェックリスト

### 構成選定時

- [ ] ユーザー規模（想定MAU）が明確
- [ ] 地理的分布（複数リージョン不要？）が検討済み
- [ ] 稼働パターン（24/7 or 営業時間のみ）が確認済み
- [ ] パフォーマンス要件（応答時間、スループット）が定義
- [ ] スケーラビリティ要件（成長見通し）が確認済み
- [ ] セキュリティ/コンプライアンス要件が反映

### コスト最適化時

- [ ] RI/Savings Plans カバレッジが 50%以上か
- [ ] Graviton インスタンスへの移行検討済み
- [ ] Spot Instance が対象ワークロードに適用中か
- [ ] Reserved Capacity が必要なリソースに確保済み
- [ ] 月間コストレビューで異常検知が機能しているか
- [ ] Chargeback（部門別請求）が実施中
