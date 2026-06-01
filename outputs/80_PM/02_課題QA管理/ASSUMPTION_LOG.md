# 前提条件・仮定管理

**プロジェクト:** 共通基盤HelloWorld_v1
**最終更新:** 2026-06-01

## 凡例
- 種別: `確定前提`（合意済） / `作業仮定`（QA回答待ち） / `失効`（仮定が覆った）
- 作業仮定はQA_LOGと紐づけて管理する

---

## 確定前提（合意済）

| # | 確定日 | 前提内容 | 根拠・確認方法 | 影響エージェント |
|---|--------|---------|-------------|----------------|

---

## 作業仮定（QA回答待ち）

| # | 起票日 | 仮定内容 | 関連QA# | 影響エージェント | 影響成果物 |
|---|--------|---------|--------|----------------|---------|
| A-001 | 2026-06-01 | アーキ比較の評価4軸（性能/コスト/運用負荷/拡張性）を等weightで仮置き、Phase 2で確定 | Q-001 | @infra-requirements | 要件定義書／アーキ比較表 |
| A-002 | 2026-06-01 | バッチ・非同期処理はHello World相当の軽量・低頻度バッチと想定 | Q-002 | @infra-requirements | 要件定義書／ワークロード定義 |
| A-003 | 2026-06-01 | 共同利用テナント分離はVPC/サブネット/タグ分離を初期仮定、Phase 2-4で確定 | Q-003 | @infra-gc-environment | アカウント構成設計／GC環境設計 |
| A-004 | 2026-06-01 | LGWAN接続は単一接続・標準帯域と想定 | Q-004 | @infra-network | ネットワーク設計書 |
| A-101 | 2026-06-01 | 初期2テナント＋将来N拡張を仮定し、CIDR配賦はスケール余地を確保 | Q-101 | @infra-gc-environment | アカウント構成設計／GC環境設計 |
| A-102 | 2026-06-01 | バッチ/非同期は軽量5分毎・日次バッチ・非同期バースト等を仮定（Q-002と同主旨／相互参照） | Q-102, Q-002 | @infra-gc-environment, @infra-requirements | GC環境設計／ワークロード定義 |
| A-103 | 2026-06-01 | LGWAN接続は接続前提のみとし、帯域/冗長化/接続先はNW設計で仮定義（Q-004と同主旨／相互参照） | Q-103, Q-004 | @infra-gc-environment, @infra-network | GC環境設計／ネットワーク設計書 |
| A-104 | 2026-06-01 | KMSキーはテナント別CMK採用で仮確定（共通鍵との比較記載済）、最終承認待ち | Q-104 | @infra-gc-environment, @infra-security | GC環境設計／セキュリティ設計書 |
| A-111 | 2026-06-01 | 庁内CIDR範囲は標準的なプライベートレンジを仮置きし、LGWAN/DX経路のルーティング・SG設計前提とする | Q-111 | @infra-network | ネットワーク設計書／ルーティング・SG設計 |
| A-112 | 2026-06-01 | DX回線は帯域1Gbps Private VIFを主とし、VPNバックアップで冗長化する構成を仮定 | Q-112 | @infra-network | ネットワーク設計書／回線調達仕様 |
| A-113 | 2026-06-01 | バッチ処理の外部通信は全パターン閉域完結（NAT GW不要）を基本と仮定（最終はQ-113回答／要件で確定） | Q-113 | @infra-network, @infra-requirements | ネットワーク設計書／NAT GW要否判定 |
| A-107 | 2026-06-01 | DRは単一Region基本でスコープ外とし、マルチRegionは将来検討事項とする | Q-107 | @infra-security | セキュリティ設計書／DR方針 |
| A-108 | 2026-06-01 | WAFは標準マネージドルール＋レート制限を基本とし、ジオブロック等のしきい値は仮置き | Q-108 | @infra-security | セキュリティ設計書／WAF設計 |
| A-109 | 2026-06-01 | MFAの一般ユーザー必須化は段階導入を仮定（特権ユーザー先行、一般は時期未定） | Q-109 | @infra-security | セキュリティ設計書／IAM・認証方針 |
| A-110 | 2026-06-01 | GuardDuty検出時は通知中心＋限定的自動応答を仮定（広範な自動隔離は対象外） | Q-110 | @infra-security | セキュリティ設計書／インシデント自動対応方針 |
| A-IaC-001 | 2026-06-01 | S3 Gateway EndpointのRT ID受け渡しはvpcConstructからprivateRouteTableIdsを公開する方式で実装 | QA-IaC-001 | @infra-iac | CDKコード（VpcConstruct／Endpoint定義） |
| A-IaC-002 | 2026-06-01 | WAF Regional ACLとALBの関連付けはOnlineStackからWafRegionalStackへALB ARN情報を渡す形で実装 | QA-IaC-002 | @infra-iac | CDKコード（OnlineStack／WafRegionalStack） |
| A-IaC-003 | 2026-06-01 | Batch Fargate executionRoleArnはJobDefinition側で設定 | QA-IaC-003 | @infra-iac | CDKコード（Batch JobDefinition定義） |

---

## 失効した仮定（要見直し）

| # | 失効日 | 元の仮定 | 正しい内容 | 影響を受けた成果物 |
|---|--------|---------|----------|-----------------|
