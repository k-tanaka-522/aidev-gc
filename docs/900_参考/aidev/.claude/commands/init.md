# Init Command - プロジェクト初期化

## 概要

このコマンドは、AI開発ファシリテーターのプロジェクトを初期化します。
新規プロジェクト開始時、または既存プロジェクトの再開時に実行してください。

## 実行タイミング

- **新規プロジェクト**: 最初に必ず実行
- **既存プロジェクト**: セッション開始時に実行（任意だが推奨）

## 処理内容

### 1. 必須ドキュメントの読み込み

以下のファイルを**必ず**読み込んでください：

#### コア原則
\`\`\`
.claude/docs/00_core-principles.md                              # 基本原則（最重要）
\`\`\`

#### ファシリテーション（フェーズ別INDEX）
\`\`\`
.claude/docs/10_facilitation/2.1_企画フェーズ/INDEX.md          # 企画プロセス
.claude/docs/10_facilitation/2.2_要件定義フェーズ/INDEX.md      # 要件定義プロセス
.claude/docs/10_facilitation/2.3_設計フェーズ/INDEX.md          # 設計プロセス
.claude/docs/10_facilitation/2.4_実装フェーズ/INDEX.md          # 実装プロセス
.claude/docs/10_facilitation/2.5_テストフェーズ/INDEX.md        # テストプロセス
.claude/docs/10_facilitation/2.6_納品フェーズ/INDEX.md          # 納品プロセス
\`\`\`

#### ヘルパー
\`\`\`
.claude/helpers/state-manager.md                        # 状態管理方法
.claude/helpers/review-task-generator.md                # レビュータスク生成方法
.claude/helpers/directory-structure-helper.md           # ディレクトリ構成決定方法
.claude/helpers/implementation-checker.md               # 実装チェッカー
\`\`\`

#### 技術標準（PMは読まない - サブエージェント専用）

**IMPORTANT: PMは技術標準を一切読みません**

\`\`\`
# PMは技術標準を読みません（サブエージェント専用）
# サブエージェント（Coder, Architect, SRE等）が必要に応じて読み込みます
#
# 参考: 技術標準ファイル一覧
# - .claude/docs/40_standards/41_app/ （アプリケーション標準）
# - .claude/docs/40_standards/42_infra/ （インフラ標準）
# - .claude/docs/40_standards/49_common/ （共通標準）
\`\`\`

**PMの責務**: 技術的な判断はサブエージェントに委譲し、PMは要件整理とオーケストレーションに専念します。

### 2. CLAUDE.md の確認とセットアップ

プロジェクトルートの \`CLAUDE.md\` の存在を確認：

**存在しない場合:**
- テンプレートからのコピーを提案:
  \`\`\`
  ⚠️ CLAUDE.md が見つかりません。

  CLAUDE.mdはプロジェクトメモリのエントリーポイントです。
  テンプレートからコピーしますか？

  【Windowsの場合】
  copy .claude\templates\CLAUDE.md.template CLAUDE.md

  【Mac/Linuxの場合】
  cp .claude/templates/CLAUDE.md.template CLAUDE.md

  コピー後、以下を編集してください：
  1. {PROJECT_NAME} を実際のプロジェクト名に置換
  2. プロジェクトの目的と背景を記述
  3. 必要に応じて技術スタック情報を追加
  \`\`\`

**存在する場合:**
- 確認メッセージのみ表示:
  \`\`\`
  ✅ CLAUDE.md を確認しました
  \`\`\`

### 3. プロジェクト状態の確認

\`.claude-state/\` 配下のファイルを確認：

**存在する場合（継続プロジェクト）:**

以下のファイルを読み込み：
- \`project-state.json\` - プロジェクト情報、フェーズ、activeSkills
- \`tasks.json\` - タスク進捗
- \`decisions.json\` - 決定記録（なぜを含む）
- \`context.md\` - セッション引継ぎサマリ（人間可読）

ユーザーに状況を報告:
\`\`\`
📂 前回の続きです

プロジェクト名: {name}
現在のフェーズ: {phase}
次にやること: {context.mdから抽出}

/next で進めましょう
\`\`\`

**存在しない場合（新規 or 既存プロジェクト）:**

1. 既存資産の確認（src/, docs/, tests/, infra/ の存在をチェック）

2. **既存資産がある場合 → 既存プロジェクト分析**
   \`\`\`
   📂 既存のプロジェクトですね。状況を確認させてください。
   \`\`\`

   サブエージェントに分析を委譲：
   - Architect: 設計書・アーキテクチャ分析
   - Coder: コード分析（言語、フレームワーク、構成）
   - QA: テストカバレッジ分析

   分析結果を統合して報告：
   \`\`\`
   現在の状況:
   - 設計書: {有無と内容}
   - コード: {言語、フレームワーク、進捗}
   - テスト: {種類、カバレッジ}

   推奨:
   1. {最優先で必要なこと}
   2. {次に必要なこと}

   どこから始めますか？
   \`\`\`

3. **既存資産がない場合 → 新規プロジェクト**
   - \`.claude-state/\` ディレクトリを作成
   - 初期状態の \`project-state.json\` を生成
   - \`tasks.json\` を生成
   - \`decisions.json\` を生成
   - \`context.md\` を生成
   - ユーザーに報告:
     \`\`\`
     🆕 新規プロジェクトを初期化しました

     何を作りたいですか？
     \`\`\`

4. **技術スタック確認 → activeSkills 設定**

   ヒアリングまたは分析で技術スタックが判明したら：
   - \`.claude/skills/CATALOG.md\` から該当スキルを特定
   - \`project-state.json\` の \`activeSkills\` に記録

   \`\`\`json
   {
     "techStack": {
       "frontend": "TypeScript, React",
       "backend": "TypeScript, NestJS"
     },
     "activeSkills": ["typescript", "react", "nestjs", "openapi"]
   }
   \`\`\`

### 4. プロジェクト構造の検出と設定生成

\`.claude/project-structure.json\` の存在を確認：

**存在しない場合（初回 or 既存プロダクト）:**

1. **プロジェクト構造をスキャン**

以下のコマンドでディレクトリを検出：

\`\`\`bash
# Windowsの場合
dir /b /ad | findstr /i "^src$ ^app$ ^backend$ ^frontend$ ^infra$ ^infrastructure$ ^tests$ ^test$"

# macOS/Linuxの場合
find . -maxdepth 1 -type d \( -name "src" -o -name "app" -o -name "backend" -o -name "frontend" -o -name "infra" -o -name "infrastructure" -o -name "tests" -o -name "test" \)
\`\`\`

設計書ディレクトリの検出：
\`\`\`bash
# docs/ 配下をスキャン
find docs -maxdepth 2 -type d 2>/dev/null | grep -iE "(design|設計|基本設計|詳細設計)"
\`\`\`

2. **\`.claude/project-structure.json\` を生成**

検出結果に基づいて設定ファイルを生成：

\`\`\`json
{
  "detected_at": "{現在時刻}",
  "pm_policy": {
    "allow_write": [
      "docs/requirements/**",
      "docs/要件定義/**",
      ".claude-state/**"
    ],
    "deny_write": [
      "{検出されたコードディレクトリ}/**",
      "{検出されたインフラディレクトリ}/**",
      "{検出されたテストディレクトリ}/**",
      "{検出された設計書ディレクトリ}/**",
      ".claude/docs/40_standards/**"
    ],
    "labels": {
      "{検出されたコードディレクトリ}/**": "Coder",
      "{検出されたインフラディレクトリ}/**": "Infra-Architect / SRE",
      "{検出されたテストディレクトリ}/**": "QA",
      "{検出された設計書ディレクトリ}/**": "App-Architect / Infra-Architect"
    }
  }
}
\`\`\`

3. **ユーザーに確認**

\`\`\`
📂 プロジェクト構造を検出しました

検出されたディレクトリ:
- コード: src/
- インフラ: infra/
- テスト: tests/
- 設計書: docs/design/

PMの編集禁止ディレクトリとして設定します。
.claude/project-structure.json を生成しました。

内容を確認して、必要に応じて編集してください。
\`\`\`

**存在する場合:**
- 既存設定を読み込み
- 確認メッセージのみ表示:
  \`\`\`
  ✅ プロジェクト構造設定を確認しました

  PMの編集禁止ディレクトリ: {deny_write の数}個
  \`\`\`

**検出されなかった場合:**
- デフォルト設定で \`.claude/project-structure.json\` を生成
- aiDev標準のディレクトリ構成を使用:
  \`\`\`json
  {
    "detected_at": "{現在時刻}",
    "pm_policy": {
      "allow_write": [
        "docs/requirements/**",
        ".claude-state/**"
      ],
      "deny_write": [
        "src/**",
        "infra/**",
        "tests/**",
        "docs/design/**",
        ".claude/docs/40_standards/**"
      ],
      "labels": {
        "src/**": "Coder",
        "infra/**": "Infra-Architect / SRE",
        "tests/**": "QA",
        "docs/design/**": "App-Architect / Infra-Architect"
      }
    }
  }
  \`\`\`

### 5. 初期化完了メッセージ

\`\`\`
✅ 初期化完了

AI開発ファシリテーターの準備ができました。
システム開発プロセス全体をサポートします。

【対話の基本】
- 一問一答形式で進めます
- ビジネス背景を最優先で伺います
- 技術標準に従ったコードを生成します
- 安全性を最優先します

【利用可能なコマンド】
- \`/status\` - 現在の状況と次のアクションを確認
- \`/next\` - 次にやるべきことを提案
- \`/tasks\` - タスク一覧を表示

さあ、始めましょう！
\`\`\`

## 実装詳細

### project-state.json の初期状態

\`\`\`json
{
  "project": {
    "name": null,
    "type": null,
    "phase": "planning",
    "created_at": "{現在時刻}",
    "updated_at": "{現在時刻}"
  },
  "phases": {
    "planning": {
      "status": "pending",
      "started_at": null,
      "completed_at": null,
      "document": null
    },
    "requirements": {
      "status": "pending",
      "started_at": null,
      "completed_at": null,
      "document": null
    },
    "design": {
      "status": "pending",
      "started_at": null,
      "completed_at": null,
      "document": null
    },
    "implementation": {
      "status": "pending",
      "started_at": null,
      "completed_at": null,
      "document": null
    },
    "testing": {
      "status": "pending",
      "started_at": null,
      "completed_at": null,
      "document": null
    },
    "deployment": {
      "status": "pending",
      "started_at": null,
      "completed_at": null,
      "document": null
    }
  },
  "requirements": {
    "business_background": {},
    "tech_stack": {},
    "functional_requirements": [],
    "non_functional_requirements": {},
    "constraints": {}
  },
  "design": {
    "architecture": null,
    "tech_stack": {},
    "infrastructure": {},
    "cicd_strategy": {}
  },
  "implementation": {
    "directory_structure": null,
    "coding_standards_applied": false
  },
  "metadata": {
    "version": "1.0.0",
    "last_command": "/init"
  }
}
\`\`\`

### tasks.json の初期状態

\`\`\`json
{
  "tasks": [],
  "issues": []
}
\`\`\`

### decisions.json の初期状態

\`\`\`json
{
  "decisions": []
}
\`\`\`

## エラーハンドリング

### ケース1: .claude/docs/ が存在しない

\`\`\`
❌ エラー: .claude/docs/ ディレクトリが見つかりません。

このプロジェクトはAI開発ファシリテーター用に設定されていない可能性があります。
以下を確認してください:
1. 正しいディレクトリにいるか
2. .claude/ ディレクトリが存在するか
\`\`\`

### ケース2: 権限エラー

\`\`\`
❌ エラー: .claude-state/ の作成に失敗しました。

書き込み権限を確認してください。
\`\`\`

## 注意事項

1. **このコマンドは必須ではありません**
   - 実行しなくても対話は可能
   - ただし、実行することで最適な動作が保証されます

2. **複数回実行可能**
   - 既存の状態は上書きされません
   - 安全に再実行できます

3. **\`.claude-state/\` はGit管理外**
   - \`.gitignore\` で除外されています
   - プロジェクト固有の状態を保存します

4. **技術標準は段階的に読み込む**
   - 初期化時: フェーズ別INDEXのみ
   - 設計フェーズ: 技術スタックに応じた標準を読み込む
   - 理由: コンテキストの肥大化を防ぐため
