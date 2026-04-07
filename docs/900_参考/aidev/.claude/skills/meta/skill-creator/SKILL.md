# skill-creator

新しいスキルを作成するためのメタスキル。

## 用途

CATALOG.md に該当スキルがない場合、このスキルを使って新規スキルを作成する。

## 使用Agent

- Coder

## スキル作成手順

1. **スキルID決定**
   - ケバブケース（例: `api-versioning`）
   - 簡潔で意味が分かる名前

2. **ディレクトリ作成**
   ```
   .claude/skills/{category}/{skill-id}/
   ├── SKILL.md        # スキルの知識・手法
   └── templates/      # 関連テンプレート（オプション）
   ```

3. **SKILL.md テンプレート**
   ```markdown
   # {skill-id}

   {スキルの概要}

   ## 用途

   {どんな時に使うか}

   ## 使用Agent

   - {対象エージェント}

   ## 知識・手法

   {具体的な知識、ベストプラクティス、実装パターンなど}

   ## 参照

   - {関連ドキュメントへのリンク}
   ```

4. **CATALOG.md に追加**
   - カテゴリ、スキルID、用途、使用Agentを追記

5. **project-state.json の activeSkills に追加**
   - プロジェクトで使用する場合

## カテゴリ一覧

| カテゴリ | 用途 |
|---------|------|
| meta | メタスキル（スキル作成など） |
| languages | プログラミング言語 |
| architecture | アーキテクチャ・設計手法 |
| api | API設計・仕様 |
| devops | CI/CD・IaC |
| testing | テスト手法 |
| observability | 監視・ログ |
| operations | 運用・障害対応 |
| security | セキュリティ |

## 参照

- [CATALOG.md](../../CATALOG.md)
- [既存技術標準](../../../docs/40_standards/)
