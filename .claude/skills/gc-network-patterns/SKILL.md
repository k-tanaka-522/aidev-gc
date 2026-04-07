---
description: VPC/TGW設計パターン（CIDR設計、サブネット分割、ルーティング、セキュリティグループ設計、GCリファレンスアーキテクチャのNW構成）
---

# VPC/TGW 設計パターン

## CIDR 推奨値

### 単一Region パターン
```
Organizations CIDR: 10.0.0.0/8

Region-A (ap-northeast-1):
  └─ VPC-Main: 10.0.0.0/16
     ├─ Public Subnet (AZ-a): 10.0.1.0/24
     ├─ Public Subnet (AZ-c): 10.0.2.0/24
     ├─ Private Subnet (AZ-a): 10.0.11.0/24
     ├─ Private Subnet (AZ-c): 10.0.12.0/24
     ├─ Protected Subnet (AZ-a): 10.0.21.0/24
     └─ Protected Subnet (AZ-c): 10.0.22.0/24
```

### Multi-Region パターン
```
Organizations CIDR: 10.0.0.0/8

Region-A (ap-northeast-1):
  └─ VPC: 10.0.0.0/16

Region-B (ap-southeast-1):
  └─ VPC: 10.1.0.0/16

Region-C (eu-west-1):
  └─ VPC: 10.2.0.0/16
```

### マルチアカウント パターン
```
Organizations CIDR: 10.0.0.0/8

Account-1 (Shared Services):
  └─ VPC: 10.0.0.0/16 (Network Hub)

Account-2 (App-Dev):
  └─ VPC: 10.1.0.0/16

Account-3 (App-Prod):
  └─ VPC: 10.2.0.0/16

Account-4 (Data Analytics):
  └─ VPC: 10.3.0.0/16
```

**CIDR設計ルール**:
- 組織全体: /8（256のVPC分）
- 各VPC: /16（256のSubnet分）
- 各Subnet: /24（256のIP分、実際には約250個利用可）
- 成長余裕: 現在使用の2〜3倍の余裕を確保

## Subnet分割パターン

### パターン1: 3層構成（Web/AP/DB）

```
VPC: 10.0.0.0/16 (ap-northeast-1)

Public Subnet層（Internet接続可）:
  ├─ Public-1a: 10.0.1.0/24 (NAT Gateway, ALB配置)
  └─ Public-1c: 10.0.2.0/24 (NAT Gateway, ALB配置)

Private Subnet層（Outbound経由）:
  ├─ Private-AP-1a: 10.0.11.0/24 (EC2 App Server)
  └─ Private-AP-1c: 10.0.12.0/24 (EC2 App Server)

Protected Subnet層（Inbound禁止）:
  ├─ Protected-DB-1a: 10.0.21.0/24 (RDS Primary)
  └─ Protected-DB-1c: 10.0.22.0/24 (RDS Replica)
```

### パターン2: DMZ + セグメント分離

```
VPC: 10.0.0.0/16

DMZ Subnet:
  ├─ DMZ-1a: 10.0.1.0/24
  └─ DMZ-1c: 10.0.2.0/24

Internal Network:
  ├─ Corporate-1a: 10.0.11.0/24
  ├─ Corporate-1c: 10.0.12.0/24
  ├─ Partner-1a: 10.0.13.0/24
  └─ Partner-1c: 10.0.14.0/24

Data Zone:
  ├─ Data-1a: 10.0.21.0/24
  └─ Data-1c: 10.0.22.0/24
```

## セキュリティグループ設計

### Web層（Public Subnet）

```
名前: sg-web-tier
Inbound:
  - Port 80 (HTTP): 0.0.0.0/0 (Internet全体)
  - Port 443 (HTTPS): 0.0.0.0/0
  - Port 22 (SSH): 10.0.0.0/16 (VPC内のみ, Bastion経由)

Outbound:
  - Port 443 (HTTPS): 0.0.0.0/0 (外部API呼び出し)
  - Port 53 (DNS): 0.0.0.0/0 (DNS解決)
  - Port 3306 (MySQL): 10.0.21.0/23 (DB層へ)
```

### AP層（Private Subnet）

```
名前: sg-app-tier
Inbound:
  - Port 8080 (APP): 10.0.1.0/24, 10.0.2.0/24 (Web層から)
  - Port 22 (SSH): 10.0.0.0/16 (VPC内のみ, Bastion経由)

Outbound:
  - Port 443 (HTTPS): 0.0.0.0/0 (外部API)
  - Port 53 (DNS): 0.0.0.0/0
  - Port 3306 (MySQL): 10.0.21.0/23 (DB層へ)
  - Port 5432 (PostgreSQL): 10.0.21.0/23
```

### DB層（Protected Subnet）

```
名前: sg-db-tier
Inbound:
  - Port 3306 (MySQL): 10.0.11.0/23, 10.0.12.0/23 (AP層から)
  - Port 5432 (PostgreSQL): 10.0.11.0/23, 10.0.12.0/23
  - Port 1433 (MSSQL): 10.0.11.0/23, 10.0.12.0/23

Outbound:
  - Port 443 (HTTPS): 0.0.0.0/0 (メトリクス送信等)
  - Port 53 (DNS): 0.0.0.0/0
```

### Bastion/踏み台

```
名前: sg-bastion
Inbound:
  - Port 22 (SSH): {運用チーム IP} (指定IP のみ)

Outbound:
  - Port 22 (SSH): 10.0.0.0/16 (VPC内全体)
  - Port 3389 (RDP): 10.0.0.0/16 (Windows接続)
```

## Network ACL （NACLタイプ別設定例）

### Public Subnet NACL

```
Inbound Rules:
  Rule#: 100, Protocol: TCP, Port: 80, CIDR: 0.0.0.0/0, Allow
  Rule#: 110, Protocol: TCP, Port: 443, CIDR: 0.0.0.0/0, Allow
  Rule#: 120, Protocol: TCP, Port: 1024-65535, CIDR: 0.0.0.0/0, Allow (Return traffic)
  Rule#: 32767, Protocol: -1, CIDR: 0.0.0.0/0, Deny (Default deny)

Outbound Rules:
  Rule#: 100, Protocol: TCP, Port: 80, CIDR: 0.0.0.0/0, Allow
  Rule#: 110, Protocol: TCP, Port: 443, CIDR: 0.0.0.0/0, Allow
  Rule#: 120, Protocol: TCP, Port: 1024-65535, CIDR: 0.0.0.0/0, Allow
  Rule#: 32767, Protocol: -1, CIDR: 0.0.0.0/0, Deny
```

## TransitGateway（TGW）設計

### マルチアカウント連携 パターン

```
Organizations
│
├─ Account-1: Shared Services (TGW Hub)
│   └─ VPC: 10.0.0.0/16
│       └─ TGW Attachment
│
├─ Account-2: App-Dev
│   └─ VPC: 10.1.0.0/16
│       └─ TGW Attachment (Resource Access Manager経由)
│
├─ Account-3: App-Prod
│   └─ VPC: 10.2.0.0/16
│       └─ TGW Attachment
│
└─ Account-4: Data Lake
    └─ VPC: 10.3.0.0/16
        └─ TGW Attachment
```

### TGW Route Table 設計

```
TGW Route Table: Prod

Route:
  Destination: 10.0.0.0/16    Target: VPC-Shared-Services   (デフォルト)
  Destination: 10.1.0.0/16    Target: VPC-App-Dev
  Destination: 10.2.0.0/16    Target: VPC-App-Prod (本route)
  Destination: 10.3.0.0/16    Target: VPC-Data-Lake
```

## Route53 設計

### Private Hosted Zone（VPC内部DNS）

```
Zone名: internal.example.com

Records:
  api.internal.example.com → 10.0.11.10 (AP層 NLB)
  db.internal.example.com → 10.0.21.10 (RDS cluster endpoint)
  cache.internal.example.com → 10.0.11.20 (ElastiCache)
```

### 条件付きフォワーディング（ハイブリッド運用）

```
Route53 Resolver Rules:

Rule: corp.local (オンプレミスドメイン)
  Forward to: 192.168.1.10:53 (オンプレDNS)
  Associations: VPC-Main

Rule: internal.example.com
  Forward to: Route53 Resolver Endpoint (VPC内)
```

## NAT Gateway 配置

```
Public Subnet (AZ-a): 10.0.1.0/24
  ├─ NAT Gateway (Elastic IP: x.x.x.x)
  └─ ALB

Public Subnet (AZ-c): 10.0.2.0/24
  ├─ NAT Gateway (Elastic IP: y.y.y.y)
  └─ ALB

Private Subnet (AZ-a): 10.0.11.0/24
  ├─ Route: 0.0.0.0/0 → NAT Gateway (AZ-a)
  └─ EC2

Private Subnet (AZ-c): 10.0.12.0/24
  ├─ Route: 0.0.0.0/0 → NAT Gateway (AZ-c)
  └─ EC2
```

**ルール**: 各AZで Local NAT Gateway を使用（クロスAZ通信コスト回避）

## VPC Endpoint 設計

```
S3 Gateway Endpoint:
  VPC: 10.0.0.0/16
  Route Table: Private-Route-Table
  Policy: S3 Bucket 制限（会社ボケット のみアクセス可）

DynamoDB Gateway Endpoint:
  VPC: 10.0.0.0/16
  Route Table: Private-Route-Table

Secrets Manager Interface Endpoint:
  VPC: 10.0.0.0/16
  Subnet: 10.0.11.0/24, 10.0.12.0/24
  Security Group: sg-vpc-endpoint

Systems Manager Interface Endpoints:
  - ssm
  - ssm-messages
  - ec2-messages
```

## ネットワーク設計チェックリスト

- [ ] CIDR 帯が Organization 全体で重複なし
- [ ] 各 VPC が /16、Subnet が /24 で適切に分割
- [ ] Public/Private/Protected Subnet が論理的に分離
- [ ] SecurityGroup ルール数が管理可能（50～100ルール/SG以下推奨）
- [ ] NACL が Stateless 特性に基づいて適切に設定
- [ ] TGW が複数 VPC 間の通信を効率的に制御
- [ ] Route53 Private Hosted Zone がクラス内部名前解決をサポート
- [ ] NAT Gateway が AZ 単位で冗長化
- [ ] VPC Endpoint が適切に設定（コスト削減）
- [ ] フェイルオーバー時のルーティング変更が自動化可能
