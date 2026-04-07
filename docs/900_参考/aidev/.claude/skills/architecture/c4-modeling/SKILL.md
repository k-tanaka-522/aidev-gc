# c4-modeling

C4 Modelによるアーキテクチャ図法。

## 用途

システムアーキテクチャを4つの抽象レベルで可視化する。

## 使用Agent

- Architect (AppArchitect)

## 知識・手法

### 4つのレベル

1. **Context (L1)** - システム全体と外部アクター
2. **Container (L2)** - アプリケーション・データストア
3. **Component (L3)** - 主要コンポーネント
4. **Code (L4)** - クラス図（必要な場合のみ）

### L1: System Context

```mermaid
graph TB
    User[User<br/>利用者]
    Admin[Admin<br/>管理者]
    System[ECサイト<br/>Webアプリケーション]
    Payment[決済サービス<br/>外部システム]

    User --> System
    Admin --> System
    System --> Payment
```

### L2: Container

```mermaid
graph TB
    subgraph ECサイト
        Web[Web App<br/>React SPA]
        API[API Server<br/>NestJS]
        DB[(PostgreSQL<br/>Database)]
        Cache[(Redis<br/>Cache)]
    end

    User --> Web
    Web --> API
    API --> DB
    API --> Cache
```

### L3: Component

```mermaid
graph TB
    subgraph API Server
        Controller[Controller<br/>リクエスト処理]
        Service[Service<br/>ビジネスロジック]
        Repository[Repository<br/>データアクセス]
    end

    Controller --> Service
    Service --> Repository
```

## 記述ルール

1. **箱の色分け**
   - 青: 自システム
   - 灰: 外部システム
   - 緑: データストア

2. **矢印の方向**
   - 依存の向き（呼び出す側→呼び出される側）

3. **ラベル**
   - 名前 + 技術/役割

## 成果物

- `docs/03_アプリケーション設計/01_アーキテクチャ設計/c4-context.md`
- `docs/03_アプリケーション設計/01_アーキテクチャ設計/c4-container.md`
- `docs/03_アプリケーション設計/01_アーキテクチャ設計/c4-component.md`

## 参照

- [C4 Model公式](https://c4model.com/)
- [設計書テンプレート](../../../docs/30_templates/)
