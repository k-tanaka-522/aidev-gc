---
name: gc-document-generation-standards
description: GCインフラ案件の成果物生成に関する横断規約。出力形式、テンプレート参照、バージョン管理、納品変換を定義し、23のエージェントが104件の成果物を一貫した品質で生成するための統一基準。
---

# GCインフラ案件 成果物生成標準規約

## 1. 概要

本スキルは、ガバメントクラウド(GC)のAWSインフラ案件において、23のエージェントが104件の成果物を生成する際に適用される**横断的な規約書**です。

- **「何を書くか」** → `gc-artifact-metadata` と `gc-design-document-template` で定義済み
- **「どう作るか」** ← **本スキルで定義**（出力形式、命名規則、テンプレート構造、バージョン管理、納品変換）

目的：
1. 全104件の成果物の形式を統一し、マージ・レビュー・納品を効率化する
2. IPA（情報処理推進機構）の公開ガイドとデジタル庁GCASの規約への準拠を担保する
3. エージェント間の相互参照を明確化し、ドキュメント体系の整合性を保つ
4. 納品時のdocx変換を自動化可能にする

---

## 2. 出力形式規約

### 2.1 マスター形式

**成果物のマスターはMarkdown (.md) とする。**

理由：
- Gitとの親和性が高い（差分管理、競合解決が容易）
- pandocで複数形式（docx, PDF, HTML）への変換が可能
- ソースコード管理の標準（バージョン履歴、ブランチ管理）

### 2.2 図表の出力形式

| 種類 | 形式 | 保存位置 | 参照方法 |
|------|------|--------|--------|
| **アーキテクチャ図、構成図** | draw.io (.drawio) | 成果物と同一ディレクトリ | Markdown から相対パスで埋め込み |
| **ネットワークトポロジー** | draw.io (.drawio) | 同上 | 同上 |
| **フロー図、シーケンス図** | draw.io (.drawio) | 同上 | 同上 |
| **シンプルなテーブル** | Markdown テーブル記法 | .md ファイル内 | 直接記載 |
| **複雑なテーブル（列>10、行>50）** | Excel (.xlsx) | 成果物と同一ディレクトリ | Markdown から相対パスで参照 |
| **IaCコード、設定ファイル例** | fenced code block | .md ファイル内 | 言語指定付き（terraform, python, json等） |
| **数式** | LaTeX記法 | .md ファイル内 | `$$...$$ ` 形式（インライン: `$...$`) |

**納品用docx変換時の扱い:**
- draw.io → PNG出力 → docxに埋め込み
- Excel テーブル → PNG出力 → docxに埋め込み

### 2.3 コードブロック記法

IaCコード、設定ファイル、スクリプト例は言語指定付きfenced code blockで記載：

```markdown
# Terraform の VPC 構成例

\`\`\`terraform
resource "aws_vpc" "main" {
  cidr_block           = var.vpc_cidr
  enable_dns_hostnames = true
  enable_dns_support   = true

  tags = {
    Name        = "${var.project_name}-vpc"
    Environment = var.environment
  }
}
\`\`\`

# CloudFormation テンプレート例

\`\`\`yaml
AWSTemplateFormatVersion: '2010-09-09'
Description: VPC Template for Government Cloud
Parameters:
  VpcCIDR:
    Type: String
    Default: 10.0.0.0/16
\`\`\`

# JSON 設定例

\`\`\`json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": "kms:Decrypt",
      "Resource": "arn:aws:kms:ap-northeast-1:*:key/*"
    }
  ]
}
\`\`\`
```

---

## 3. ファイル命名規則

### 3.1 成果物ID体系

**形式:** `{カテゴリ}-{連番}`

カテゴリ一覧（例）：

| カテゴリ | 対象成果物例 |
|---------|----------|
| **REQ** | 要件定義書、要件仕様書 |
| **NW** | ネットワーク設計書、VPC設計 |
| **SEC** | セキュリティ設計書、IAM設計、WAF設定 |
| **MON** | 監視設計書、CloudWatch設定 |
| **GC** | GC環境構成、GCAS適用 |
| **IaC** | Terraform設計書、モジュール定義 |
| **BAK** | バックアップ・DR設計書 |
| **CST** | コスト最適化設計書 |
| **MIG** | 移行設計書、切替計画 |
| **OPS** | 運用手順書、Runbook |
| **TST** | テスト計画書、テスト仕様書 |
| **EST** | 見積書、工数見積 |
| **PRO** | 提案書 |
| **WBS** | WBS、スケジュール |
| **PMR** | PM報告書、リスク管理表 |

例：
- `NW-001` — ネットワーク設計書 第1版
- `SEC-002` — セキュリティ設計書 第2版
- `EST-001` — システム構築見積書
- `REQ-001` — 要件定義書

### 3.2 ファイル名

**形式:** `{成果物ID}_{日本語タイトル}.md`

例：
- `NW-001_ネットワーク設計書.md`
- `SEC-002_IAMロール設計書.md`
- `EST-001_システム構築見積書.md`
- `REQ-001_要件定義書.md`

**ルール:**
- 成果物IDとタイトルはアンダースコア(`_`)で区切る
- 日本語タイトルにスペース、スラッシュは使わない（ハイフンはOK）
- 拡張子は `.md` で統一

### 3.3 図ファイル名

**形式:** `{成果物ID}-{図名}.drawio`

例：
- `NW-001-vpc-architecture.drawio` — NW-001に含まれるVPCアーキテクチャ図
- `NW-001-subnet-layout.drawio` — サブネット構成図
- `SEC-002-iam-policy-tree.drawio` — IAM ポリシーツリー

**ルール:**
- 図名は英語のケバブケース（`vpc-architecture`, `subnet-layout`）
- 同一成果物内に複数図がある場合は連番を追加: `NW-001-vpc-architecture-01.drawio`

### 3.4 Excel テーブルファイル名

**形式:** `{成果物ID}-{テーブル名}.xlsx`

例：
- `EST-001-cost-breakdown.xlsx` — コスト内訳テーブル
- `TST-001-test-matrix.xlsx` — テストマトリクス

---

## 4. Markdownテンプレート標準構造

### 4.1 YAMLフロントマター（全成果物共通）

```yaml
---
artifact_id: NW-001
title: ネットワーク設計書
version: 1.0
status: draft | review | approved | final
author: "[エージェント名] (gc-network-design)"
reviewer: ""
approved_by: ""
created_at: 2026-04-06
updated_at: 2026-04-06
phase: 4
dependencies:
  - artifact: REQ-001
    title: 要件定義書
    reason: 非機能要件（ネットワーク遅延、可用性）に基づいて設計
  - artifact: SEC-001
    title: セキュリティ設計書
    reason: VPC内IAMポリシーとSG設定の連携確認
---
```

**フィールド説明:**

| フィールド | 説明 | 例 |
|-----------|------|-----|
| `artifact_id` | 成果物ID（3.1参照） | `NW-001` |
| `title` | 成果物の日本語タイトル | `ネットワーク設計書` |
| `version` | セマンティックバージョニング（MAJOR.MINOR） | `1.0`, `1.1`, `2.0` |
| `status` | draft / review / approved / final | `draft`: 初版, `review`: レビュー中, `approved`: 承認済み, `final`: 納品版 |
| `author` | 執筆エージェント（エージェント名と識別子） | `[gc-network-design]` |
| `reviewer` | レビュアー（指定がなければ空白） | `[gc-qa]` or `""` |
| `approved_by` | 承認者（PM、プロジェクトマネージャー等） | `Project Manager` or `""` |
| `created_at` | 初版作成日（ISO 8601形式） | `2026-04-06` |
| `updated_at` | 最終更新日 | `2026-04-06` |
| `phase` | IPAフェーズ（0-7） | `4` (基本設計) |
| `dependencies` | 参照先成果物（リスト形式） | 左の例参照 |

### 4.2 改訂履歴テーブル

成果物の先頭（フロントマター直後）に改訂履歴を記載：

```markdown
## 改訂履歴

| バージョン | 更新日 | 更新者 | 変更内容 | ステータス |
|-----------|--------|--------|--------|----------|
| 1.0 | 2026-04-06 | gc-network-design | 初版作成。VPC/TGW設計、LGWAN接続設計を追加 | draft |
| 1.1 | 2026-04-08 | gc-network-design | レビュー指摘により DirectConnect 冗長構成を追加（Issue #23） | review |
| 2.0 | 2026-04-10 | gc-security | セキュリティ設計との連携を反映し、VPC Flow Logs 設定を追加 | approved |
```

**ルール:**
- 各更新時に新行を追加（手動管理）
- 変更内容はコミットメッセージと連動
- Issue 番号がある場合は参照形式 `(Issue #XX)` で記載
- ステータスはfrontmatterのstatusと同期させる

### 4.3 目次（TOC）

自動生成対応のため、マーカーを記載：

```markdown
## 目次

<!-- TOC -->
<!-- /TOC -->
```

pandocで自動生成する場合、以下のコマンドを使用：
```bash
pandoc --toc --toc-depth=2 input.md -o output.md
```

### 4.4 本文構造（IPA 5W1H + デジタル庁GC規約）

`gc-design-document-template` で定義された構造に準拠：

```markdown
## 1. 概要・目的

### 1.1 背景
（REQ-001 §3.2 の要件からの導出を明記）

### 1.2 目的・スコープ
（この設計書がカバーする範囲）

### 1.3 制約条件・前提条件
（GCAS, ISMAP, 法的制約など）

---

## 2. 現状分析（既存システム/要件の整理）

### 2.1 [項目]
（根拠: REQ-001 §2.1）

---

## 3. 設計方針

### 3.1 基本設計原則
（セキュリティ優先、コスト最適化、スケーラビリティ等）

### 3.2 デジタル庁GCAS準拠事項
（GC自動適用テンプレート、必須適用テンプレートへの対応）

---

## 4. 詳細設計

### 4.1 [主要コンポーネント]

#### 4.1.1 構成
- [具体的な設定値、パラメータ]
- 図参照: ![VPC Architecture](./NW-001-vpc-architecture.drawio)

#### 4.1.2 根拠
（なぜこの選択か、IPA/GCAS/ISMAP等の規約準拠の説明）

---

## 5. IaC実装（該当する場合）

### 5.1 Terraform モジュール構成

```terraform
module "vpc" {
  source = "./modules/vpc"

  vpc_cidr       = var.vpc_cidr
  enable_nat_gw  = var.enable_nat_gw

  tags = merge(
    var.common_tags,
    { Component = "network" }
  )
}
```

---

## 6. セキュリティ考慮事項

（SEC-001 との連携、ISMAP統制項目への対応）

---

## 7. 運用・監視設計

（MON-001 との連携）

---

## 8. コスト試算

（CST-001 との参照）

---

## 9. 検証・テスト方針

（TST-001 との連携）

---

## 10. リスク・制限事項

- [リスク項目] → [対応方針]

---

## 11. 今後の検討事項

---

## 付録

### A. パラメータシート
[参照ファイル: `NW-001-parameters.xlsx`]

### B. レファレンス
- IPA「非機能要求グレード v1.2」
- デジタル庁GC全般的ガイド（https://guide.gcas.cloud.go.jp/general/overview-explanation）
- GCAS マニュアル（GC移行マニュアルv3.0）
- ISMAP 管理基準
```

---

## 5. IPA準拠テンプレート参照マップ

各成果物カテゴリが準拠すべきIPA/デジタル庁ガイドを明記：

| 成果物カテゴリ | 対応するIPA/公開ガイド | 必須セクション | 参照リンク |
|--------------|-------------------|--------------|----------|
| **REQ** (要件定義) | ユーザのための要件定義ガイド第2版 (IPA) | 機能要件、非機能要件、制約条件、受入基準 | https://www.ipa.go.jp/archive/digital/tools/ep/ |
| **非機能要件詳細** | 非機能要求グレード v1.2 (IPA) | 6大項目（パフォーマンス、セキュリティ、信頼性、拡張性、運用性、保守性）×234小項目から該当項を選定 | - |
| **NW** (ネットワーク設計) | GC移行マニュアルv3.0, GC全般的ガイド, IPA基本設計ガイド | VPC構成、LGWAN接続、TGW設定、DirectConnect | https://guide.gcas.cloud.go.jp/ |
| **SEC** (セキュリティ設計) | ISMAP管理基準 305統制項目, IPA基本設計ガイド | IAM設計、KMS設定、WAF規則、GuardDuty、暗号化方式 | - |
| **MON** (監視・ログ設計) | IPA「ITプロジェクトの見える化 中流工程編」 | CloudWatch設定、CloudTrail、ログ保持期間、アラート閾値 | - |
| **GC** (GC環境構成) | GCAS自動適用テンプレート, 必須適用テンプレート (AWS CDK) | テンプレート適用手順、GCAS申請、SSO設定 | https://gcas.cloud.go.jp/ |
| **IaC** (Terraform/CDK設計) | IPA「共通フレーム2013」+ GC標準IaC規約 | モジュール設計、変数定義、状態管理 | - |
| **BAK** (バックアップ・DR設計) | IPA基本設計ガイド, RTO/RPO定義 | バックアップ戦略、リストア手順、RTO/RPO指標 | - |
| **CST** (コスト最適化) | AWS Well-Architected フレームワーク (コスト最適化の柱) | RI/Savings Plans 分析、アーキテクチャ最適化、コスト配分 | - |
| **MIG** (移行設計) | IPA「共通フレーム2013」移行フェーズ | 移行戦略、切替計画、リハーサル、Go/No-Go判定 | - |
| **OPS** (運用手順) | IPA「ITプロジェクトの見える化」運用ハンドブック | Runbook フォーマット、パッチ手順、インシデント対応 | - |
| **TST** (テスト計画) | IPA「共通フレーム2013」テストプロセス | テスト項目、テストケース、合格基準、性能テスト定義 | - |
| **EST** (見積書) | IPA「超上流から攻めるIT化の事例集」見積方法論 | 工数見積、リスク係数、EVM指標 | https://www.ipa.go.jp/ |
| **PRO** (提案書) | IPA「IT化推進ガイド」提案資料のポイント | 概要、実現方法、体制、リスク対応、スケジュール | - |
| **WBS** (WBS/スケジュール) | IPA「共通フレーム2013」プロジェクト計画 | タスク分解、リソース配置、マイルストーン、EVM | - |
| **PMR** (PM報告書・リスク管理) | IPA「共通フレーム2013」プロジェクト管理 | 進捗率、EVM指標、リスク評価表、対応策 | - |

**ISMAP統制項目の該当箇所:**
- セキュリティ設計書には、該当する305統制項目の番号を明記する
  - 例：`（ISMAP 3.1.1 アクセス制御 §305-2-a: IAM ロールベース設定）`

---

## 6. 成果物間の相互参照規約

### 6.1 相互参照の記法

Markdown内では以下の形式で参照：

```markdown
[REQ-001: 要件定義書](../requirements/REQ-001_要件定義書.md)

これらの非機能要件（根拠: [REQ-001 §3.2](../requirements/REQ-001_要件定義書.md#3-2-非機能要件)）に基づいて設計した。
```

**相対パスルール:**
- ファイルは成果物カテゴリごとにサブディレクトリを切る
  ```
  /artifacts/
    /requirements/
      REQ-001_要件定義書.md
    /network/
      NW-001_ネットワーク設計書.md
      NW-001-vpc-architecture.drawio
    /security/
      SEC-001_セキュリティ設計書.md
    /monitoring/
      MON-001_監視設計書.md
  ```

### 6.2 frontmatter の dependencies

参照関係を機械可読にするため、frontmatterのdependenciesに記録：

```yaml
dependencies:
  - artifact: REQ-001
    title: 要件定義書
    section: "§3.2 非機能要件"
    reason: "ネットワーク遅延、可用性要件に基づいて VPC 設計を策定"
  - artifact: SEC-001
    title: セキュリティ設計書
    section: "§4.1 IAM ロール設計"
    reason: "VPC 内通信の暗号化設定と SG ルール連携"
  - artifact: MON-001
    title: 監視設計書
    section: "§2 監視対象リソース"
    reason: "VPC Flow Logs と CloudWatch メトリクス連携"
```

### 6.3 設計判定根拠の明記ルール

設計判定（「なぜこの選択か」）を述べる際は、必ず根拠を参照する：

```markdown
### 4.1 VPC CIDR 設計

10.0.0.0/16 を採用した根拠：
- 非機能要件（根拠: [REQ-001 §3.2.1](../requirements/REQ-001_要件定義書.md#3-2-1-スケーラビリティ)）
  では 3 年間で 8,000 台のサーバ展開を想定
- IPA「ネットワーク設計ガイド」では /16 で約 65,000 ホストをサポート可能
- GCAS 推奨範囲（10.0.0.0～10.255.255.255）内に収納
```

---

## 7. バージョン管理規約

### 7.1 Git ブランチ戦略

**ブランチ命名:** `docs/{phase}/{artifact-id}`

例：
```
docs/phase2/REQ-001      — 要件定義書（Phase 2）
docs/phase4/NW-001       — ネットワーク設計書（Phase 4）
docs/phase5/TST-001      — テスト計画書（Phase 5）
docs/phase1/EST-001      — 見積書（Phase 1）
```

**運用フロー:**
1. 新規成果物作成時は、`main` から新ブランチを切る
2. エージェントがドラフトを執筆・コミット
3. Pull Request を作成し、レビュアー（@infra-qa, @pm-review等）に割り当て
4. レビュー指摘に対応し、コミット追加
5. 承認後 `main` にマージ

### 7.2 コミットメッセージ形式

```
[{成果物ID}] {変更内容}

{詳細説明（70字程度まで）}

{Issue 番号、参照情報}
```

例：
```
[NW-001] VPC CIDR 設計を追加

GCAS 推奨範囲内での /16 ブロック選定、サブネット分割戦略
VPC Flow Logs 設定による監視設計との連携を記載。

Refs: REQ-001 §3.2 非機能要件
Closes: #42
```

### 7.3 改訂履歴の記録

- **frontmatter**: `version`, `updated_at`, `status` を更新
- **改訂履歴テーブル**: 新行を追加（手動記入）
- **Git**: 各更新でコミット（ファイル名にバージョン番号は入れない）

```yaml
version: 1.1              # セマンティックバージョニング
status: review            # draft → review → approved → final
updated_at: 2026-04-08    # ISO 8601
```

### 7.4 マージ戦略

- **ファストフォワード（FF）:** 簡単な修正・追記の場合
  ```bash
  git merge --ff-only docs/phase4/NW-001
  ```

- **通常マージ（非FF）:** 複数レビュー指摘対応の場合
  ```bash
  git merge --no-ff docs/phase4/NW-001 -m "[NW-001] merge: Phase 4 design document"
  ```

---

## 8. 納品用docx変換規約

### 8.1 Pandoc コマンド

```bash
# 基本的な変換
pandoc -f markdown -t docx \
  --reference-doc=.claude/templates/template.docx \
  --table-of-contents \
  --toc-depth=2 \
  -o artifacts/NW-001_ネットワーク設計書.docx \
  artifacts/network/NW-001_ネットワーク設計書.md

# フィルタを用いた図の埋め込み
pandoc -f markdown -t docx \
  --reference-doc=.claude/templates/template.docx \
  --filter pandoc-crossref \
  --resource-path=artifacts/network \
  -o output.docx input.md
```

### 8.2 変換用テンプレート配置

テンプレートファイル（Word形式）を版管理：

```
.claude/templates/
  ├── template.docx              — 基本テンプレート（フォント、スタイル、ロゴ）
  ├── template-security.docx     — セキュリティ系成果物用
  ├── template-estimation.docx   — 見積書用（金額フォーマット）
  └── template-proposal.docx     — 提案書用（表紙、目次フォーマット）
```

**テンプレート要件:**
- フォント: ゴシック体（日本語）、Arial等（英語）
- ページサイズ: A4
- ヘッダー・フッター: 成果物ID、ページ番号
- スタイル定義: Heading1～Heading5, コードブロック, テーブル

### 8.3 図表のdocxへの埋め込み

#### draw.io の場合

1. draw.io から PNG 出力（300 DPI）
   ```bash
   # draw.io CLIを使用
   drawio -f png -o NW-001-vpc-architecture.png \
     NW-001-vpc-architecture.drawio
   ```

2. Markdown に画像参照を記載
   ```markdown
   ![VPC Architecture](./NW-001-vpc-architecture.png)
   ```

3. Pandoc 変換時に自動埋め込み
   ```bash
   pandoc --resource-path=. -o output.docx input.md
   ```

#### Excel テーブルの場合

1. Excel から PNG スクリーンショット
   ```bash
   python3 <<EOF
   import openpyxl
   from openpyxl.drawing.image import Image as XLImage
   # (スクリーンショット処理)
   EOF
   ```

2. Markdown に画像参照
   ```markdown
   ![コスト内訳](./EST-001-cost-breakdown.png)
   ```

### 8.4 変換スクリプト例（Bash）

```bash
#!/bin/bash
# convert_to_docx.sh

ARTIFACT_DIR=${1:-.}
TEMPLATE_DIR=".claude/templates"
OUTPUT_DIR="output"

mkdir -p "$OUTPUT_DIR"

for md_file in "$ARTIFACT_DIR"/**/*.md; do
    # ファイル名を取得
    basename=$(basename "$md_file" .md)
    artifact_id=$(echo "$basename" | cut -d_ -f1)

    # テンプレート選定
    if [[ "$artifact_id" =~ ^EST|PRO ]]; then
        template="$TEMPLATE_DIR/template-estimation.docx"
    elif [[ "$artifact_id" =~ ^SEC ]]; then
        template="$TEMPLATE_DIR/template-security.docx"
    else
        template="$TEMPLATE_DIR/template.docx"
    fi

    # 図表ファイルをPNGに変換
    dir=$(dirname "$md_file")
    for drawio_file in "$dir"/*.drawio; do
        [ -f "$drawio_file" ] && \
        drawio -f png -o "${drawio_file%.drawio}.png" "$drawio_file"
    done

    # Pandoc 変換
    pandoc -f markdown -t docx \
        --reference-doc="$template" \
        --table-of-contents \
        --toc-depth=2 \
        --resource-path="$dir" \
        -o "$OUTPUT_DIR/${basename}.docx" \
        "$md_file"

    echo "✓ Converted: $md_file → $OUTPUT_DIR/${basename}.docx"
done

echo "All conversions completed."
```

使用方法：
```bash
chmod +x convert_to_docx.sh
./convert_to_docx.sh artifacts/
```

### 8.5 見積書・WBS・提案書の納品用変換

Markdownをマスターとしつつ、以下の成果物は納品時にExcel/PowerPointに変換する。

#### 見積書 → Excel (.xlsx)

Markdownの見積テーブルをopenpyxlで変換し、**数式・書式・チャートを自動付加**する:

```python
#!/usr/bin/env python3
# convert_estimation_to_xlsx.py
"""見積書Markdownの工数・コスト表をExcelに変換（数式付き）"""
import openpyxl
from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
from openpyxl.utils import get_column_letter
from openpyxl.chart import BarChart, Reference
import re, sys

def convert_estimation(md_path, xlsx_path):
    wb = openpyxl.Workbook()

    # --- シート1: 工数見積 ---
    ws1 = wb.active
    ws1.title = "工数見積"
    # ヘッダースタイル
    header_fill = PatternFill(start_color="4472C4", end_color="4472C4", fill_type="solid")
    header_font = Font(bold=True, color="FFFFFF", size=11)

    # Markdownテーブルをパースしてセルに配置
    # SUM数式を自動挿入（例: =SUM(C3:C15)）
    # 条件付き書式（高コスト行をハイライト）

    # --- シート2: AWS利用料 ---
    ws2 = wb.create_sheet("AWS利用料")
    # 月額・年額の計算数式
    # =B3*12 等の年額自動計算

    # --- シート3: コスト内訳チャート ---
    ws3 = wb.create_sheet("コスト内訳")
    chart = BarChart()
    chart.title = "フェーズ別工数内訳"
    chart.type = "col"
    chart.style = 10
    # データ参照をシート1から取得

    wb.save(xlsx_path)
    print(f"✓ 変換完了: {xlsx_path}")

if __name__ == "__main__":
    convert_estimation(sys.argv[1], sys.argv[2])
```

**見積Excel必須シート:**
| シート名 | 内容 |
|---------|------|
| 表紙 | 案件名、提出日、提出先、版数 |
| 工数見積 | フェーズ別・ロール別工数（SUM数式付き） |
| AWS利用料 | サービス別月額・年額（計算数式付き） |
| リスクバッファ | リスク項目と係数（乗算数式付き） |
| コスト内訳 | 棒グラフ/円グラフ |
| 前提条件 | 前提条件・制約事項一覧 |

#### WBS → Excel (.xlsx)

WBSはMarkdownテーブル → Excelガントチャートに変換:

```python
# 主要な変換ロジック
# - タスク名、開始日、終了日、担当、前後関係をMarkdownから抽出
# - 条件付き書式でガントチャートを自動生成（セル塗りつぶし）
# - クリティカルパスを赤色でハイライト
# - マイルストーンを◆マーカーで表示
```

**WBS Excel必須シート:**
| シート名 | 内容 |
|---------|------|
| WBS | タスク一覧（階層インデント、工数、担当、開始/終了日） |
| ガントチャート | 条件付き書式による視覚化 |
| リソース配分 | ロール別の月次稼働表（積み上げグラフ） |
| マイルストーン | フェーズゲート判定日一覧 |

#### 提案書 → PowerPoint (.pptx)

提案書のMarkdownをpython-pptxでスライドに変換:

```python
# 主要な変換ロジック
# - ## 見出し → 新しいスライド
# - テーブル → PowerPointテーブル
# - draw.io PNG → スライドに画像挿入
# - フッター: 案件名、ページ番号、CONFIDENTIAL
```

**提案書PowerPoint構成:**
| スライド | 内容 |
|---------|------|
| 1 | 表紙（案件名、提出先、提出日、会社名） |
| 2 | 目次 |
| 3-5 | エグゼクティブサマリー |
| 6-10 | アーキテクチャ概要（draw.io図埋め込み） |
| 11-13 | セキュリティ・ISMAP対応 |
| 14-16 | 移行計画 |
| 17-18 | 体制・スケジュール |
| 19 | コスト概要（見積Excelから主要数値を引用） |
| 20 | リスクと対応策 |

#### 変換タイミング

| 成果物 | 普段の作業 | レビュー時 | 納品時 |
|-------|-----------|-----------|-------|
| 設計書 | .md | .md（Gitで差分レビュー） | .docx（pandoc変換） |
| 見積書 | .md | .md + .xlsx（計算検証用） | .xlsx（数式・チャート付き） |
| WBS | .md | .md + .xlsx（ガントチャート確認用） | .xlsx（ガントチャート付き） |
| 提案書 | .md | .md + .pptx（見せ方確認用） | .pptx + .pdf |

---

## 8.6 ビジネスデザイン規約（納品物の見た目）

**お客様（自治体担当者・意思決定者）が直接目にする成果物は、プロフェッショナルな見た目にすること。**

### カラーパレット（全成果物共通）

| 用途 | 色コード | 使用箇所 |
|------|---------|---------|
| メインカラー | `#1B3A5C` (ダークネイビー) | 見出し、表ヘッダー、スライドタイトル |
| アクセント | `#2E7D8C` (ティールブルー) | 強調箇所、アイコン、チャートの主色 |
| サブアクセント | `#4CAF50` (グリーン) | OK/達成/完了の表現 |
| 警告 | `#E65100` (ダークオレンジ) | リスク、注意事項 |
| 背景（薄い） | `#F5F7FA` (ライトグレー) | テーブル交互行、スライド背景 |
| テキスト | `#333333` (チャコール) | 本文テキスト |
| サブテキスト | `#666666` (ミディアムグレー) | 補足、注釈 |

### フォント

| 用途 | 日本語 | 英語/数字 |
|------|-------|----------|
| 見出し | 游ゴシック Bold / Noto Sans JP Bold | Arial Bold |
| 本文 | 游ゴシック Regular / Noto Sans JP | Arial |
| 数値・コード | - | Consolas / Source Code Pro |

### Excel デザイン規約

```
■ ヘッダー行:
  - 背景: #1B3A5C (ダークネイビー)
  - 文字: #FFFFFF (白), Bold, 11pt
  - 罫線: 下線のみ (thin, #1B3A5C)

■ データ行:
  - 背景: 交互に #FFFFFF / #F5F7FA
  - 文字: #333333, Regular, 10pt
  - 罫線: 横線のみ (thin, #E0E0E0)

■ 合計行:
  - 背景: #E8EDF2 (薄いブルーグレー)
  - 文字: #1B3A5C, Bold, 11pt
  - 上罫線: double, #1B3A5C

■ 金額セル:
  - 数値書式: #,##0（千円単位の場合は #,##0 千円）
  - 右揃え

■ チャート:
  - メイン色: #2E7D8C
  - サブ色: #4CAF50, #FF9800, #9C27B0, #F44336
  - 背景: なし（透明）
  - グリッド線: #E0E0E0 (薄いグレー)
  - タイトル: 12pt, Bold, #1B3A5C
```

### PowerPoint デザイン規約

```
■ スライドマスター:
  - 背景: #FFFFFF
  - アクセントバー: 左端に3px幅の #1B3A5C 縦線
  - フッター: 右下にページ番号, 左下に「CONFIDENTIAL」

■ タイトルスライド:
  - 背景: #1B3A5C → #2E7D8C のグラデーション
  - タイトル: #FFFFFF, 28pt, Bold
  - サブタイトル: #E0E0E0, 16pt

■ コンテンツスライド:
  - タイトル: #1B3A5C, 24pt, Bold
  - 本文: #333333, 14pt
  - 箇条書きマーカー: ■ (四角), #2E7D8C

■ 図表スライド:
  - 図のタイトル: 12pt, Bold, 図の上部
  - 図の下に出典/注記を10pt, #666666 で記載

■ テーブル:
  - Excelと同じカラースキーム
  - セル内余白: 上下4pt, 左右8pt
```

### Word (docx) デザイン規約

```
■ 表紙:
  - 上部30%: #1B3A5C 背景, 白抜きタイトル
  - 中央: 案件名 (24pt, Bold)
  - 下部: 提出先、提出日、版数、作成者

■ 見出し:
  - H1: 16pt, Bold, #1B3A5C, 下線あり, 前後24pt余白
  - H2: 14pt, Bold, #1B3A5C, 前後18pt余白
  - H3: 12pt, Bold, #333333, 前後12pt余白

■ 本文: 10.5pt, #333333, 行間1.5

■ テーブル: Excelと同じカラースキーム

■ ページ設定:
  - サイズ: A4
  - 余白: 上25mm, 下25mm, 左30mm, 右25mm
  - ヘッダー: 左に成果物ID, 右に版数
  - フッター: 中央にページ番号
```

---

## 9. 品質チェックリスト（生成後バリデーション）

各成果物を生成した後、必ず以下のチェックを実施。エージェント自身で実行可能。

### 9.1 フロントマター チェック

```markdown
## チェックリスト: frontmatter

- [ ] artifact_id が {カテゴリ}-{連番} 形式か
- [ ] title が日本語で50字以内か
- [ ] version が MAJOR.MINOR 形式か
- [ ] status が draft/review/approved/final の何れかか
- [ ] author が "[エージェント名] (エージェント識別子)" 形式か
- [ ] created_at, updated_at が ISO 8601 形式（YYYY-MM-DD）か
- [ ] phase が 0-7 の整数か（IPA フェーズ）
- [ ] dependencies に参照先成果物が記録されているか
- [ ] reviewer, approved_by がある場合は妥当か
```

### 9.2 改訂履歴 チェック

```markdown
## チェックリスト: 改訂履歴テーブル

- [ ] 改訂履歴テーブルが frontmatter 直後に存在するか
- [ ] 最新バージョンの行が存在するか
- [ ] updated_at と改訂履歴の日付が一致しているか
- [ ] 変更内容に Issue 番号や参照情報が記載されているか
- [ ] ステータスが frontmatter の status と一致しているか
```

### 9.3 相互参照 チェック

```markdown
## チェックリスト: 相互参照

- [ ] 本文内の全ての参照リンク [ID: タイトル](path/to/file.md) が有効か
- [ ] セクション参照 #セクション名 が存在するか
- [ ] 相対パスが正しいか（相対位置を確認）
- [ ] frontmatter の dependencies に記載された全ファイルが存在するか
- [ ] 設計判定根拠に参照元が明記されているか（「根拠: XXX」）
```

### 9.4 図表 チェック

```markdown
## チェックリスト: 図表

- [ ] ![説明](./path/to/figure.drawio) 形式で相対パスが正しいか
- [ ] draw.io ファイルが存在するか
- [ ] 図のファイル名が {成果物ID}-{図名}.drawio 形式か
- [ ] Excel テーブルの場合、参照パスが記載されているか
- [ ] コードブロックに言語指定（terraform, python等）があるか
- [ ] 複雑な表（列>10, 行>50）が Excel .xlsx 形式で別ファイルか
```

### 9.5 テンプレート準拠 チェック

```markdown
## チェックリスト: テンプレート準拠

- [ ] gc-artifact-metadata で定義された required_sections が全て含まれているか
  （artifact_id で該当カテゴリの required_sections を確認）
- [ ] gc-design-document-template の 5W1H 構成（概要、現状、設計方針、詳細、実装等）が整っているか
- [ ] IPA準拠テンプレート参照マップ（本スキル §5）の必須項目が含まれているか
  （成果物カテゴリの行を確認）
```

### 9.6 IPA/ISMAP準拠 チェック

```markdown
## チェックリスト: IPA/ISMAP準拠

- [ ] 要件定義書: IPA「ユーザのための要件定義ガイド第2版」の128勘どころを確認したか
- [ ] 非機能要件: IPA「非機能要求グレード v1.2」の該当小項目（234項目中）を明記しているか
- [ ] 基本設計: IPA「機能要件の合意形成ガイド」の構成に従っているか
- [ ] セキュリティ設計: ISMAP 305統制項目の該当番号を明記しているか
  （例: ISMAP 3.1.1 §305-2-a）
- [ ] GC環境: GCAS マニュアル、GC自動適用テンプレート に基づいているか
```

### 9.7 バージョン管理 チェック

```markdown
## チェックリスト: バージョン管理

- [ ] ファイル名にバージョン番号が入っていないか（version は frontmatter のみ）
- [ ] git branch が docs/{phase}/{artifact-id} 形式か
- [ ] コミットメッセージが [ID] {内容} 形式か
- [ ] Pull Request が作成されているか（レビュー待ちまたは承認済み）
```

---

## 10. よくある質問（FAQ）

### Q1: 複数エージェントが同じ成果物を編集する場合は?
A: Git の Pull Request + Code Review フローを使用。
- エージェント A が作成（docs/phase4/NW-001 ブランチ）
- エージェント B が指摘追加（同ブランチに commit）
- レビュアー（@infra-qa等）が承認後マージ
- 改訂履歴に複数エージェント名を記入

### Q2: 図が大きすぎて docx に埋め込めない場合は?
A: 別紙として参照形式に変更。
```markdown
図1: VPC アーキテクチャ（詳細は [別紙](./NW-001-vpc-architecture.png) を参照）
```

### Q3: 外部リンク（IPA公開資料等）を参照したい場合は?
A: frontmatter の dependencies に記載しない（内部参照のみ）。本文でURLを明記。
```markdown
詳細は IPA「ユーザのための要件定義ガイド第2版」
（https://www.ipa.go.jp/archive/digital/tools/ep/）を参照。
```

### Q4: docx 変換後、フォーマットが崩れる場合は?
A: 以下を確認：
- Markdown テーブルの列数・行数（複雑なら Excel に）
- 画像の DPI（draw.io は 300 DPI 出力）
- テンプレート.docx のスタイル定義が正しいか

### Q5: 成果物A → 成果物B → 成果物A の循環参照がある場合は?
A: 設計判定の根拠がループしている可能性。dependencies では記載するが、
本文では「相互参照」として明記し、設計判定は片方の方向のみに限定する。

---

## 11. 参考資料・リンク

### IPA公開資料
- ユーザのための要件定義ガイド第2版：https://www.ipa.go.jp/archive/digital/tools/ep/
- 非機能要求グレード v1.2：https://www.ipa.go.jp/
- 共通フレーム2013：https://www.ipa.go.jp/
- 機能要件の合意形成ガイド：https://www.ipa.go.jp/

### デジタル庁ガバメントクラウド関連
- GC全般的ガイド：https://guide.gcas.cloud.go.jp/general/overview-explanation
- GC移行マニュアルv3.0：https://guide.gcas.cloud.go.jp/
- GCAS（ガバメントクラウド補助システム）：https://gcas.cloud.go.jp/

### ツール・フォーマット
- Pandoc ドキュメント変換：https://pandoc.org/
- draw.io（ダイアグラム作成）：https://draw.io/
- Git ブランチ戦略（Git Flow）：https://nvie.com/posts/a-successful-git-branching-model/

### 本スキルの関連ファイル
- `gc-artifact-metadata`：成果物メタデータ定義（「何を」）
- `gc-design-document-template`：設計書の内容テンプレート（「何を」）
- `gc-document-generation-standards`：本スキル（「どう作るか」）

---

---

## 11. Officeファイル出力規約（v3.6追加）

### 11.1 基本方針

エージェントは**MDで内容を生成する**。形式変換はスクリプトが担当。エージェントは変換を意識しない。

### 11.2 成果物フォーマット定義

| 成果物 | 一次生成（MD） | 納品形式 | 変換スクリプト |
|-------|-------------|---------|--------------|
| 見積書（内部用） | ✅ .md | .md | 変換不要 |
| 見積書（顧客提出用） | ✅ .md | .xlsx | `scripts/generate_xlsx.py` |
| WBS | ✅ .md | .xlsx | `scripts/generate_xlsx.py` |
| 課題管理票 | ✅ .md | .xlsx | `scripts/generate_xlsx.py` |
| 提案書 | ✅ .md | .pdf / .pptx | `scripts/generate_pdf.sh` / `scripts/generate_pptx.py` |
| フェーズゲート報告書 | ✅ .md | .pptx | `scripts/generate_pptx.py` |
| 進捗報告 | ✅ .md | .pptx | `scripts/generate_pptx.py` |
| 各種設計書（内部用） | ✅ .md | .md | 変換不要 |
| 各種設計書（納品物） | ✅ .md | .pdf / .docx | `scripts/generate_pdf.sh` / `scripts/generate_docx.sh` |
| 運用手順書 | ✅ .md | .docx | `scripts/generate_docx.sh` |
| 議事録 | ✅ .md | .md | 変換不要 |
| IaCコード | ✅ .tf/.yaml | そのまま | 変換不要 |

### 11.3 変換スクリプト一覧

```
scripts/
  generate_xlsx.py   # WBS・見積書・課題管理票 → xlsx（openpyxl使用）
  generate_pptx.py   # 提案書・報告書・進捗報告 → pptx（python-pptx使用）
  generate_pdf.sh    # MD → PDF（pandoc使用）
  generate_docx.sh   # MD → docx（pandoc使用）
```

**依存ライブラリ:**
```
openpyxl>=3.1.0      # xlsx生成
python-pptx>=0.6.21  # pptx生成
pandoc               # pdf/docx変換（要インストール）
```

### 11.4 変換実行タイミング

| タイミング | 実行方法 |
|----------|---------|
| フェーズゲート承認時 | オーケストレーターが確認後、対象スクリプトを一括実行 |
| 手動指示時 | ユーザーが「提案書をPDFにして」等と指示 |

**実行手順（オーケストレーター向け）:**
```
フェーズゲート承認を検知
  ↓
「以下の納品物を変換しますか？（Y/N）」とユーザーに確認
  ↓
Y → scripts/ の変換スクリプトを順次実行（Bashツール経由）
  ↓
変換済みファイルのパスを一覧表示
```

### 11.5 xlsx生成仕様（generate_xlsx.py）

MDのテーブルをxlsxに変換する。ヘッダー行は太字・背景色付き。

```python
# 呼び出し例
python scripts/generate_xlsx.py \
  --input outputs/01_提案見積/01-1_見積書/見積書.md \
  --output outputs/01_提案見積/01-1_見積書/見積書.xlsx \
  --sheet "工数見積"
```

### 11.6 pptx生成仕様（generate_pptx.py）

MDの見出し（#）をスライドタイトル、本文をコンテンツとして変換する。

```python
# 呼び出し例
python scripts/generate_pptx.py \
  --input outputs/01_提案見積/01-2_提案書/技術提案書.md \
  --output outputs/01_提案見積/01-2_提案書/技術提案書.pptx \
  --template scripts/templates/gc_proposal_template.pptx
```

---

**最終更新:** 2026-04-08
**スキル管理者:** @orchestrator
**バージョン:** 1.1（v3.6: Officeファイル出力規約追加）
