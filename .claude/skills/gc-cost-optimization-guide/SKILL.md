---
description: コスト最適化ガイド（RI/SP選定基準、Graviton活用、スポット/オンデマンド判断、コスト配分タグ、予算アラート設計）
---

# GCコスト最適化ガイド

## RI/Savings Plans 選定判断フローチャート

```
ワークロード特性を調査
    ↓
【質問1】 このリソースは24/365連続稼働か?
    ├─ NO → Spot Instance 検討 or On-Demand
    └─ YES ↓
【質問2】 今後12ヶ月以上この構成は変わらないか?
    ├─ NO → On-Demand（柔軟性重視）
    └─ YES ↓
【質問3】 このリソースはビジネスクリティカルか?
    ├─ YES → RI 1年契約 or SP 3年
    └─ NO ↓ → RI 1年契約（見直し機会確保）

RI/SP 購入判断
    ├─ 1年RI: 30～40% 割引
    ├─ 3年RI: 50～60% 割引
    └─ Savings Plans: 柔軟性 + 割引（20～30%）
```

## RI/Savings Plans 選定基準 詳細

### Instance 別選定ガイド

| Instance 種別 | 特性 | 推奨購入方式 | 根拠 |
|-------------|------|-----------|------|
| **Web Server（ALB後ろ）** | 変動少、常時稼働 | 1年 RI or SP | スケーリングルール固定 |
| **App Server（ASG）** | 時間帯変動あり | Savings Plans | インスタンスタイプ変更あり |
| **Batch Job** | 夜間のみ | Spot | Cost 最重視、障害耐性あり |
| **DB Server** | 常時稼働、変更困難 | 3年 RI | 長期安定 |
| **Cache（ElastiCache）** | 常時稼働 | 3年 RI | 構成固定 |

### RI/SP 購入判断の数値化

```
Break-even Point = (On-Demand費用 - RI費用) ÷ (年月数)

例:
  On-Demand: t3.large × 24ヶ月 = ¥200,000
  1年 RI: ¥120,000（40%割引）
  3年 RI: ¥180,000（55%割引、3年）

  1年 RI break-even: (200k - 120k) = 80k削減
  3年 RI break-even: (600k - 180k) = 420k削減

  →3年RIの方が総コスト削減（500k超）だが、
    3年契約リスク有り
  →1年 RI推奨（8ヶ月で投資回収、更新機会あり）
```

### 購入パターン別コスト比較

```
12ヶ月運用コスト（t3.large × 1台、東京リージョン）:

On-Demand:
  ¥120/h × 730h/月 × 12月 = ¥1,050,000

1年 Reserved Instance（40%割引）:
  前払い: ¥630,000
  時間単価: ¥72/h（年間）
  = ¥630,000 + ¥72 × 730 × 0 = ¥630,000
  削減率: 40%

3年 Reserved Instance（55%割引）:
  前払い: ¥1,400,000 (3年間)
  時間単価: ¥53/h
  = ¥1,400,000（3年で割ると約46.7万/年）
  削減率: 55%

Savings Plans（25%割引、柔軟性高）:
  時間単価: ¥90/h（月単位でコミット）
  年間: ¥90 × 730 × 12 = ¥788,400
  削減率: 25%
  メリット: インスタンスタイプ変更可能
```

## Graviton インスタンス活用

### Graviton 対応インスタンスファミリ

| ファミリ | 世代 | パフォーマンス | コスト削減 |
|---------|-----|------------|---------|
| **t4g** | T (Burstable) | 同等 | 20% 削減 |
| **m7g** | M (汎用) | 15% 高速 | 15% 削減 |
| **c7g** | C (計算最適化) | 20% 高速 | 20% 削減 |
| **r7g** | R (メモリ最適化) | 10% 高速 | 10% 削減 |

### Graviton 移行チェックリスト

移行前確認:
- [ ] アプリケーションが arm64 対応か（Docker イメージ、バイナリ）
- [ ] RDS が Graviton2 対応版か（db.t4g 等）
- [ ] 外部ライブラリが arm64 対応か
- [ ] 性能テスト環境で事前検証完了

移行ステップ:
```
Step 1: 開発環境を Graviton に変更（リスク低）
  ↓ 1週間運用テスト
Step 2: ステージング環境も Graviton に変更
  ↓ 性能テスト実施
Step 3: 本番環境の一部（初期1台）を Graviton に変更
  ↓ 2週間監視
Step 4: 本番環境を全て Graviton に変更
```

## スポット インスタンス 活用パターン

### スポット活用に適したワークロード

| ワークロード | 最大削減率 | 適性 | リスク対策 |
|-----------|---------|------|---------|
| **Batch処理** | 70～80% | 高い | 夜間実行、中断耐性あり |
| **CI/CD ビルド** | 60～70% | 高い | キャッシュ活用、再実行可能 |
| **データ分析** | 70% | 高い | 復旧可能、長時間OK |
| **Web Crawler** | 70% | 高い | キューイング、再実行 |
| **フロントエンド Web** | 10% | 低い | 中断不可、SLA厳しい |
| **DB Server** | 0% | 不可 | 中断禁止 |

### Spot Instance 最大割引を引き出すコツ

```
Spot Fleet Request パターン：
複数インスタンスタイプを指定して、
最も安いタイプを自動選択

例:
  t3.large: ¥120/h (時給)
  t3a.large: ¥100/h
  m5.large: ¥110/h
  m5a.large: ¥95/h （← 最安値）

  → Spot Fleet で自動 m5a.large 選択
    実スポット価格: ¥40/h (65%割引)

設定:
  • Capacity: 2 (2台)
  • AllocationStrategy: price-capacity-optimized
  • SpotPrice ハイリミット: ¥80/h

結果: 予測不可な割引で最大削減
```

## コスト配分タグ戦略

### 必須タグセット

```hcl
common_tags = {
  # 必須: 部門別請求
  "CostCenter"  = "CC-001"           # 部門ID

  # 必須: プロジェクト追跡
  "Project"     = "company-web-app"  # プロジェクト名

  # 必須: 環境識別
  "Environment" = "prod"              # dev/stg/prod

  # 必須: 所有者連絡
  "Owner"       = "team@company.com"  # メールアドレス

  # 推奨: ビジネスユニット
  "BusinessUnit" = "Sales"

  # 推奨: コスト責任者
  "BudgetOwner" = "finance-manager@company.com"

  # 推奨: RI/SP購入計画
  "RIPlanningStatus" = "optimized" # optimized/pending/excluded
}
```

### Chargeback（部門別請求）の実装

```
AWS Cost Explorer で部門別にフィルタ:

select_tags = {
  CostCenter = ["CC-001", "CC-002", "CC-003"]
}

月別集計:
  営業部 (CC-001): ¥450,000
  IT部 (CC-002): ¥280,000
  企画室 (CC-003): ¥170,000
  ─────────────────────
  合計: ¥900,000
```

## 予算・アラート設計

### AWS Budgets 設定

```hcl
resource "aws_budgets_budget" "monthly_limit" {
  name              = "monthly-budget-prod"
  budget_type       = "COST"
  limit_unit        = "USD"
  limit_amount      = "10000"
  time_period_start = "2024-01-01"
  time_period_end   = "2024-12-31"
  time_unit         = "MONTHLY"

  cost_filters = {
    TagKeyValue = ["Environment$prod"]
  }

  notification {
    comparison_operator        = "GREATER_THAN"
    notification_type          = "FORECASTED"
    threshold                  = 80
    threshold_unit             = "PERCENTAGE"
    notification_channel_type  = "EMAIL"
    notification_channel_value = "finance@company.com"
  }

  notification {
    comparison_operator        = "GREATER_THAN"
    notification_type          = "ACTUAL"
    threshold                  = 100
    threshold_unit             = "PERCENTAGE"
    notification_channel_type  = "SNS"
    notification_channel_value = aws_sns_topic.budget_alerts.arn
  }
}
```

### Cost Anomaly Detection（異常検知）

```
CloudWatch Events ← Cost Anomaly Detector

異常検知例:
  通常: 月¥900,000 の±10%
  異常: 昨日¥1,200,000（突発的増加）

  トリガー: Lambda → Slack 通知
  内容: 「本番環境 EC2 コストが 33% 増加」
```

## 月次コストレビュープロセス

### レビュー議題

```
【毎月初 Monday 10:00 開催】

1. 前月実績コスト（¥XXX,XXX）
   - 予算比: +5%（予算内）
   - YoY比: -12%（昨年同月比で削減）

2. コスト異常検知
   - RDS: +¥50k（レプリカ追加）
   - Lambda: 正常

3. RI/Savings Plans 購入検討
   - EC2 t3.large: 利用率 85% → 1年RI購入推奨

4. Graviton 移行進捗
   - 開発環境: 完了（20%削減達成）
   - ステージング: 進行中

5. 来月予算見直し
   - 新規プロジェクト追加 → +¥100k
   - Spot 活用拡大 → -¥30k

議論結果:
- □ RI 購入承認（¥800k）
- □ Graviton 本番移行 GO判定
- □ Spot Fleet 拡大（Batch Job）
```

## コスト最適化チェックリスト

- [ ] RI/Savings Plans 購入判断フロー が部門で周知
- [ ] Graviton インスタンス への移行計画 がある
- [ ] Spot Instance 対象ワークロード が特定済み
- [ ] コスト配分タグ が全リソースに付与
- [ ] Chargeback 方式（部門別請求）が定義
- [ ] AWS Budgets で月額上限設定済み
- [ ] Cost Anomaly Detection が有効化
- [ ] 月次コストレビュー会議 がカレンダー化
- [ ] Reserved Instance カバレッジ 50%以上
- [ ] RI 購入・更新ワークフロー がドキュメント化
