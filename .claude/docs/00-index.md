# aidev-gc 全体インデックス
# エージェント・スキル・成果物の依存関係マップ

---

## 共通規約

### 命名規則
- エージェントファイル: .claude/agents/{名前}.md（kebab-case）
- スキルディレクトリ: .claude/skills/{名前}/SKILL.md（kebab-case）
- 成果物出力先: outputs/{カテゴリ}/
- IaCモジュール: snake_case

### frontmatter 共通フィールド
```yaml
---
name: {エージェント名}
description: {1-2行の説明}
model: opus | sonnet
tools: [Read, Write, Edit, Grep, Glob, Bash]
skills:
  - {参照スキル名}
# 必要に応じて:
# isolation: worktree     # 並行ファイル操作時
# background: true        # 長時間タスク時
---
```

### 品質基準（全エージェント共通）
- 全成果物に artifact-metadata-registry の required_sections を満たすこと
- 設計書は design-document-5w1h テンプレートに従うこと
- 前提条件・確認事項リストを必ず明記すること

---

## エージェント一覧（23体）

※ 全エージェント共通スキル: gc-document-generation-standards（成果物生成規約）

### 上流系（4体）

| # | 名前 | model | 主な参照スキル | 入力 | 出力先 |
|---|------|-------|-------------|------|--------|
| 1 | tailoring | opus | tailoring-decision-matrix, ipa-tailoring-guide, gc-project-profiling | RFP/口頭メモ/既存資料 | outputs/00_案件立ち上げ/ |
| 2 | infra-requirements | opus | gc-requirements-template, gc-nonfunctional-checklist, gc-network-patterns, gc-security-template | 案件プロファイル + 顧客ヒアリング | outputs/02_要件定義/ |
| 3 | infra-estimation | opus | gc-standard-wbs, estimation-methods, estimation-template, gc-project-profiling | 案件プロファイル or 要件定義書 | outputs/01_提案見積/ |
| 4 | infra-proposal | opus | proposal-writing, gc-estimation-output-templates | 見積結果 + 案件プロファイル | outputs/01_提案見積/ |

### 設計系（7体）

| # | 名前 | model | 主な参照スキル | 入力 | 出力先 |
|---|------|-------|-------------|------|--------|
| 5 | infra-gc-environment | opus | gc-account-structure, gc-template-catalog, gc-gcas-sso | 要件定義書 | outputs/04_設計/04-1_GC環境/ |
| 6 | infra-network | opus | gc-network-patterns, gc-lgwan-connectivity | 要件定義書 | outputs/04_設計/04-2_ネットワーク/ |
| 7 | infra-security | opus | gc-security-template, gc-zero-trust, ismap-infra-controls | 要件定義書 + NW設計書 | outputs/04_設計/04-3_セキュリティ/ |
| 8 | infra-iac | sonnet | gc-iac-best-practices, terraform-module-patterns, gc-iac-structure-terraform, gc-iac-structure-cfn-cdk | 各設計書 | iac/ |
| 9 | infra-monitoring | sonnet | gc-monitoring-patterns, gc-ebpm-dashboard | 要件定義書 + 各設計書 | outputs/04_設計/04-5_監視/ |
| 10 | infra-cost | sonnet | gc-cost-optimization-guide, gc-recommended-config | 各設計書 | outputs/04_設計/04-6_コスト/ |
| 11 | infra-backup-dr | sonnet | （汎用AWSナレッジ） | 要件定義書 | outputs/04_設計/04-7_バックアップDR/ |

### テスト・移行・運用系（3体）

| # | 名前 | model | 主な参照スキル | 入力 | 出力先 |
|---|------|-------|-------------|------|--------|
| 12 | infra-test | sonnet | infra-test-patterns | 各設計書 + IaCコード | outputs/05_テスト/ |
| 13 | infra-migration | opus | migration-patterns | 各設計書 + 移行設計書 | outputs/06_移行/ |
| 14 | infra-operations | sonnet | sre-practice | 運用設計書 | outputs/07_運用/ |

### 品質・変更管理系（3体）

| # | 名前 | model | 主な参照スキル | 入力 | 出力先 |
|---|------|-------|-------------|------|--------|
| 15 | infra-qa | opus | phase-gate-criteria, gc-artifact-metadata | 全成果物 | outputs/90_品質管理/90-1_QA/ |
| 16 | infra-impact-analysis | opus | impact-analysis-rules, estimation-methods | 変更要求 + 全成果物 | outputs/90_品質管理/90-2_影響分析/ |
| 17 | infra-gap-detector | opus | gap-detection-patterns, phase-gate-criteria | 全成果物 | outputs/90_品質管理/90-3_ギャップ検出/ |

### PM系（6体）

| # | 名前 | model | 主な参照スキル | 入力 | 出力先 |
|---|------|-------|-------------|------|--------|
| 18 | pm-planning | opus | ipa-pm-process, gc-standard-wbs | 見積結果 + 要件定義書 | outputs/80_PM/ |
| 19 | pm-progress-risk | sonnet | evm-practice, ipa-pm-process | WBS + 進捗データ | outputs/80_PM/ |
| 20 | pm-quality | opus | ipa-measurement-metrics, ipa-support-process | テスト結果 + 品質データ | outputs/80_PM/ |
| 21 | pm-config-change | sonnet | gitops-infra-management | 変更要求 | outputs/80_PM/ |
| 22 | pm-infra-cicd | sonnet | infra-cicd-patterns | CI/CD設計書 | outputs/80_PM/ |
| 23 | pm-review | sonnet | ipa-support-process | 各設計書 | outputs/80_PM/ |

---

## スキル一覧（44件）

### GCインフラ基盤スキル（15件）

| # | 名前 | 使用エージェント | 内容 |
|---|------|----------------|------|
| 1 | gc-account-structure | infra-gc-environment | GCアカウント構成、単独/共同利用判断 |
| 2 | gc-template-catalog | infra-gc-environment | GC3層テンプレート体系 |
| 3 | gc-gcas-sso | infra-gc-environment | GCAS-SSO、CEP、MFA要件 |
| 4 | gc-network-patterns | infra-network, infra-requirements | VPC/TGW設計パターン |
| 5 | gc-lgwan-connectivity | infra-network | LGWAN/DirectConnect接続 |
| 6 | gc-security-template | infra-security, infra-requirements | GCセキュリティテンプレート設定項目 |
| 7 | gc-zero-trust | infra-security | ゼロトラスト設計原則（DS-310） |
| 8 | ismap-infra-controls | infra-security, infra-requirements | ISMAP305のインフラ部分 |
| 9 | gc-iac-best-practices | infra-iac | GCのIaC原則 |
| 10 | terraform-module-patterns | infra-iac | Terraformモジュール設計 |
| 11 | aws-cdk-patterns | infra-iac | CDKベストプラクティス |
| 12 | gc-monitoring-patterns | infra-monitoring | GC監視設計パターン |
| 13 | gc-ebpm-dashboard | infra-monitoring | GCAS EBPM連携 |
| 14 | gc-cost-optimization-guide | infra-cost | コスト最適化ガイドv1.0 |
| 15 | gc-recommended-config | infra-cost | GC推奨構成のコスト算定 |

### PM・管理スキル（9件）

| # | 名前 | 使用エージェント | 内容 |
|---|------|----------------|------|
| 16 | ipa-pm-process | pm-planning, pm-progress-risk | プロジェクト計画/アセスメント/制御 |
| 17 | ipa-support-process | pm-quality, pm-review | 品質保証/検証/妥当性確認/文書化 |
| 18 | ipa-measurement-metrics | pm-quality | 品質メトリクス、FP生産性基準値 |
| 19 | evm-practice | pm-progress-risk | EV/PV/AC/SPI/CPI |
| 20 | gitops-infra-management | pm-config-change | PRベース変更管理、ブランチ戦略 |
| 21 | sre-practice | infra-operations | SLI/SLO、エラーバジェット、ポストモーテム |
| 22 | infra-cicd-patterns | pm-infra-cicd | ゼロタッチ本番、ブレイクグラス、OIDC |
| 23 | phase-gate-criteria | infra-qa, infra-gap-detector | フェーズゲート判定基準 |
| 24 | gc-procurement | tailoring | GC調達仕様書、ASP/運用管理補助者要件 |

### テーラリング・見積スキル（8件）

| # | 名前 | 使用エージェント | 内容 |
|---|------|----------------|------|
| 25 | tailoring-decision-matrix | tailoring | 10軸×エージェント/スキル判断マトリクス |
| 26 | ipa-tailoring-guide | tailoring | テーラリング手順、修整根拠記録 |
| 27 | estimation-methods | infra-estimation, infra-impact-analysis | FP法/COCOMO/ボトムアップ/類推法 |
| 28 | estimation-template | infra-estimation | GCインフラ見積テンプレート |
| 29 | proposal-writing | infra-proposal | 技術提案書の構成パターン |
| 30 | gc-project-profiling | tailoring, infra-requirements | 案件10軸プロファイリング知識ベース |
| 31 | gc-standard-wbs | infra-estimation, pm-planning | 標準WBS（9フェーズ×132タスク） |
| 32 | gc-estimation-output-templates | infra-proposal | 見積書/提案書テンプレート |

### テスト・移行スキル（2件）

| # | 名前 | 使用エージェント | 内容 |
|---|------|----------------|------|
| 33 | infra-test-patterns | infra-test | インフラテスト種別の計画・実施パターン |
| 34 | migration-patterns | infra-migration | GC移行パターン、切替/切戻しテンプレート |

### 変更管理・早期検知スキル（2件）

| # | 名前 | 使用エージェント | 内容 |
|---|------|----------------|------|
| 35 | impact-analysis-rules | infra-impact-analysis | 成果物間の依存関係マップ、変更波及ルール |
| 36 | gap-detection-patterns | infra-gap-detector | フェーズ別の抜け漏れ検知チェックパターン |

### 成果物・IaC構造スキル（4件）

| # | 名前 | 使用エージェント | 内容 |
|---|------|----------------|------|
| 37 | gc-artifact-metadata | infra-qa, 全エージェント | 成果物メタデータスキーマ（YAML定義） |
| 38 | gc-design-document-template | 全設計エージェント | 設計書5W1Hテンプレート集 |
| 39 | gc-iac-structure-terraform | infra-iac | Terraform 3層構造規約 |
| 40 | gc-iac-structure-cfn-cdk | infra-iac | CFn/CDK構造規約 |

### 要件定義スキル（2件）

| # | 名前 | 使用エージェント | 内容 |
|---|------|----------------|------|
| 41 | gc-requirements-template | infra-requirements | 要件定義書テンプレート・記載ガイド |
| 42 | gc-nonfunctional-checklist | infra-requirements | 非機能要件チェックリスト（v1.2ベース） |

### 成果物生成・図表スキル（2件）

| # | 名前 | 使用エージェント | 内容 |
|---|------|----------------|------|
| 43 | drawio-diagram-generator | 設計系9エージェント | draw.io形式でAWS構成図・フロー図を生成する規約 |
| 44 | gc-document-generation-standards | 全エージェント | 成果物生成の横断規約（出力形式、テンプレート参照、バージョン管理、納品変換） |

---

## エージェント間データフロー

```
[tailoring] 案件プロファイル（outputs/00_案件立ち上げ/）
  ├→ [infra-requirements] 要件定義書（outputs/02_要件定義/）
  │     ├→ [infra-estimation] 詳細見積（outputs/01_提案見積/）
  │     └→ 全設計エージェントの入力
  ├→ [infra-estimation] 概算見積（outputs/01_提案見積/）
  │     └→ [infra-proposal] 提案書（outputs/01_提案見積/）
  └→ [pm-planning] プロジェクト計画（outputs/80_PM/）

[infra-network] NW設計書 ←→ [infra-security] セキュリティ設計書（Agent Teams相互参照）
[infra-monitoring] 監視設計書 ←→ [infra-security]（Agent Teams相互参照）

全設計エージェント → [infra-iac] IaCコード
[infra-iac] → [infra-test] テスト（outputs/05_テスト/） → [infra-migration] 移行（outputs/06_移行/）

[pm-config-change] 変更受付（outputs/80_PM/） → [infra-impact-analysis] 影響分析（outputs/90_品質管理/90-2_影響分析/） → 影響エージェント群を再起動
[infra-gap-detector] 抜け漏れ検知（outputs/90_品質管理/90-3_ギャップ検出/） → 各フェーズゲートで起動
```

## フェーズ構成（9フェーズ）

```
Phase 0: 案件入口・プロファイリング  → tailoring（outputs/00_案件立ち上げ/）
Phase 1: 提案・見積                 → infra-estimation, infra-proposal（outputs/01_提案見積/）
Phase 2: 要件定義                   → infra-requirements（outputs/02_要件定義/）
Phase 3: 詳細見積・計画             → infra-estimation, pm-planning（outputs/03_詳細見積/, outputs/80_PM/）
Phase 4: 設計                       → 設計系7体（outputs/04_設計/; Agent Teams並行）
Phase 5: 構築                       → infra-iac（iac/; worktree分離）
Phase 6: テスト                     → infra-test（outputs/05_テスト/; Agent Teams並行）
Phase 7: 移行・本番切替             → infra-migration（outputs/06_移行/）
Phase 8: 運用・保守                 → infra-operations（outputs/07_運用/; /loop自動化）
```

### RFP完成度による分岐

```
tailoring が7項目で判定:
  HIGH(7/7) → パターンB: Phase 2スキップ、Phase 1で詳細見積
  MID(3-6)  → パターンA: Phase 0→1→2→3→4〜8（標準フロー）
  LOW(0-2)  → パターンC: Phase 0→1→2を先行受注→3〜8を本体受注
```
