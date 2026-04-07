---
description: 成果物メタデータスキーマ（YAML形式で各成果物のメタデータ定義、10-15件サンプル）
---

# GC インフラ案件 成果物メタデータスキーマ

## 概要

プロジェクトの全成果物をメタデータとして一元管理し、成果物間の依存関係、入出力、品質チェック項目を追跡します。

---

## メタデータスキーマ定義

```yaml
成果物:
  id: {成果物の一意識別子}                    # REQ-001, DESIGN-NW-001等
  name: {成果物名}                           # 要件定義書、NW設計書等
  phase: {フェーズ}                         # 要件定義/設計/実装/テスト
  owner_agent: {責任エージェント}           # @infra-requirements等
  format: {ファイル形式}                    # markdown/pdf/xlsx等
  location: {ファイルパス}                  # /docs/requirements.md等
  inputs:                                  # この成果物の入力（前提）
    - {前提となる成果物ID}
  consumers:                               # この成果物を使う次プロセス/成果物
    - {成果物ID}
  required_sections:                       # 必須セクション一覧
    - {セクション名}
  quality_checks:                          # 品質チェック項目
    - {チェック内容}
  version: {現在のバージョン}               # v1.0, v2.3等
  last_updated: {最終更新日}                # YYYY-MM-DD
  status: {ステータス}                     # draft/review/approved/released
```

---

## サンプル成果物メタデータ（15件）

### フェーズ1: 要件定義

```yaml
成果物001:
  id: REQ-001
  name: 要件定義書
  phase: 要件定義
  owner_agent: @infra-requirements
  format: markdown
  location: /docs/requirements/requirements-definition.md
  inputs: []                              # 初期成果物
  consumers:
    - DESIGN-NW-001
    - DESIGN-SEC-001
    - DESIGN-MON-001
    - TEST-PLAN-001
  required_sections:
    - 案件概要
    - 機能要件（50件以上）
    - 非機能要件（6カテゴリ×各5件以上）
    - GC固有要件
    - 移行要件
    - 未決事項
    - 用語集
  quality_checks:
    - 非機能要件が6カテゴリ（可用性/性能/セキュリティ/運用性/移行性/エコロジー）に分類されているか
    - 機能要件数 >= 50件
    - ステークホルダー承認が取得されているか
    - 未決事項 <= 5件
  version: v1.0
  last_updated: 2026-04-01
  status: approved

---

成果物002:
  id: REQ-NONFUNC-001
  name: 非機能要件チェックリスト
  phase: 要件定義
  owner_agent: @infra-requirements
  format: xlsx
  location: /docs/requirements/nonfunctional-requirements-checklist.xlsx
  inputs:
    - REQ-001
  consumers:
    - DESIGN-NW-001
    - DESIGN-SEC-001
    - TEST-PLAN-001
  required_sections:
    - 可用性要件（RTO/RPO/SLA）
    - 性能要件（レスポンス時間/スループット）
    - セキュリティ要件（認証/暗号化/監査ログ）
    - 運用性要件（バックアップ/監視）
    - 移行要件（移行方式/データ移行）
    - エコロジー要件（コスト効率/リソース最適化）
  quality_checks:
    - GC推奨値との対比が記載されているか
    - 各項目に根拠（なぜその値か）が記載されているか
  version: v1.0
  last_updated: 2026-04-01
  status: approved
```

### フェーズ2: 設計

```yaml
成果物003:
  id: DESIGN-NW-001
  name: NW設計書
  phase: 設計
  owner_agent: @infra-network
  format: markdown
  location: /docs/design/network-design.md
  inputs:
    - REQ-001
    - REQ-NONFUNC-001
  consumers:
    - IMPL-TF-NW-001        # Terraform実装
    - TEST-PLAN-NETWORK-001 # テスト計画
    - DESIGN-SEC-001        # セキュリティ設計との整合性確認
  required_sections:
    - 要件への適合性
    - VPC アーキテクチャ（CIDR、サブネット割当）
    - ルーティング・接続方式
    - SecurityGroup / NACL 定義
    - DNS 設計
    - 監視・ロギング計画
  quality_checks:
    - VPC CIDR が重複していないか
    - サブネット CIDR がマジッククォーテット対応か（/24等）
    - セキュリティグループのルール優先度が明確か
    - 図表が読みやすく、記号が統一されているか
  version: v2.1
  last_updated: 2026-04-05
  status: approved

---

成果物004:
  id: DESIGN-SEC-001
  name: セキュリティ設計書
  phase: 設計
  owner_agent: @infra-security
  format: markdown
  location: /docs/design/security-design.md
  inputs:
    - REQ-001
    - REQ-NONFUNC-001
  consumers:
    - IMPL-TF-IAM-001
    - IMPL-TF-KMS-001
    - TEST-PLAN-SEC-001
  required_sections:
    - 認証・認可設計（IAM ポリシー）
    - 暗号化戦略（転送中・保存中）
    - ネットワークセキュリティ（WAF, Shield等）
    - 監査ログ・CloudTrail 設計
    - インシデント対応計画
    - ISMAP/GCAS 対応確認
  quality_checks:
    - IAM ポリシーが最小権限の原則に従っているか
    - KMS キー管理方針が記載されているか
    - セキュリティレビュー指摘 Level 1, 2 ゼロか
  version: v1.5
  last_updated: 2026-04-03
  status: approved

---

成果物005:
  id: DESIGN-MON-001
  name: 監視設計書
  phase: 設計
  owner_agent: @infra-monitoring
  format: markdown
  location: /docs/design/monitoring-design.md
  inputs:
    - REQ-001
    - REQ-NONFUNC-001
  consumers:
    - IMPL-TF-MON-001
    - TEST-PLAN-MON-001
  required_sections:
    - CloudWatch メトリクス定義
    - アラート閾値・判定基準
    - ダッシュボード設計
    - ログ収集・分析戦略
    - SLA/SLO 監視方法
  quality_checks:
    - 全リソースに対する監視ポイントが定義されているか
    - アラート閾値の根拠が明記されているか
  version: v1.2
  last_updated: 2026-04-04
  status: approved

---

成果物006:
  id: DESIGN-ADR-001
  name: アーキテクチャ決定記録
  phase: 設計
  owner_agent: @infra-network
  format: markdown
  location: /docs/design/adr/
  inputs:
    - REQ-001
  consumers: []
  required_sections:
    - Status（Proposed/Accepted/Deprecated）
    - Context（背景・制約）
    - Decision（決定内容）
    - Consequences（結果・トレードオフ）
    - Alternatives（検討した他の案）
  quality_checks:
    - ADR が3件以上存在するか
    - 主要なアーキテクチャ判断が記録されているか
  version: v1.0
  last_updated: 2026-04-05
  status: approved
```

### フェーズ3: 実装

```yaml
成果物007:
  id: IMPL-TF-NW-001
  name: Terraform - Network モジュール
  phase: 実装
  owner_agent: @infra-iac
  format: hcl
  location: /infra/terraform/modules/networking/
  inputs:
    - DESIGN-NW-001
  consumers:
    - TEST-UNIT-TF-001
    - TEST-INT-TF-001
  required_sections:
    - main.tf
    - variables.tf
    - outputs.tf
    - README.md
    - tftest.hcl
  quality_checks:
    - terraform validate パスしているか
    - terraform fmt に従っているか
    - コードカバレッジ >= 70%か
    - セキュリティスキャン Critical ゼロか
  version: v1.0.0
  last_updated: 2026-04-10
  status: released

---

成果物008:
  id: IMPL-TF-IAM-001
  name: Terraform - IAM ロール・ポリシー
  phase: 実装
  owner_agent: @infra-iac
  format: hcl
  location: /infra/terraform/modules/iam/
  inputs:
    - DESIGN-SEC-001
  consumers:
    - TEST-UNIT-TF-001
  required_sections:
    - IAM ロール定義
    - インラインポリシー
    - ポリシーアタッチメント
    - Trust Relationship 定義
  quality_checks:
    - IAM ポリシーが最小権限か（Policy Simulator で検証）
    - 全ロール命名規則に従っているか
  version: v1.0.0
  last_updated: 2026-04-10
  status: released
```

### フェーズ4: テスト

```yaml
成果物009:
  id: TEST-PLAN-001
  name: テスト計画書
  phase: テスト
  owner_agent: @infra-test
  format: markdown
  location: /docs/testing/test-plan.md
  inputs:
    - REQ-001
    - DESIGN-NW-001
    - DESIGN-SEC-001
  consumers:
    - TEST-CASE-001
    - TEST-UNIT-TF-001
    - TEST-INT-TF-001
  required_sections:
    - テスト戦略（単体/結合/性能/セキュリティ）
    - テスト環境構成
    - テストスケジュール
    - テストカバレッジ目標（80%以上）
    - リスク・制約事項
  quality_checks:
    - テストカバレッジ目標が定量的に定義されているか
    - パフォーマンステストの目標値が明記されているか
  version: v1.0
  last_updated: 2026-04-08
  status: approved

---

成果物010:
  id: TEST-CASE-001
  name: テストケース仕様（Terraform）
  phase: テスト
  owner_agent: @infra-test
  format: xlsx/csv
  location: /docs/testing/test-cases-terraform.csv
  inputs:
    - TEST-PLAN-001
  consumers:
    - TEST-UNIT-TF-001
  required_sections:
    - テストケースID
    - テスト目的
    - 前提条件
    - 入力値
    - 期待値
    - 実績値
  quality_checks:
    - テストケース数 >= 50件
    - 要件カバレッジ 100%（全機能要件がテストで検証されているか）
  version: v1.0
  last_updated: 2026-04-08
  status: approved

---

成果物011:
  id: TEST-UNIT-TF-001
  name: 単体テスト実行結果（Terraform Test Framework）
  phase: テスト
  owner_agent: @infra-test
  format: json
  location: /infra/terraform/tests/results.json
  inputs:
    - TEST-CASE-001
    - IMPL-TF-NW-001
  consumers:
    - TEST-REPORT-001
  required_sections:
    - テスト実行時刻
    - テスト対象バージョン
    - テストケース数
    - パス/失敗数
    - カバレッジ率
  quality_checks:
    - テストパス率 100%（失敗件数ゼロ）
    - コードカバレッジ >= 80%
  version: v1.0
  last_updated: 2026-04-12
  status: approved

---

成果物012:
  id: TEST-REPORT-001
  name: テスト実行実績報告書
  phase: テスト
  owner_agent: @infra-test
  format: markdown/pdf
  location: /docs/testing/test-report.md
  inputs:
    - TEST-UNIT-TF-001
    - TEST-INT-TF-001
  consumers:
    - RELEASE-001
  required_sections:
    - テスト概要
    - テスト実行状況（実行数/パス数/失敗数）
    - バグ一覧（重要度別）
    - テストカバレッジ結果
    - リリース判定（合格/条件付き/不合格）
  quality_checks:
    - Level 1, 2 バグ ゼロか
    - テスト実行率 >= 95%か
  version: v1.0
  last_updated: 2026-04-14
  status: approved
```

### フェーズ5: リリース

```yaml
成果物013:
  id: RELEASE-001
  name: リリースノート
  phase: リリース
  owner_agent: @pm-infra-cicd
  format: markdown
  location: /docs/release-notes/v1.0.0.md
  inputs:
    - TEST-REPORT-001
    - DESIGN-NW-001
    - DESIGN-SEC-001
  consumers: []
  required_sections:
    - リリース概要
    - 新機能
    - バグ修正
    - 既知の制限事項
    - アップグレード手順
    - ロールバック手順
  quality_checks:
    - アップグレード手順が明確か
    - ロールバック手順が明確か
  version: v1.0.0
  last_updated: 2026-04-20
  status: released

---

成果物014:
  id: OPS-RUNBOOK-001
  name: 運用手順書
  phase: 運用
  owner_agent: @infra-operations
  format: markdown
  location: /docs/operations/runbook.md
  inputs:
    - DESIGN-NW-001
    - DESIGN-MON-001
  consumers: []
  required_sections:
    - 日次運用手順
    - 障害対応手順
    - バックアップ・復旧手順
    - パッチ管理方法
    - アラート対応ガイド
  quality_checks:
    - トラブルシューティング情報が含まれているか
    - 連絡先/エスカレーション先が明記されているか
  version: v1.0
  last_updated: 2026-04-20
  status: approved

---

成果物015:
  id: CHANGE-LOG-001
  name: 変更管理台帳
  phase: 全フェーズ
  owner_agent: @pm-config-change
  format: yaml
  location: /docs/config-baseline.yaml
  inputs: []
  consumers: []
  required_sections:
    - 成果物名
    - 現行版
    - 最終更新日
    - ステータス
    - 変更履歴
    - Git Tag
  quality_checks:
    - 全成果物が登録されているか
    - バージョン番号が更新されているか
  version: v1.0
  last_updated: 2026-04-20
  status: active
```

---

## メタデータ検証ツール（Python スクリプト例）

```python
#!/usr/bin/env python3
import yaml
import sys

def validate_artifact_metadata(metadata_file):
    """成果物メタデータを検証"""
    with open(metadata_file) as f:
        data = yaml.safe_load(f)

    errors = []

    for artifact_id, artifact in data.items():
        # 必須フィールド確認
        required = ['id', 'name', 'phase', 'owner_agent', 'format', 'location']
        for field in required:
            if field not in artifact:
                errors.append(f"{artifact_id}: Missing '{field}'")

        # バージョン形式確認
        version = artifact.get('version', '')
        if not version.startswith('v'):
            errors.append(f"{artifact_id}: Version should start with 'v'")

        # 依存関係チェック（循環依存）
        if check_circular_dependency(artifact.get('inputs', []), artifact_id):
            errors.append(f"{artifact_id}: Circular dependency detected")

    if errors:
        print("Validation errors:")
        for err in errors:
            print(f"  - {err}")
        sys.exit(1)
    else:
        print("✓ All artifacts validated successfully")

if __name__ == '__main__':
    validate_artifact_metadata('artifacts-metadata.yaml')
```
