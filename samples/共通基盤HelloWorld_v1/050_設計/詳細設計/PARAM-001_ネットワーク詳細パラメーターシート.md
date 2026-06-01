---
artifact_id: PARAM-001
title: ネットワーク詳細パラメーターシート
version: 1.0
status: draft
author: "[infra-iac] (iac-implementation)"
reviewer: ""
approved_by: ""
created_at: 2026-06-01
updated_at: 2026-06-01
phase: 4
dependencies:
  - artifact: NW-001
    title: ネットワーク基本設計書
    section: "§4 VPC/CIDR/サブネット設計 / §5 ルーティング / §6 TGW接続 / §8 3パターン差分 / §9 VPC Endpoint / §10 SG/NACL"
    reason: "NW基本設計書から具体的なCIDR・パラメータ値を詳細設計レベルに落とし込む"
  - artifact: GC-002
    title: GC環境・システム全体構成 基本設計書
    section: "§4.6 タグ統制 / §5.2 サブネット構成"
    reason: "タグ統制規約・VPC構成の前提を継承"
---

# ネットワーク詳細パラメーターシート

## 改訂履歴

| バージョン | 更新日 | 更新者 | 変更内容 | ステータス |
|-----------|--------|--------|--------|----------|
| 1.0 | 2026-06-01 | infra-iac | 初版作成。NW-001基本設計書をCDK実装入力レベルのパラメーターシートに展開 | draft |

---

## 1. 凡例・環境差分の考え方

| 環境 | 主な差分点 |
|------|----------|
| dev | NAT GW は片 AZ のみ（コスト削減）。VPC Flow Logs はデフォルト保持期間 7 日 |
| stg | NAT GW 各 AZ 配置。Flow Logs 保持 30 日 |
| prod | 全設定フル。NAT GW 各 AZ、Flow Logs 保持 90 日。TGW アタッチも prod のみ接続 |

> 以下パラメーター表の「dev/stg/prod」列は代表値を示す。空欄はdev=stg=prod（共通）を意味する。

---

## 2. VPC パラメーター

### 2.1 テナントVPC

根拠: NW-001 §4.1

| パラメーター | テナントA (代表) | テナントB | dev/stg/prod差分 | 備考 |
|------------|----------------|---------|----------------|------|
| CIDR | `10.20.0.0/16` | `10.21.0.0/16` | なし | 第2オクテット(20/21...)でテナント識別 |
| enable_dns_hostnames | `true` | 同左 | なし | PHZ 名前解決要件 |
| enable_dns_support | `true` | 同左 | なし | |
| instance_tenancy | `default` | 同左 | なし | Fargate のため dedicated 不要 |
| タグ: Name | `helloworld-tenant-A-vpc` | `helloworld-tenant-B-vpc` | なし | |
| タグ: tenant | `A` | `B` | なし | テナント分離軸 |
| タグ: environment | `dev` | 同左 | dev / stg / prod | |
| タグ: owner | `team-helloworld@example.go.jp` | 同左 | なし | |
| タグ: cost_center | `tenant-A` | `tenant-B` | なし | コスト按分 |
| タグ: project | `helloworld-archcmp` | 同左 | なし | |
| タグ: compliance | `ismap` | 同左 | なし | SCP 必須 |

### 2.2 Network Hub VPC（Shared Services / 参照のみ・CDK非管理）

| パラメーター | 値 | 備考 |
|------------|-----|------|
| CIDR | `10.0.0.0/16` | 自動適用層管理。Import 参照のみ |
| 用途 | TGW Attachment / DX/LGWAN 終端 | CDK は Attachment のみ追加 |

---

## 3. サブネット パラメーター（テナントA代表）

根拠: NW-001 §4.2

### 3.1 Public サブネット

| パラメーター | AZ-a | AZ-c | dev差分 | 備考 |
|------------|------|------|--------|------|
| CIDR | `10.20.0.0/24` | `10.20.1.0/24` | 同値 | 公開ALB / NAT GW 配置 |
| availability_zone | `ap-northeast-1a` | `ap-northeast-1c` | — | |
| map_public_ip_on_launch | `false` | 同左 | — | ALB/NAT は EIP 個別管理 |
| タグ: Name | `helloworld-tenant-A-public-1a` | `helloworld-tenant-A-public-1c` | — | |
| タグ: subnet_type | `public` | 同左 | — | ルートテーブル識別 |

### 3.2 Private-App サブネット

| パラメーター | AZ-a | AZ-c | dev差分 | 備考 |
|------------|------|------|--------|------|
| CIDR | `10.20.10.0/24` | `10.20.11.0/24` | 同値 | ECS Fargate / ALB 配置 |
| availability_zone | `ap-northeast-1a` | `ap-northeast-1c` | — | |
| map_public_ip_on_launch | `false` | 同左 | — | |
| タグ: Name | `helloworld-tenant-A-private-app-1a` | `helloworld-tenant-A-private-app-1c` | — | |
| タグ: subnet_type | `private-app` | 同左 | — | |

### 3.3 Private-Batch サブネット

| パラメーター | AZ-a | AZ-c | dev差分 | 備考 |
|------------|------|------|--------|------|
| CIDR | `10.20.20.0/24` | `10.20.21.0/24` | 同値 | パターン A/B/C バッチ配置 |
| availability_zone | `ap-northeast-1a` | `ap-northeast-1c` | — | |
| map_public_ip_on_launch | `false` | 同左 | — | |
| タグ: Name | `helloworld-tenant-A-private-batch-1a` | `helloworld-tenant-A-private-batch-1c` | — | |
| タグ: subnet_type | `private-batch` | 同左 | — | |

### 3.4 Protected-Data サブネット

| パラメーター | AZ-a | AZ-c | dev差分 | 備考 |
|------------|------|------|--------|------|
| CIDR | `10.20.30.0/24` | `10.20.31.0/24` | 同値 | VPC Endpoint ENI / データ系 |
| availability_zone | `ap-northeast-1a` | `ap-northeast-1c` | — | |
| map_public_ip_on_launch | `false` | 同左 | — | |
| タグ: Name | `helloworld-tenant-A-protected-data-1a` | `helloworld-tenant-A-protected-data-1c` | — | |
| タグ: subnet_type | `protected-data` | 同左 | — | |

### 3.5 TGW-Attach サブネット

| パラメーター | AZ-a | AZ-c | dev差分 | 備考 |
|------------|------|------|--------|------|
| CIDR | `10.20.40.0/28` | `10.20.41.0/28` | prod のみ実体接続 | TGW ENI専用。/28 = 16IP |
| availability_zone | `ap-northeast-1a` | `ap-northeast-1c` | — | |
| タグ: Name | `helloworld-tenant-A-tgw-attach-1a` | `helloworld-tenant-A-tgw-attach-1c` | — | |
| タグ: subnet_type | `tgw-attach` | 同左 | — | |

---

## 4. Internet Gateway / Elastic IP

| パラメーター | 値 | dev差分 | 備考 |
|------------|-----|--------|------|
| IGW 数 | 1 per VPC | なし | |
| タグ: Name | `helloworld-tenant-A-igw` | — | |
| EIP for NAT-1a | 1 | なし | dev も 1 (NAT 1台) |
| EIP for NAT-1c | 1 | **dev = 不要** | dev は片 AZ のみ |
| タグ: Name (EIP) | `helloworld-tenant-A-eip-nat-1a` | — | |

---

## 5. NAT Gateway

根拠: NW-001 §5.2

| パラメーター | AZ-a | AZ-c | dev差分 | 備考 |
|------------|------|------|--------|------|
| SubnetId | Public-1a | Public-1c | — | |
| AllocationId | EIP-1a | EIP-1c | **dev は 1a のみ** | |
| connectivity_type | `public` | 同左 | — | |
| タグ: Name | `helloworld-tenant-A-nat-1a` | `helloworld-tenant-A-nat-1c` | — | |

---

## 6. Route Table

根拠: NW-001 §5.1

### 6.1 RT-Public

| ルート | ターゲット | 備考 |
|-------|----------|------|
| `10.20.0.0/16` (local) | local | 自動 |
| `0.0.0.0/0` | IGW | インターネット |
| `192.168.0.0/16` | TGW | 庁内戻りルート |

### 6.2 RT-Private-App（AZ-a / AZ-c で別テーブル）

| ルート | ターゲット | 備考 |
|-------|----------|------|
| `10.20.0.0/16` (local) | local | |
| `0.0.0.0/0` | NAT GW (同AZ) | 限定用途。**dev は 1a のみ設定** |
| `192.168.0.0/16` | TGW | 庁内向け |
| S3 Gateway Endpoint | VPC Endpoint | |

### 6.3 RT-Private-Batch

| ルート | ターゲット | 備考 |
|-------|----------|------|
| `10.20.0.0/16` (local) | local | |
| S3 Gateway Endpoint | VPC Endpoint | 全パターン共通 |
| `0.0.0.0/0` | 原則なし | 外部 HTTPS 要件発生時のみ NAT 追加 (QA-106) |

### 6.4 RT-Protected-Data

| ルート | ターゲット | 備考 |
|-------|----------|------|
| `10.20.0.0/16` (local) | local | 閉域のみ |
| S3 Gateway Endpoint | VPC Endpoint | |

### 6.5 RT-TGW-Attach

| ルート | ターゲット | 備考 |
|-------|----------|------|
| `10.20.0.0/16` (local) | local | |
| (静的ルートなし) | — | TGW 側ルートテーブルで制御 |

---

## 7. Transit Gateway Attachment

根拠: NW-001 §6.1

| パラメーター | 値 | dev差分 | 備考 |
|------------|-----|--------|------|
| transit_gateway_id | SSM 参照 (`/helloworld/network/tgw-id`) | — | 自動適用層 TGW を参照 |
| subnet_ids | TGW-Attach-1a, TGW-Attach-1c | **dev = 未アタッチ (省略可)** | dev は TGW 不要 |
| dns_support | `enable` | — | |
| ipv6_support | `disable` | — | |
| タグ: Name | `helloworld-tenant-A-tgw-attach` | — | |

---

## 8. VPC Flow Logs

根拠: NW-001 §3.1 原則 7

| パラメーター | 値 | dev差分 | 備考 |
|------------|-----|--------|------|
| traffic_type | `ALL` | — | ACCEPT/REJECT 両方記録 |
| log_destination_type | `cloud-watch-logs` | — | |
| log_group_name | `/helloworld/flowlogs/tenant-A` | — | |
| iam_role_arn | `arn:aws:iam::<account-id>:role/flowlogs-role` | — | |
| kms_key_id | アプリ共通 CMK ARN | — | ISMAP LG-17 |
| retention_in_days | `90` | dev=7 / stg=30 / prod=90 | |

---

## 9. VPC Endpoint

根拠: NW-001 §8.3 / §9.1

### 9.1 Gateway 型

| Endpoint | サービス名 | 関連 RT | 備考 |
|----------|----------|--------|------|
| s3-gateway | `com.amazonaws.ap-northeast-1.s3` | RT-Private-App / RT-Private-Batch / RT-Protected-Data | 全パターン共通 |

### 9.2 Interface 型（Protected-Data 1a/1c に ENI 配置）

| Endpoint | サービス名 | Private DNS | 利用パターン | 備考 |
|----------|----------|------------|------------|------|
| ecr-api | `com.amazonaws.ap-northeast-1.ecr.api` | true | B/C/オンライン | コンテナイメージ管理 API |
| ecr-dkr | `com.amazonaws.ap-northeast-1.ecr.dkr` | true | B/C/オンライン | イメージ pull |
| logs | `com.amazonaws.ap-northeast-1.logs` | true | 全パターン共通 | CloudWatch Logs |
| sqs | `com.amazonaws.ap-northeast-1.sqs` | true | A(DLQ)/C | キュー |
| batch | `com.amazonaws.ap-northeast-1.batch` | true | **B のみ** | AWS Batch API |
| sts | `com.amazonaws.ap-northeast-1.sts` | true | 全パターン共通 | AssumeRole |
| ssm | `com.amazonaws.ap-northeast-1.ssm` | true | 全パターン共通 | Systems Manager |
| ssmmessages | `com.amazonaws.ap-northeast-1.ssmmessages` | true | 全パターン共通 | |
| ec2messages | `com.amazonaws.ap-northeast-1.ec2messages` | true | 全パターン共通 | |
| monitoring | `com.amazonaws.ap-northeast-1.monitoring` | true | 全（特に C） | CloudWatch Metrics |
| kms | `com.amazonaws.ap-northeast-1.kms` | true | 全パターン共通 | CMK 復号 |

**共通設定（Interface 型）**:

| パラメーター | 値 | 備考 |
|------------|-----|------|
| subnet_ids | Protected-Data-1a, Protected-Data-1c | |
| security_group_ids | sg-vpc-endpoint | |
| private_dns_enabled | `true` | AWS サービス FQDN の VPC 内解決 |
| タグ: Name | `helloworld-tenant-A-ep-<service>` | |

---

## 10. Security Group

根拠: SEC-001 §6.3 / NW-001 §10.2

### sg-public-alb

| 方向 | プロトコル | ポート | 送信元/宛先 | 説明 |
|------|----------|-------|-----------|-----|
| In | TCP | 443 | CloudFront 管理プレフィックスリスト | HTTPS from CloudFront |
| Out | TCP | 8080 | sg-fargate-app | App ポートへ転送 |

### sg-internal-alb

| 方向 | プロトコル | ポート | 送信元/宛先 | 説明 |
|------|----------|-------|-----------|-----|
| In | TCP | 443 | `192.168.0.0/16` | 庁内 CIDR |
| Out | TCP | 8080 | sg-fargate-app | App ポートへ転送 |

### sg-fargate-app

| 方向 | プロトコル | ポート | 送信元/宛先 | 説明 |
|------|----------|-------|-----------|-----|
| In | TCP | 8080 | sg-public-alb / sg-internal-alb | ALB からのみ |
| Out | TCP | 443 | sg-vpc-endpoint | Endpoint (閉域) |
| Out | TCP | 443 | S3 プレフィックスリスト | S3 Gateway |

### sg-batch-common（パターン A/B/C 共通骨子）

| 方向 | プロトコル | ポート | 送信元/宛先 | 説明 |
|------|----------|-------|-----------|-----|
| In | — | — | なし | バッチはアウトバウンド処理 |
| Out | TCP | 443 | sg-vpc-endpoint | Endpoint 閉域通信 |
| Out | TCP | 443 | S3 プレフィックスリスト | S3 |

> パターン別 SG (sg-batch-A / sg-batch-B / sg-batch-C) はこの骨子を継承し、PARAM-005/006/007 で詳細化。

### sg-vpc-endpoint

| 方向 | プロトコル | ポート | 送信元/宛先 | 説明 |
|------|----------|-------|-----------|-----|
| In | TCP | 443 | `10.20.0.0/16` | VPC 内全サブネット |
| Out | — | — | — | Stateful 戻りのみ |

### sg-tgw-attach

| 方向 | プロトコル | ポート | 送信元/宛先 | 説明 |
|------|----------|-------|-----------|-----|
| In | All | — | `192.168.0.0/16` | 庁内からの疎通 |
| Out | All | — | `10.20.0.0/16` | VPC 内へ |

---

## 11. NACL

根拠: SEC-001 §6.4 / NW-001 §10.3

### NACL-Public

| ルール番号 | 方向 | プロトコル | ポート | 送信元/宛先 | アクション |
|----------|------|----------|-------|-----------|---------|
| 100 | In | TCP | 443 | 0.0.0.0/0 | ALLOW |
| 110 | In | TCP | 80 | 0.0.0.0/0 | ALLOW |
| 120 | In | TCP | 1024-65535 | 0.0.0.0/0 | ALLOW (戻り) |
| 200 | Out | TCP | 443 | 0.0.0.0/0 | ALLOW |
| 210 | Out | TCP | 1024-65535 | 0.0.0.0/0 | ALLOW |
| * | In/Out | — | — | 0.0.0.0/0 | DENY |

### NACL-Private-App / NACL-Private-Batch

| ルール番号 | 方向 | プロトコル | ポート | 送信元/宛先 | アクション |
|----------|------|----------|-------|-----------|---------|
| 100 | In | TCP | All | `10.20.0.0/16` | ALLOW (VPC 内) |
| 110 | In | TCP | All | `192.168.0.0/16` | ALLOW (庁内/TGW) |
| 120 | In | TCP | 1024-65535 | 0.0.0.0/0 | ALLOW (戻り) |
| 200 | Out | TCP | 443 | `10.20.0.0/16` | ALLOW |
| 210 | Out | TCP | 443 | `0.0.0.0/0` | ALLOW (Endpoint/NAT) |
| 220 | Out | TCP | 1024-65535 | 0.0.0.0/0 | ALLOW |
| * | In/Out | — | — | 0.0.0.0/0 | DENY |

### NACL-Protected-Data

| ルール番号 | 方向 | プロトコル | ポート | 送信元/宛先 | アクション |
|----------|------|----------|-------|-----------|---------|
| 100 | In | TCP | All | `10.20.0.0/16` | ALLOW (VPC 内のみ) |
| 200 | Out | TCP | All | `10.20.0.0/16` | ALLOW |
| * | In/Out | — | — | 0.0.0.0/0 | DENY |

---

## 12. Route53 / DNS

根拠: NW-001 §9.2

| パラメーター | 値 | 備考 |
|------------|-----|------|
| Private Hosted Zone (テナントA) | `tenant-a.internal.helloworld.go.jp` | VPC 関連付け |
| プライベートサービス A レコード | `private.tenant-a.internal.helloworld.go.jp` → 内部 ALB DNS | |
| Resolver Inbound Endpoint | Protected-Data Subnet 各 AZ | 庁内→VPC 名前解決 |
| Resolver Outbound Endpoint | Protected-Data Subnet 各 AZ | VPC→庁内 DNS 転送 |
| 条件付きフォワードルール | `*.lg.jp` → `192.168.x.x:53` | 庁内 DNS への転送 |

---

## 13. 構築リソース種別数サマリ（共通ネットワーク部）

| リソース種別 | 数量（1テナント） | 見積按分備考 |
|------------|---------------|-----------|
| VPC | 1 | テナント数分 |
| サブネット | 10 (5区分×2AZ) | テナント数分 |
| IGW | 1 | テナント数分 |
| NAT GW | 2 (prod) / 1 (dev) | AZ 数依存 |
| EIP | 2 (prod) / 1 (dev) | NAT GW 数分 |
| Route Table | 6 (区分別+AZ別) | テナント数分 |
| TGW Attachment | 1 | prod のみ |
| VPC Endpoint (Gateway) | 1 (S3) | |
| VPC Endpoint (Interface) | 11 | パターンで一部差分 (§9.2) |
| Security Group | 6 (共通骨子) | パターン固有 SG は別計上 |
| NACL | 5 (区分別) | |
| VPC Flow Logs | 1 Log Group | |
| Route53 PHZ | 1 per テナント | |
| Resolver Endpoint | 2 (In/Out) | |

**合計: 共通 NW リソース種別 約 14 種 / テナント**
