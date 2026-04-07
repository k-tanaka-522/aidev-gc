# aiDev + Superpowers 統合設計書

## 概要

aiDev（IPA標準準拠オーケストレーション）と Superpowers（エージェント実行フレームワーク）を統合し、以下の問題を解決する。

### 解決する問題

1. **コンテキスト汚染**: PMが長い会話を続けると品質低下
2. **タスク粒度の粗さ**: 機能単位で渡すと実装がブレる
3. **TDDの非徹底**: 推奨だと守られない
4. **レビュー順序の曖昧さ**: 何を先に確認すべきか不明確

---

## 統合方針

### 維持するもの（aiDevの強み）

| 要素 | 理由 |
|------|------|
| IPA標準6フェーズ | 企業開発で馴染みがある、成果物が明確 |
| 役割別エージェント | 専門性の分離が明確 |
| 一問一答 | ユーザー負荷軽減 |
| ヒアリング項目 | 抜け漏れ防止 |
| クロスレビュー | 品質担保 |
| 技術標準 | 一貫した品質 |

### 追加・強化するもの（Superpowersから）

| 要素 | 変更内容 |
|------|----------|
| 実装計画フェーズ | 設計→実装の間に挿入 |
| 2-5分タスク分解 | 具体的なコード・検証ステップ付き |
| TDD強制 | 違反=コード削除 |
| レビュー順序 | spec compliance → code quality |
| fresh context | タスクごとに新規サブエージェント |

---

## 新しいフェーズマップ

```
Phase 0: 企画        → Consultant
Phase 1: 要件定義    → PM（主導）
Phase 2a: アプリ設計  → App-Architect
Phase 2b: インフラ設計 → Infra-Architect
Phase 2c: UI/UX設計  → Designer
Phase 2.5: 実装計画  → App-Architect（writing-plans スキル使用）【新規】
Phase 3: 実装       → Coder（タスク単位実行、TDD強制）【変更】
Phase 4: インフラ構築 → SRE
Phase 5: テスト     → QA
Phase 6: 運用移行   → SRE
```

### Phase 2.5: 実装計画フェーズ（新規）

**目的**: 設計書を「実行可能なタスクリスト」に変換

**入力**:
- アプリケーション設計書（docs/03_アプリケーション設計/）
- UI/UX設計書・プロトタイプ

**出力**:
- 実装計画書（docs/05_実装計画/YYYY-MM-DD-feature.md）

**タスク構造**:
```markdown
### Task N: [コンポーネント名]

**ファイル:**
- 作成: `src/path/to/file.ts`
- 変更: `src/path/to/existing.ts:123-145`
- テスト: `tests/path/to/test.ts`

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
```

---

## 新しい実装フロー

### Before（現状）

```
設計書 → Coder に委譲 → Coder が設計書読んで実装 → QA レビュー
         ↑
    コンテキスト汚染発生
    タスク粒度が粗い
```

### After（変更後）

```
設計書
  → App-Architect が実装計画書作成（writing-plans）
  → PM 承認
  → タスクごとに fresh Coder 起動
    → TDD で実装（RED-GREEN-REFACTOR）
    → Spec Review（仕様準拠確認）
    → Quality Review（コード品質確認）
  → 全タスク完了後、最終レビュー
```

---

## Fresh Context の仕組み

### 問題

PMやCoderが長い会話を続けると：
- コンテキストが断片化
- 過去の誤った情報が残る
- 新しい情報との整合性が取れなくなる

### 解決策

**タスクごとに新規サブエージェントを起動**

```
PM（軽量オーケストレーター）
  │
  ├─ Task 1 → fresh Coder → 完了 → 破棄
  │              ↓
  │         状態は .claude-state/ に永続化
  │
  ├─ Task 2 → fresh Coder → 完了 → 破棄
  │              ↓
  │         前タスクの状態を .claude-state/ から読み込み
  │
  └─ Task N → ...
```

### PM の役割変更

**Before**: 長い会話でコンテキストを保持
**After**:
- 状態は `.claude-state/` に永続化
- タスクごとに新規サブエージェントに委譲
- 自身は軽量なルーターに徹する

---

## レビュー順序の明確化

### 2段階レビュー

```
実装完了
  ↓
Stage 1: Spec Compliance Review（仕様準拠確認）
  - 実装計画書の仕様を満たしているか
  - 足りない機能はないか
  - 余計な機能はないか（YAGNI）
  ↓
  NG → 修正 → Stage 1 再レビュー
  ↓
  OK
  ↓
Stage 2: Code Quality Review（コード品質確認）
  - コードの可読性
  - テストの網羅性
  - 技術標準への準拠
  ↓
  NG → 修正 → Stage 2 再レビュー
  ↓
  OK → タスク完了
```

### 重要なルール

- **Stage 1 が通らないと Stage 2 に進まない**
- 「仕様通りだが品質が低い」より「仕様と違う」方が問題
- 仕様準拠を先に確認することで、無駄な品質改善を防ぐ

---

## TDD 強制ルール

### 鉄則

```
テストを書く前に本番コードを書いたら、そのコードは削除する
```

### サイクル

1. **RED**: 失敗するテストを書く
2. **確認**: テストが失敗することを確認（必須）
3. **GREEN**: テストを通す最小限のコードを書く
4. **確認**: テストが成功することを確認（必須）
5. **REFACTOR**: リファクタリング（テストは緑のまま）
6. **COMMIT**: コミット

### 違反パターン（許容しない）

| パターン | 結果 |
|---------|------|
| テスト前にコードを書いた | コード削除、テストから書き直し |
| テスト失敗を確認せずに実装 | 実装削除、テスト失敗確認から |
| テスト後にコードを書いた | テストが何をテストしているか不明 |

---

## ディレクトリ構造の変更

```
.claude/
├── skills/
│   ├── process/                    【新規】
│   │   ├── writing-plans/
│   │   │   └── SKILL.md
│   │   ├── subagent-driven-dev/
│   │   │   └── SKILL.md
│   │   ├── test-driven-dev/
│   │   │   └── SKILL.md
│   │   └── systematic-debugging/
│   │       └── SKILL.md
│   ├── architecture/               （既存）
│   ├── api/
│   └── ...

docs/
├── 01_企画/
├── 02_要件定義/
├── 03_アプリケーション設計/
├── 04_インフラ設計/
├── 05_実装計画/                    【新規】
│   └── YYYY-MM-DD-feature.md
├── 06_テスト/
└── 90_research/
```

---

## 実装タスク

1. [ ] CLAUDE.md を更新（フェーズマップに2.5追加）
2. [ ] .claude/CLAUDE.md を更新（実装計画フェーズの詳細）
3. [ ] .claude/skills/process/writing-plans/SKILL.md を作成
4. [ ] .claude/skills/process/test-driven-dev/SKILL.md を作成
5. [ ] .claude/agents/coder/AGENT.md を更新（TDD強制）
6. [ ] .claude/skills/review-code/SKILL.md を更新（2段階レビュー）
7. [ ] docs/05_実装計画/ ディレクトリを作成

---

## 参考

- [Superpowers](https://github.com/obra/superpowers)
- [aiDev feature/lightweight-orchestration](https://github.com/k-tanaka-522/aidev/tree/feature/lightweight-orchestration)

---

**作成日**: 2026-01-25
**ステータス**: ドラフト
