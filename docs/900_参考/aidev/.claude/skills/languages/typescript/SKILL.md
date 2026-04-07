# typescript

TypeScript実装のベストプラクティス。

## 用途

TypeScriptでの実装時に参照するスキル。

## 使用Agent

- Coder

## 知識・手法

### 型安全性

```typescript
// Prefer strict types over any
interface User {
  id: string;
  name: string;
  email: string;
  createdAt: Date;
}

// Use discriminated unions for state
type RequestState<T> =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'success'; data: T }
  | { status: 'error'; error: Error };
```

### Null Safety

```typescript
// Use optional chaining and nullish coalescing
const userName = user?.profile?.name ?? 'Anonymous';

// Prefer undefined over null
function findUser(id: string): User | undefined {
  return users.find(u => u.id === id);
}
```

### エラーハンドリング

```typescript
// Result型パターン
type Result<T, E = Error> =
  | { ok: true; value: T }
  | { ok: false; error: E };

async function fetchUser(id: string): Promise<Result<User>> {
  try {
    const user = await api.getUser(id);
    return { ok: true, value: user };
  } catch (error) {
    return { ok: false, error: error as Error };
  }
}
```

### インポート整理

```typescript
// 1. Node.js built-ins
import { readFile } from 'fs/promises';

// 2. External packages
import express from 'express';

// 3. Internal modules (absolute)
import { UserService } from '@/services/user';

// 4. Relative imports
import { formatDate } from './utils';
```

## tsconfig推奨設定

```json
{
  "compilerOptions": {
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "noImplicitReturns": true,
    "noFallthroughCasesInSwitch": true,
    "exactOptionalPropertyTypes": true
  }
}
```

## 参照

- [技術標準](../../../docs/40_standards/41_app/)
