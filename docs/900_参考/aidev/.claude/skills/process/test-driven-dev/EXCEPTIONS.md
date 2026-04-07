# TDD 例外ケースガイドライン

TDD が適用困難なケースと、その代替アプローチ。

---

## 基本原則（再掲）

```
テストを書く前に本番コードを書いたら、そのコードは削除する
```

**例外は最小限に**。以下は「例外」ではなく「別のテスト方法が必要なケース」。

---

## カテゴリ別ガイドライン

### 1. 設定ファイル

**対象**: `config.ts`, `.env`, `package.json` 等

**TDD 適用**: 不要

**理由**: 設定値自体はロジックではない

**代替アプローチ**:
- 設定値を使うコードを TDD で実装
- 設定値のバリデーション関数を TDD で実装

```typescript
// 設定ファイル自体はテスト不要
export const config = {
  port: 3000,
  timeout: 5000,
};

// 設定を使う関数は TDD で実装
test('server starts on configured port', async () => {
  const server = createServer(config);
  expect(server.port).toBe(config.port);
});
```

---

### 2. 外部サービス連携

**対象**: API クライアント、データベース接続、メール送信等

**TDD 適用**: 必要（ただし工夫が必要）

**アプローチ**:

#### A. インターフェース分離

```typescript
// インターフェースを TDD で設計
interface EmailService {
  send(to: string, subject: string, body: string): Promise<void>;
}

// テスト時はモック実装
test('sends welcome email on registration', async () => {
  const mockEmail: EmailService = {
    send: jest.fn(),
  };

  await registerUser('test@example.com', mockEmail);

  expect(mockEmail.send).toHaveBeenCalledWith(
    'test@example.com',
    'Welcome!',
    expect.any(String)
  );
});
```

#### B. 統合テストは別途

```typescript
// 単体テストは TDD
// 統合テストは実装後に追加（QA フェーズ）
describe('EmailService (integration)', () => {
  it.skip('actually sends email via SMTP', async () => {
    // 実際の SMTP サーバーとの通信テスト
    // QA フェーズで手動確認 or CI で実行
  });
});
```

---

### 3. UI コンポーネント

**対象**: React コンポーネント、HTML テンプレート等

**TDD 適用**: 一部適用

**アプローチ**:

#### A. ロジックは TDD

```typescript
// カスタムフックは TDD で実装
test('useCounter increments count', () => {
  const { result } = renderHook(() => useCounter());

  act(() => result.current.increment());

  expect(result.current.count).toBe(1);
});
```

#### B. 見た目は Snapshot テスト

```typescript
// 見た目の確認は Snapshot（TDD ではない）
test('Button renders correctly', () => {
  const { container } = render(<Button>Click</Button>);
  expect(container).toMatchSnapshot();
});
```

#### C. プロトタイプ参照

- Designer が作成した `prototypes/` を参照
- 見た目の確認はプロトタイプで済んでいる前提

---

### 4. インフラコード (IaC)

**対象**: CloudFormation, Terraform, CDK 等

**TDD 適用**: 困難（ただし検証は必要）

**代替アプローチ**:

#### A. dry-run による検証

```bash
# CloudFormation
aws cloudformation deploy --no-execute-changeset

# Terraform
terraform plan
```

#### B. ポリシーテスト

```typescript
// CDK の場合
test('S3 bucket has encryption enabled', () => {
  const app = new App();
  const stack = new MyStack(app, 'Test');

  const template = Template.fromStack(stack);
  template.hasResourceProperties('AWS::S3::Bucket', {
    BucketEncryption: {
      ServerSideEncryptionConfiguration: Match.arrayWith([
        Match.objectLike({
          ServerSideEncryptionByDefault: {
            SSEAlgorithm: 'AES256'
          }
        })
      ])
    }
  });
});
```

---

### 5. マイグレーション・スクリプト

**対象**: DB マイグレーション、データ移行スクリプト

**TDD 適用**: 困難（状態変更のテストが複雑）

**代替アプローチ**:

#### A. テスト環境で検証

```bash
# テスト DB で実行
npm run migrate:test

# 結果を手動確認
npm run db:seed:test
```

#### B. ロールバックテスト

```bash
# 適用
npm run migrate:up

# ロールバック
npm run migrate:down

# 再適用
npm run migrate:up
```

---

### 6. プロトタイプ・実験コード

**対象**: PoC、技術検証、プロトタイプ

**TDD 適用**: 不要

**ルール**:
- プロトタイプは `prototypes/` または `experiments/` に配置
- 本番コード（`src/`）には含めない
- 本番に昇格する場合は TDD で書き直し

```
prototypes/
└── auth-poc/        # TDD 不要
src/
└── auth/            # TDD 必須（書き直し）
```

---

## 判断フローチャート

```
コードを書く必要がある
  │
  ├─ ビジネスロジック？ → TDD 必須
  │
  ├─ 設定ファイル？ → TDD 不要（設定を使う側を TDD）
  │
  ├─ 外部連携？ → インターフェース分離 + モック
  │
  ├─ UI？ → ロジック部分は TDD、見た目は Snapshot
  │
  ├─ IaC？ → dry-run + ポリシーテスト
  │
  ├─ マイグレーション？ → テスト環境で検証
  │
  └─ プロトタイプ？ → TDD 不要（本番昇格時に書き直し）
```

---

## よくある誤解

### 「外部連携だから TDD できない」

**誤り**。インターフェースを分離すれば TDD できる。

### 「UI だからテスト書けない」

**誤り**。ロジックは分離して TDD できる。見た目は Snapshot。

### 「時間がないから例外」

**誤り**。時間がないことは例外理由にならない。

### 「既存コードだから TDD できない」

**誤り**。変更部分に対して TDD できる（特性テスト技法）。

---

## 監査ログ

TDD を適用しなかった場合、以下を記録:

```json
{
  "file": "config/database.ts",
  "reason": "設定ファイル（ロジックなし）",
  "alternative": "設定を使う DatabaseClient を TDD で実装",
  "date": "2025-01-20"
}
```

---

## 参照

- TDD スキル: `.claude/skills/process/test-driven-dev/SKILL.md`
- テスト戦略: `.claude/docs/40_standards/testing/`

---

**作成日**: 2026-01-26
