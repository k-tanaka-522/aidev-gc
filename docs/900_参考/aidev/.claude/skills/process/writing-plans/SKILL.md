# writing-plans スキル

設計書を「実行可能なタスクリスト」に変換する。

---

## 概要

設計書から実装計画書を作成する。各タスクは2-5分で完了する粒度に分解し、具体的なファイルパス、コード、検証ステップを記載する。

**使用タイミング**: Phase 2（設計）完了後、Phase 3（実装）開始前

**対象エージェント**: App-Architect

**成果物**: `docs/05_実装計画/YYYY-MM-DD-feature.md`

---

## 原則

1. **2-5分タスク**: 各タスクは2-5分で完了する粒度
2. **具体的**: ファイルパス、コード、コマンドを明記
3. **TDD**: RED-GREEN-REFACTOR サイクルを明記
4. **YAGNI**: 設計書にないものは実装しない
5. **DRY**: 重複コードを書かせない

---

## 実装計画書のフォーマット

```markdown
# [機能名] 実装計画書

> **Coderへ**: このタスクリストを順番に実行してください。TDD必須。

**目的**: [1文で説明]
**アーキテクチャ**: [2-3文で説明]
**技術スタック**: [使用する技術]

---

## タスク一覧

### Task 1: [コンポーネント名]

**ファイル:**
- 作成: `exact/path/to/file.ts`
- 変更: `exact/path/to/existing.ts:123-145`
- テスト: `tests/exact/path/to/test.ts`

**Step 1: 失敗するテストを書く**

```typescript
test('specific behavior', () => {
  const result = function(input);
  expect(result).toBe(expected);
});
```

**Step 2: テスト失敗を確認**

実行: `npm test tests/path/test.ts`
期待: FAIL - "function is not defined"

**Step 3: 最小限の実装**

```typescript
function function(input) {
  return expected;
}
```

**Step 4: テスト成功を確認**

実行: `npm test tests/path/test.ts`
期待: PASS

**Step 5: コミット**

```bash
git add tests/path/test.ts src/path/file.ts
git commit -m "feat: add specific feature"
```

---

### Task 2: [次のコンポーネント]
...
```

---

## タスク分解のガイドライン

### Good: 2-5分で完了するタスク

```markdown
### Task 1: ユーザーモデルの作成

**Step 1: 失敗するテストを書く**
```typescript
test('User model has email property', () => {
  const user = new User({ email: 'test@example.com' });
  expect(user.email).toBe('test@example.com');
});
```
```

### Bad: 粒度が大きすぎる

```markdown
### Task 1: ユーザー認証機能の実装

ユーザー登録、ログイン、ログアウト、パスワードリセットを実装してください。
```

→ これは4つ以上のタスクに分解すべき

---

## 設計書からの変換プロセス

```
1. 設計書を読み込む
   - docs/03_アプリケーション設計/
   - API設計、データモデル、画面設計を確認

2. 機能を分解
   - 設計書の機能一覧からタスクを抽出
   - 依存関係を考慮して順序を決定

3. 各タスクを2-5分に分解
   - 1つのAPI = 1タスク（ではない）
   - 1つのAPIのテスト = 1タスク
   - 1つのAPIの実装 = 1タスク
   - 1つのAPIのバリデーション = 1タスク

4. TDDステップを記載
   - 各タスクにRED-GREEN-REFACTOR-COMMITを明記

5. コードを具体的に記載
   - 「バリデーションを追加」ではなく、具体的なコードを書く
```

---

## 禁止事項

- **曖昧な指示**: 「適切に実装してください」
- **大きすぎるタスク**: 30分以上かかるタスク
- **コードなしの指示**: 「〜を実装」だけでコードがない
- **テストなしのタスク**: TDDを省略
- **設計書にない機能**: YAGNI違反

---

## 参照

- [Superpowers writing-plans](https://github.com/obra/superpowers/blob/main/skills/writing-plans/SKILL.md)
- 設計書: `docs/03_アプリケーション設計/`
- 技術標準: `.claude/docs/40_standards/`

---

**作成日**: 2026-01-25
