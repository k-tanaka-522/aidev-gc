# スキルカタログ

IPA準拠オーケストレーション設計書に基づく48スキルの定義。

## 使い方

1. エージェントの `skills` フィールドでスキルIDを指定
2. タスク実行時にスキルが自動で参照される
3. 詳細は各カテゴリのディレクトリを参照

---

## カテゴリ別スキル一覧

### UX/Design (4スキル)

| Skill ID | スキル名 | 概要 | 対象Agent |
|----------|---------|------|-----------|
| user-story-mapping | ユーザーストーリーマッピング | ストーリーマップ作成手法 | BizAnalyst, UXDesigner |
| ux-research | UXリサーチ | ペルソナ・ジャーニーマップ作成 | UXDesigner |
| atomic-design | Atomic Design | コンポーネント設計パターン | Dev-Frontend |
| accessibility | アクセシビリティ | WCAG 2.1準拠実装 | Dev-Frontend |

### Architecture (6スキル)

| Skill ID | スキル名 | 概要 | 対象Agent |
|----------|---------|------|-----------|
| c4-modeling | C4モデリング | C4 Model図法 | AppArchitect |
| adr-documentation | ADR作成 | Architecture Decision Records | AppArchitect |
| domain-driven-design | DDD | 境界コンテキスト・集約設計 | AppArchitect, DataArchitect |
| clean-architecture | Clean Architecture | 依存関係逆転・レイヤー分離 | AppArchitect, Dev-Backend |
| domain-modeling | ドメインモデリング | エンティティ・値オブジェクト設計 | DataArchitect |
| technology-evaluation | 技術選定 | PoC・比較評価手法 | AppArchitect |

### API (3スキル)

| Skill ID | スキル名 | 概要 | 対象Agent |
|----------|---------|------|-----------|
| openapi-spec | OpenAPI仕様 | OpenAPI 3.0仕様書作成 | AppArchitect, Dev-Backend |
| api-versioning | APIバージョニング | バージョン管理戦略 | AppArchitect |
| oauth2-oidc | OAuth2/OIDC | 認証・認可実装 | SecurityArchitect, Dev-Backend |

### Frontend (5スキル)

| Skill ID | スキル名 | 概要 | 対象Agent |
|----------|---------|------|-----------|
| state-management | 状態管理 | Redux/Zustand設計 | Dev-Frontend |
| web-performance | Webパフォーマンス | Core Web Vitals最適化 | Dev-Frontend |
| api-integration | API連携 | TanStack Query型安全API | Dev-Frontend |
| form-validation | フォームバリデーション | Zod/Yupスキーマ検証 | Dev-Frontend |
| responsive-design | レスポンシブデザイン | ブレークポイント・モバイルファースト | Dev-Frontend |

### Backend (4スキル)

| Skill ID | スキル名 | 概要 | 対象Agent |
|----------|---------|------|-----------|
| layered-architecture | レイヤードアーキテクチャ | Repository/Service層設計 | Dev-Backend |
| caching-strategy | キャッシュ戦略 | Redis/CDNキャッシュ設計 | Dev-Backend, InfraArchitect |
| async-processing | 非同期処理 | Queue/Worker設計 | Dev-Backend |
| error-handling | エラーハンドリング | エラーコード体系・例外設計 | Dev-Backend |

### Database (6スキル)

| Skill ID | スキル名 | 概要 | 対象Agent |
|----------|---------|------|-----------|
| index-design | インデックス設計 | B-Tree/GIN/パーシャル | DataArchitect |
| partitioning | パーティション設計 | Range/List/Hash | DataArchitect |
| connection-pooling | コネクションプール | PgBouncer/RDS Proxy | DataArchitect |
| database-scaling | DBスケーリング | Read Replica/Sharding | DataArchitect, InfraArchitect |
| db-migration | DBマイグレーション | Flyway/Prisma Migrate | Dev-Backend |
| data-lifecycle | データライフサイクル | 保持期間・自動削除設計 | DataArchitect |

### DevOps (12スキル)

| Skill ID | スキル名 | 概要 | 対象Agent |
|----------|---------|------|-----------|
| branching-strategy | ブランチ戦略 | Git Flow/GitHub Flow/Trunk | DevOps |
| ci-cd-pipeline | CI/CDパイプライン | GitHub Actions設計 | DevOps |
| security-scanning | セキュリティスキャン | SAST/DAST統合 | DevOps, SecurityArchitect |
| dependency-scanning | 依存関係スキャン | Dependabot/Renovate | DevOps |
| container-build | コンテナビルド | マルチステージビルド・最小化 | DevOps |
| iac-validation | IaC検証 | Checkov/tfsec/cfn-lint | DevOps |
| blue-green-deploy | Blue/Greenデプロイ | ゼロダウンタイムデプロイ | DevOps, SRE |
| canary-deploy | Canaryデプロイ | 段階的ロールアウト | DevOps, SRE |
| feature-flags | Feature Flag | LaunchDarkly/Unleash | DevOps |
| rollback-procedure | ロールバック手順 | 即座ロールバック手順 | DevOps, SRE |
| secret-management | シークレット管理 | Secrets Manager/Vault | DevOps, SecurityArchitect |
| secret-rotation | シークレットローテーション | 自動ローテーション設計 | DevOps, SecurityArchitect |

### Observability (7スキル)

| Skill ID | スキル名 | 概要 | 対象Agent |
|----------|---------|------|-----------|
| structured-logging | 構造化ログ | JSON構造化ログ設計 | SRE, Dev-Backend |
| log-aggregation | ログ集約 | CloudWatch Logs/ELK Stack | SRE |
| log-retention | ログ保持 | 保持期間・アーカイブ設計 | SRE |
| custom-metrics | カスタムメトリクス | RED/USEメソッド | SRE |
| alerting-design | アラート設計 | 閾値・エスカレーション | SRE |
| distributed-tracing | 分散トレーシング | OpenTelemetry/X-Ray | SRE, Dev-Backend |
| sla-design | SLA設計 | SLI/SLO/エラーバジェット | SRE |

### Testing (7スキル)

| Skill ID | スキル名 | 概要 | 対象Agent |
|----------|---------|------|-----------|
| mocking-strategy | モック戦略 | モック/スタブ設計 | QA-Engineer, Dev-Backend |
| contract-testing | Contract Testing | Pact Consumer/Provider | QA-Engineer |
| page-object-model | Page Object Model | E2Eテスト設計パターン | QA-Automation |
| visual-regression | Visual Regression | Percy/Chromatic | QA-Automation |
| load-testing | 負荷テスト | k6/Gatlingスクリプト | QA-Performance |
| owasp-zap | OWASP ZAP | 脆弱性スキャン | QA-Security |
| penetration-testing | ペネトレーションテスト | セキュリティ検証 | QA-Security |

### Operations (5スキル)

| Skill ID | スキル名 | 概要 | 対象Agent |
|----------|---------|------|-----------|
| runbook | Runbook | 障害対応手順書 | SRE |
| incident-response | インシデント対応 | 対応フロー・エスカレーション | SRE |
| postmortem | ポストモーテム | 継続改善プロセス | SRE |
| chaos-engineering | カオスエンジニアリング | Chaos Monkey/Litmus | SRE |
| disaster-recovery | DR設計 | DR切り替え手順 | SRE, InfraArchitect |

### FinOps (4スキル)

| Skill ID | スキル名 | 概要 | 対象Agent |
|----------|---------|------|-----------|
| cost-tagging | コストタグ | タグ戦略・Cost Allocation | FinOps |
| cost-alerting | コストアラート | AWS Budgets設定 | FinOps |
| cost-optimization | コスト最適化 | RI/SP分析・最適化 | FinOps |
| spot-instances | Spotインスタンス | Spot/Graviton活用 | FinOps |

### Security (4スキル)

| Skill ID | スキル名 | 概要 | 対象Agent |
|----------|---------|------|-----------|
| threat-modeling | 脅威モデリング | STRIDE分析 | SecurityArchitect |
| data-privacy | データ保護 | GDPR/個人情報保護法 | SecurityArchitect |
| aws-waf | AWS WAF | WAFルール設計 | SecurityArchitect |
| compliance | コンプライアンス | 法規制対応 | SecurityArchitect |

### IPA/品質 (1スキル)

| Skill ID | スキル名 | 概要 | 対象Agent |
|----------|---------|------|-----------|
| ipa-quality-checklist | IPA品質チェック | テスト密度・バグ密度基準 | QA-Lead |

---

## スキル詳細の参照

各スキルの詳細は以下のディレクトリ構造で管理:

```
.claude/skills/
├── INDEX.md                    # このファイル
├── ux/
│   └── user-story-mapping/
│       └── SKILL.md
├── architecture/
│   ├── c4-modeling/
│   ├── adr/
│   └── ddd/
├── api/
│   └── openapi/
├── frontend/
│   └── state-management/
├── backend/
│   └── layered-architecture/
├── database/
│   └── index-design/
├── devops/
│   └── cicd/
├── observability/
│   └── logging/
├── testing/
│   └── contract-testing/
├── operations/
│   └── runbook/
├── finops/
│   └── cost-optimization/
├── security/
│   └── threat-modeling/
└── ipa/
    └── quality-checklist/
```

---

## 既存ドキュメントとの関係

多くのスキルは既存の技術標準ドキュメントを参照:

| スキルカテゴリ | 既存ドキュメント |
|--------------|-----------------|
| Backend/Frontend | `.claude/docs/40_standards/41_app/` |
| DevOps/IaC | `.claude/docs/40_standards/42_infra/` |
| Security | `.claude/docs/40_standards/49_common/security.md` |
| Testing | `.claude/docs/10_facilitation/2.5_テストフェーズ/` |

---

**更新日**: 2025-12-29
**参照**: [IPAオーケストレーション設計書](../../docs/90_reseach/claude/IPAオーケストレーション設計書.xlsx.pdf)
