# python

Python実装のベストプラクティス。

## 用途

Pythonでの実装時に参照するスキル。

## 使用Agent

- Coder

## 知識・手法

### 型ヒント

```python
from typing import Optional, List, Dict, TypeVar, Generic
from dataclasses import dataclass
from datetime import datetime

@dataclass
class User:
    id: str
    name: str
    email: str
    created_at: datetime

def find_user(user_id: str) -> Optional[User]:
    """ユーザーをIDで検索する"""
    ...

def get_users(limit: int = 10) -> List[User]:
    """ユーザー一覧を取得する"""
    ...
```

### エラーハンドリング

```python
from typing import Union
from dataclasses import dataclass

@dataclass
class Success[T]:
    value: T

@dataclass
class Failure:
    error: str

Result = Union[Success, Failure]

def fetch_user(user_id: str) -> Result[User]:
    try:
        user = api.get_user(user_id)
        return Success(user)
    except Exception as e:
        return Failure(str(e))
```

### コンテキストマネージャ

```python
from contextlib import contextmanager
from typing import Generator

@contextmanager
def database_transaction() -> Generator[Connection, None, None]:
    conn = get_connection()
    try:
        yield conn
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()
```

### 非同期処理

```python
import asyncio
from typing import List

async def fetch_all_users(user_ids: List[str]) -> List[User]:
    tasks = [fetch_user(uid) for uid in user_ids]
    return await asyncio.gather(*tasks)
```

## プロジェクト構成

```
project/
├── src/
│   └── myapp/
│       ├── __init__.py
│       ├── domain/        # ドメインモデル
│       ├── services/      # ビジネスロジック
│       ├── repositories/  # データアクセス
│       └── api/           # APIエンドポイント
├── tests/
├── pyproject.toml
└── README.md
```

## 推奨ツール

- **Formatter**: ruff format / black
- **Linter**: ruff / flake8
- **Type Checker**: mypy / pyright
- **Test**: pytest

## 参照

- [技術標準](../../../docs/40_standards/41_app/)
