# test-driven-dev スキル

テスト駆動開発（TDD）を強制する。

---

## 鉄則

```
テストを書く前に本番コードを書いたら、そのコードは削除する
```

**例外なし。**

---

## サイクル

```
RED → 確認 → GREEN → 確認 → REFACTOR → COMMIT
```

### 1. RED: 失敗するテストを書く

```typescript
test('retries failed operations 3 times', async () => {
  let attempts = 0;
  const operation = () => {
    attempts++;
    if (attempts < 3) throw new Error('fail');
    return 'success';
  };

  const result = await retryOperation(operation);

  expect(result).toBe('success');
  expect(attempts).toBe(3);
});
```

**要件**:
- 1つのテストで1つの振る舞いをテスト
- テスト名は振る舞いを説明
- 実際のコードをテスト（モックは最小限）

### 2. 確認: テストが失敗することを確認

```bash
npm test path/to/test.ts
```

**必須確認事項**:
- テストが失敗する（エラーではない）
- 失敗理由が期待通り（機能がないから失敗）
- タイポなどで失敗していない

**テストがパスした場合**: 既存の機能をテストしている。テストを修正。

### 3. GREEN: テストを通す最小限のコードを書く

```typescript
async function retryOperation<T>(fn: () => Promise<T>): Promise<T> {
  for (let i = 0; i < 3; i++) {
    try {
      return await fn();
    } catch (e) {
      if (i === 2) throw e;
    }
  }
  throw new Error('unreachable');
}
```

**禁止**:
- テストに書いていない機能を追加
- リファクタリング（次のステップ）
- 他のコードを「ついでに」修正

### 4. 確認: テストが成功することを確認

```bash
npm test path/to/test.ts
```

**必須確認事項**:
- テストがパスする
- 他のテストも引き続きパスする
- 警告やエラーがない

### 5. REFACTOR: リファクタリング

テストが緑のまま:
- 重複を削除
- 名前を改善
- ヘルパーを抽出

**禁止**: 新しい機能を追加

### 6. COMMIT: コミット

```bash
git add tests/path/test.ts src/path/file.ts
git commit -m "feat: add retry operation"
```

---

## 違反パターンと対処

| 違反 | 対処 |
|------|------|
| テスト前にコードを書いた | **コード削除**、テストから書き直し |
| テスト失敗を確認せずに実装 | **実装削除**、テスト失敗確認から |
| テスト後にコードを書いた | テストが何をテストしているか不明、**やり直し** |
| 「参考として」コードを残した | **削除**。参考にした時点でTDD違反 |

---

## よくある言い訳（全て却下）

| 言い訳 | 回答 |
|--------|------|
| 「シンプルだからテスト不要」 | シンプルなコードも壊れる。テストは30秒で書ける。 |
| 「後でテストを書く」 | 後で書いたテストは何をテストしているか不明。 |
| 「手動でテストした」 | 手動テストは記録が残らない。再現できない。 |
| 「時間がない」 | TDDはデバッグ時間を減らす。結果的に速い。 |
| 「既存コードにテストがない」 | 今から改善する。触るコードにはテストを追加。 |

---

## Good / Bad 例

### Good: テストが振る舞いを説明

```typescript
test('rejects empty email with validation error', async () => {
  const result = await submitForm({ email: '' });
  expect(result.error).toBe('Email required');
});
```

### Bad: テスト名が曖昧

```typescript
test('email validation works', async () => {
  // 何をテストしているか不明
});
```

### Good: 実際のコードをテスト

```typescript
test('calculates total with tax', () => {
  const cart = new Cart([{ price: 100 }, { price: 200 }]);
  expect(cart.totalWithTax(0.1)).toBe(330);
});
```

### Bad: モックだらけ

```typescript
test('calculates total', () => {
  const mockCart = { items: jest.fn() };
  mockCart.items.mockReturnValue([{ price: 100 }]);
  // モックの振る舞いをテストしている
});
```

---

## チェックリスト

実装完了前に確認:

- [ ] すべての新機能にテストがある
- [ ] 各テストが失敗するのを確認した
- [ ] 各テストが期待通りの理由で失敗した
- [ ] 最小限のコードでテストをパスさせた
- [ ] すべてのテストがパスする
- [ ] 警告やエラーがない
- [ ] エッジケースもテストした

**1つでもチェックできない**: TDD違反。やり直し。

---

## 参照

- [Superpowers test-driven-development](https://github.com/obra/superpowers/blob/main/skills/test-driven-development/SKILL.md)
- 技術標準: `.claude/docs/40_standards/`

---

**作成日**: 2026-01-25
