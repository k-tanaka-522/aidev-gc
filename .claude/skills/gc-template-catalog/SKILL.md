---
description: GC3層テンプレート体系（必須/推奨/任意の判断基準、適用手順、カスタマイズ可能範囲）
---

# GC3層テンプレート体系

## GC テンプレート分類体系

Google Cloud は公式テンプレートを3層に分類：

### 第1層：基盤テンプレート（必須）
セキュリティ、ガバナンス、コンプライアンスの要件実装

| テンプレート名 | 対象 | 必須度 | カスタマイズ範囲 |
|------------|------|-------|------------|
| **Landing Zone** | Organizations全体 | 必須 | 禁止（GC公式構成固定） |
| **Security Base** | セキュリティ基盤（IAM、KMS、ログ） | 必須 | 組織名、リージョンのみ |
| **Network Base** | ネットワーク基盤（VPC、ルーティング、DNS） | 必須 | CIDR、リージョン |
| **Governance** | ポリシー適用（SCP、Tag要件） | 必須 | SCP内容は可（GC推奨設定は維持） |

### 第2層：共通テンプレート（推奨）
標準的な企業システムでよく利用される構成

| テンプレート名 | 対象 | 推奨度 | カスタマイズ範囲 |
|------------|------|-------|------------|
| **Web Hosting** | Webアプリケーション（ALB + ASG + RDS） | 推奨 | インスタンスタイプ、ストレージ容量 |
| **Microservices** | コンテナ環境（ECS/EKS） | 推奨 | コンテナイメージ、スケーリングポリシー |
| **Data Pipeline** | データ分析（Glue + Athena + QuickSight） | 推奨 | S3バケット名、分析クエリ |
| **ML Platform** | 機械学習（SageMaker） | 推奨 | モデル、トレーニングデータセット |

### 第3層：オプションテンプレート（任意）
特定の用途向けの専門テンプレート

| テンプレート名 | 対象 | 任意度 | カスタマイズ範囲 |
|------------|------|-------|------------|
| **Healthcare Workload** | 医療業界システム | 選択可 | HIPAA対応設定の詳細カスタマイズ |
| **Financial Services** | 金融システム（PCI-DSS対応） | 選択可 | コンプライアンス要件の業界別対応 |
| **AI/ML Advanced** | 高度な機械学習（カスタムモデル） | 選択可 | モデルアーキテクチャ全体 |
| **Edge Computing** | エッジ処理（IoT） | 選択可 | デバイス連携プロトコル |

## テンプレート適用判断フロー

```
システム要件定義
    ↓
「ビジネス要件」と「技術要件」の抽出
    ↓
    ├─ セキュリティ要件? → 第1層: Security Base (必須)
    ├─ ガバナンス要件? → 第1層: Governance (必須)
    ├─ ネットワーク要件? → 第1層: Network Base (必須)
    ├─ 標準 Web/API システム? → 第2層: Web Hosting (推奨)
    ├─ コンテナ化? → 第2層: Microservices (推奨)
    ├─ データ分析? → 第2層: Data Pipeline (推奨)
    ├─ 医療/金融? → 第3層: Healthcare/Financial (選択)
    └─ カスタム? → テンプレート組み合わせ or 設計カスタム

テンプレート決定
    ↓
基盤（第1層）を適用
    ↓
標準パターンに合致 → 第2層を適用
    ↓
特殊要件有 → 第3層 or カスタム設計
    ↓
適用計画作成
```

## カスタマイズ可能範囲の定義

### Level 1: 禁止（テンプレートそのまま）
- IAM ロール定義
- Organizations 階層構造
- ネットワークセグメンテーション（Public/Private/Protected分割）
- CloudTrail、GuardDuty設定
- キー暗号化方式（AES-256等）

### Level 2: 限定的カスタマイズ
- CIDR帯（テンプレート推奨範囲内での変更）
- インスタンスタイプ（t3からt4への変更、同クラス内）
- ストレージ容量（GB数）
- リージョン選択
- リソースタグ値（タグキーは固定）

### Level 3: 自由度高
- アプリケーション実装（言語、フレームワーク）
- データパイプライン処理ロジック
- カスタムメトリクス
- アラーム閾値
- バックアップスケジュール詳細

## 適用手順

### Phase 1: テンプレート組み合わせ検討（1〜2週間）
1. ビジネス要件 → 必要テンプレート層を特定
2. 複数テンプレート組み合わせの可否判定
3. 組み合わせ時の相互作用チェック（衝突なし？）
4. カスタマイズスコープ確認（Level 1/2/3の分類）

### Phase 2: デプロイ計画作成（1週間）
1. 適用順序決定（依存関係を考慮）
   - 例: Landing Zone → Security Base → Network Base → Web Hosting
2. ロールバック計画
3. 検証チェックリスト

### Phase 3: デプロイ実行（環境別に段階的）
1. 開発環境: フルテンプレート適用 + テスト
2. ステージング環境: 本番同等で実施
3. 本番環境: 承認後デプロイ

### Phase 4: 検証・最適化（2週間）
1. 各テンプレート適用結果の検証
2. リソース作成の完全性確認
3. 設定値の正確性検証
4. ドリフト検知の有効性確認

## テンプレート間の依存関係

```
Landing Zone (Root)
    ├→ Security Base
    │   ├→ IAM 基盤
    │   ├→ KMS 鍵管理
    │   └→ ログ基盤
    │
    ├→ Network Base
    │   ├→ VPC 設計
    │   ├→ TransitGateway
    │   └→ DNS
    │
    ├→ Governance
    │   ├→ SCP ポリシー
    │   └→ Tag 標準化
    │
    └→ 第2層 テンプレート (全て上記依存)
        ├→ Web Hosting
        ├→ Microservices
        ├→ Data Pipeline
        └→ ML Platform
```

## テンプレート選択マトリックス

| システム類型 | 推奨第1層 | 推奨第2層 | 推奨第3層 | 手動カスタマイズ度 |
|-----------|---------|---------|---------|------------|
| 一般Webアプリ | Landing Zone + Security Base + Network Base | Web Hosting | - | 低（Level 2のみ） |
| マイクロサービス | Landing Zone + Security Base + Network Base | Microservices | - | 中（Level 2-3） |
| 医療システム | Landing Zone + Security Base + Network Base | Web Hosting | Healthcare | 中（Level 2-3） |
| 金融システム | Landing Zone + Security Base + Network Base | Web Hosting | Financial Services | 高（全 Level） |
| データ分析 | Landing Zone + Security Base | Data Pipeline | - | 高（Level 3） |
| 機械学習 | Landing Zone + Security Base | ML Platform | AI/ML Advanced | 高（全 Level） |

## チェックリスト：テンプレート適用完了

- [ ] 適用テンプレート一覧が明記されている
- [ ] 第1層（必須）全て適用済み
- [ ] 第2層（推奨）の適用可否判定が文書化
- [ ] 第3層（任意）の選択理由が明記
- [ ] カスタマイズ箇所が「Level 1/2/3」で分類
- [ ] 禁止カスタマイズ項目が明記
- [ ] 環境別（dev/stg/prod）の適用差分が明確
- [ ] ロールバック計画が存在
- [ ] テンプレート間依存関係の確認完了
- [ ] 各環境での適用テスト完了
