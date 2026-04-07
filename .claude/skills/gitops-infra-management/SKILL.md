---
description: GitOpsベースのインフラ変更管理（PRベースワークフロー、ブランチ戦略、承認フロー、マージポリシー）
---

# GitOps ベースのインフラ変更管理

## 概要

GitOps とは、インフラストラクチャの全ての変更を Git リポジトリで管理し、Pull Request ベースで承認・適用するアプローチです。本ガイドはインフラコード（Terraform, CloudFormation）の変更管理に特化しています。

---

## 1. Git Flow ブランチ戦略

```
┌─ main (本番環境)
│  ├─ Git Tag: v1.0, v1.1, v2.0...
│  └─ リリース版の確定
│
├─ release/* (リリース準備)
│  └─ 本番へのマージ前の最終テスト
│
└─ develop (開発ベース)
   ├─ feature/* (機能開発)
   ├─ bugfix/* (バグ修正)
   └─ hotfix/* (本番緊急修正)
```

### ブランチ命名規約

```
■ feature ブランチ
  feature/CHG-YYYYMMDD-001-brief-description
  例: feature/CHG-20260406-001-add-vpcflowlogs

■ bugfix ブランチ
  bugfix/CHG-YYYYMMDD-002-brief-description
  例: bugfix/CHG-20260405-002-fix-sg-rule-order

■ hotfix ブランチ（本番緊急）
  hotfix/CHG-YYYYMMDD-003-brief-description
  例: hotfix/CHG-20260406-003-urgent-sec-patch

■ release ブランチ
  release/v1.0, release/v1.1等

■ 命名ルール
  - すべて小文字
  - 単語は - でつなぐ
  - 先頭に変更要求ID（CHG-YYYYMMDD-NNN）を付ける
  - ブリーフ説明は 30文字以内
```

---

## 2. PR（Pull Request）ベースワークフロー

### PR 作成フロー

```
1. ブランチ切成
   git checkout develop
   git checkout -b feature/CHG-20260406-001-add-vpcflowlogs

2. 変更実装
   vim infra/terraform/network/main.tf
   ...

3. ローカルテスト
   terraform validate
   terraform fmt
   terraform plan

4. Git コミット
   git add .
   git commit -m "feat(vpc): add VPC flowlogs to CloudWatch Logs"

5. GitHub に push
   git push origin feature/CHG-20260406-001-add-vpcflowlogs

6. PR 作成（GitHub Web UI）
   ブランチ: feature/CHG-... → develop
   タイトル: feat(vpc): add VPC flowlogs
   説明: テンプレートに従って記入
```

### PR テンプレート（.github/pull_request_template.md）

```markdown
## 変更要求ID
CHG-20260406-001

## 変更概要
{変更の背景と目的を簡潔に記入}

## 変更内容
- Before: VPC フローログが記録されていない
- After: VPC フローログを CloudWatch Logs に出力

## 影響対象の成果物
- [x] NW設計書
- [x] Terraform コード (vpc モジュール)
- [ ] セキュリティ設計書

## テスト方法
- [x] `terraform validate` パス
- [x] `terraform fmt` チェック
- [x] `terraform plan` で想定通りの変更を確認
- [x] ローカル環境で CloudWatch Logs 出力確認

## チェックリスト
- [x] コミットメッセージがコンベンション（conventional-commits）に従っているか
- [x] 機密情報（APIキー、パスワード）がないか
- [x] ドキュメント（設計書、README）が更新されているか
- [x] テスト追加またはテストが変更内容をカバーしているか

## レビュアー
@technical-lead @pm

## リンク
関連Issue: #123
変更要求書: docs/changes/CHG-20260406-001.md
```

---

## 3. レビュー・承認フロー

### レビュアー割り当て

```
develop へのマージ:
  - 必須レビュアー 2名
    1. @technical-lead （技術観点）
    2. @pm または @infra-team-lead （プロジェクト観点）
  - オプション: @security-reviewer （セキュリティ観点）

main へのマージ:
  - 必須レビュアー 3名
    1. @technical-lead
    2. @pm
    3. @security-reviewer または @operations-lead
  - Approval: 全員一致（承認）必須
```

### Code Review チェックリスト（レビュアー向け）

```
■ 機能・動作確認
  [ ] terraform plan 出力が想定通りか
  [ ] セキュリティグループ/IAM ポリシーが最小権限か
  [ ] 新リソースは適切にタグ付けされているか

■ コード品質
  [ ] terraform fmt に従っているか
  [ ] 変数値が hardcode されていないか（variables.tf に移動）
  [ ] リソース名が命名規則に従っているか（snake_case）

■ ドキュメント
  [ ] 設計書が更新されているか（Terraform コード変更時）
  [ ] README / 実装ガイドが更新されているか
  [ ] 難しいロジックにコメントが付いているか

■ 影響分析
  [ ] 既存リソースへの影響がないか
  [ ] デストラクティブな変更（削除等）がないか
  [ ] リソース置換が想定されているか
```

### コメント例

```
✓ Good:
  "VPC CIDR ブロック 10.0.0.0/24 はプライベートサブネット用として
   設計書の Table 3.1 に記載されていますね。確認しました。"

✗ Bad:
  "なんか変です。修正してください。"
```

---

## 4. マージポリシー

### develop ← feature（開発環境へのマージ）

```
条件:
  ✓ Code Review: 2名以上の Approve
  ✓ CI/CD チェック: 全テストパス
    - terraform validate
    - terraform fmt check
    - unit tests

マージ方法: Squash Merge
  → 開発歴の細かいコミットを1つに統合
  → develop のコミット履歴を簡潔に保つ

コミットメッセージ:
  feat(vpc): add VPC flowlogs to CloudWatch Logs (#45)

ブランチ削除: 自動削除（マージ後）
```

### main ← release（本番環境へのマージ）

```
条件:
  ✓ Code Review: Technical Lead + PM の Approve
  ✓ CI/CD チェック: 全テストパス + セキュリティスキャンパス
  ✓ 本番テスト環境での検証: 完了

マージ方法: Create a Merge Commit
  → 本番履歴として、マージ時点を記録
  → 本番環境への適用が、どのコミットで行われたかを把握

Git Tag 作成: 自動作成
  Tag 名: v<version> （例: v1.0.0）
  Tag メッセージ: リリースノート記載

例:
  git tag -a v1.0.0 -m "Release: NW フローログ機能追加"

ブランチ削除: 手動（リリースブランチは保持することもある）
```

---

## 5. 変更要求（CHG）と PR の対応関係

```
変更要求書（Issue）
  │
  ├─ 変更ID: CHG-20260406-001
  ├─ ステータス: 待機中
  └─ リンク: PR #45

Pull Request
  │
  ├─ PR ID: #45
  ├─ ブランチ: feature/CHG-20260406-001-add-vpcflowlogs
  ├─ ステータス: Review in Progress
  ├─ レビュアー: @tech-lead, @pm
  └─ リンク: Issue #CHG-20260406-001

マージ実行
  │
  ├─ PR #45 マージ: Approved
  ├─ Issue CHG-20260406-001: Closed
  ├─ develop ブランチ更新
  └─ Git コミットに Issue リンク含まれる

本番デプロイ
  │
  ├─ release/v1.0 作成
  ├─ PR #46: release/v1.0 → main
  ├─ ステアリングコミッティ Approval
  ├─ Merge to main
  ├─ Git Tag: v1.0.0 作成
  └─ CI/CD: 自動デプロイ開始
```

---

## 6. コンフリクト解決フロー

### マージコンフリクト検出時

```
GitHub が自動検出:
  "This branch has conflicts that must be resolved"

対応フロー:
1. ローカルで最新の develop をフェッチ
   git fetch origin develop

2. develop をマージ
   git merge origin/develop

3. コンフリクト箇所を手動修正
   vim infra/terraform/vpc/main.tf
   （<<<<<<, ======, >>>>>> の標識を確認・修正）

4. テストして確認
   terraform validate

5. 修正をコミット
   git add .
   git commit -m "Merge: resolve conflicts from develop"

6. Force push（注意！）
   git push origin feature/CHG-... --force-with-lease

7. GitHub で再度 Code Review 実施
```

---

## 7. ホットフィックスフロー（本番緊急対応）

```
本番で問題が発生

  ↓

hotfix ブランチを main から切成
  git checkout main
  git checkout -b hotfix/CHG-20260406-003-sec-patch

  ↓

修正実装＋テスト
  terraform validate
  terraform plan
  # 修正内容確認

  ↓

PR を main へ作成（ラベル: HOTFIX）
  - レビュアー: Technical Lead 1名（速攻）
  - 承認後即マージ可

  ↓

main へマージ＋本番自動デプロイ

  ↓

develop にも同じ修正をマージ
  git checkout develop
  git cherry-pick <hotfix コミット SHA>
  # 同じ修正を develop にも適用
```

---

## 8. リリースフロー

```
本番リリース前夜:

1. release ブランチを develop から作成
   git checkout develop
   git checkout -b release/v1.0

2. バージョン番号更新
   terraform/version.tf: version = "1.0.0"
   CHANGELOG.md: v1.0.0 セクション記入

3. リリースノート作成
   docs/RELEASE-NOTES-v1.0.0.md

4. PR を main へ
   release/v1.0 → main
   ステアリングコミッティ Approval

5. 本番環境でのテスト
   staging 環境で最終確認

リリース当日:

6. PR マージ
   Merge commit で記録

7. Git Tag 作成
   git tag -a v1.0.0 -m "Release v1.0.0: ..."

8. 本番自動デプロイ開始
   CI/CD パイプライン自動実行

9. デプロイ後検証
   ヘルスチェック、監視確認
```

---

## 9. GitHub セットアップ例

### ブランチ保護ルール（Settings > Branches）

```
Develop ブランチ:
  ✓ Require a pull request before merging
  ✓ Require status checks to pass before merging
    - CI/CD Pipeline
    - terraform validate
    - Code Quality
  ✓ Require branches to be up to date before merging
  ✓ Dismiss stale pull request approvals when new commits are pushed
  ✓ Require review from Code Owners

Main ブランチ:
  ✓ Require a pull request before merging
  ✓ Require status checks to pass before merging（全項目）
  ✓ Require 2+ approvals
  ✓ Require branches to be up to date before merging
  ✓ Restrict who can push to matching branches
    （Technical Lead, DevOps Lead のみ）
```

---

## 10. よくある誤り

```
❌ 誤り1: main に直接 push
   git push origin main --force

✓ 対策: main はブランチ保護でブロック

❌ 誤り2: レビュー者を飛ばしてマージ
   ✓ 対策: PR マージボタンを自動無効化（GitHub ルール設定）

❌ 誤り3: PR の説明がない
   ✓ 対策: PR テンプレート必須、説明なしでは submit 不可に

❌ 誤り4: コミットメッセージが曖昧
   "fix bug" ではなく "feat(vpc): add flowlogs"

✓ 対策: Conventional Commits を強制
```
