---
name: drawio-diagram-generator
description: draw.io形式でAWS構成図・フロー図を生成する規約とリファレンス
tags:
  - infrastructure
  - diagram
  - aws
  - iac
  - draw.io
---

# draw.io図形生成スキル

## 概要

このスキルは、ガバメントクラウド(GC)のAWSインフラ設計案件における**構成図・フロー図をdraw.io XML形式**で自動生成するための規約、テンプレート、リファレンスを提供します。

### 生成対象図
- VPC・ネットワーク構成図
- Transit Gateway接続図（LGWAN・ASP連携）
- セキュリティ構成図（WAF/Shield/GuardDuty）
- 監視・ロギング構成図
- DR・バックアップ構成図
- 移行フロー図（段階移行）
- CI/CDパイプライン図

### ツール・成果物形式
- **生成形式:** draw.io XML（uncompressed）
- **出力拡張子:** `.drawio`
- **PNG化:** draw.io CLI または WebブラウザのExport機能で自動化
- **設計書との連携:** Markdown内に `![図名](xxx.drawio.png)` で参照

---

## 1. 生成ルール

### 1.1 XML構造の必須要件

すべてのdraw.io XMLファイルは以下の構造を守ること:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<mxfile host="app.diagrams.net" type="device">
  <diagram id="{ユニークなID}" name="Page-1">
    <mxGraphModel dx="1422" dy="762" grid="1" gridSize="10" guides="1"
                  tooltips="1" connect="1" arrows="1" fold="1" page="1"
                  pageScale="1" pageWidth="1169" pageHeight="827"
                  math="0" shadow="0">
      <root>
        <mxCell id="0"/>
        <mxCell id="1" parent="0"/>
        <!-- ここに図形やエッジを定義 -->
      </root>
    </mxGraphModel>
  </diagram>
</mxfile>
```

**重要:**
- `compressed="false"` を明示せず、常に uncompressed XML を使用
- id="0" = スタイルシート定義用セル（変更不可）
- id="1" = キャンバス親セル（すべての図形の parent="1"）
- pageWidth="1169" pageHeight="827" は A3 横サイズ（デフォルト）

### 1.2 セル（図形）定義の規約

```xml
<mxCell id="uniqueId" value="表示テキスト" style="style=value;..." vertex="1" parent="1">
  <mxGeometry x="100" y="50" width="200" height="100" as="geometry"/>
</mxCell>
```

**スタイル指定の共通部分:**
- `html=1` — HTML エンコーディング対応
- `whiteSpace=wrap` — テキストの自動折り返し
- `fontSize=12` — デフォルトフォントサイズ
- `rounded=1` — コーナー丸め（推奨）
- `strokeColor=#232F3E` — AWS標準の濃いグレー
- `fillColor=#ffffff` — 背景色

### 1.3 グループ（コンテナ）の定義

VPC、サブネット、AZ、セキュリティグループなどは `container=1` で定義:

```xml
<mxCell id="vpc1" value="VPC (10.0.0.0/16)"
         style="...shape=mxgraph.aws4.group;grIcon=mxgraph.aws4.group_vpc;
                 container=1;pointerEvents=0;..."
         vertex="1" parent="1">
  <mxGeometry x="50" y="50" width="1000" height="700" as="geometry"/>
</mxCell>

<!-- vpc1の子要素は parent="vpc1" を指定 -->
<mxCell id="az1" value="Availability Zone a"
         style="...shape=mxgraph.aws4.group;grIcon=mxgraph.aws4.group_availability_zone;
                 container=1;..."
         vertex="1" parent="vpc1">
  <mxGeometry x="50" y="100" width="450" height="500" as="geometry"/>
</mxCell>
```

### 1.4 エッジ（接続線）の定義

```xml
<mxCell id="edge1" value=""
         style="edgeStyle=orthogonalEdgeStyle;html=1;rounded=1;
                 strokeColor=#232F3E;strokeWidth=2;"
         edge="1" source="sourceId" target="targetId" parent="1">
  <mxGeometry relative="1" as="geometry"/>
</mxCell>
```

**エッジスタイルパターン:**
- `edgeStyle=orthogonalEdgeStyle` — 直交スタイル（推奨）
- `rounded=1` — 線を丸める
- `dashed=1` — 破線（セキュリティ境界など）
- `strokeColor` — 線の色

### 1.5 ファイル名規則

```
{出力ディレクトリ}/{成果物ID}-{図の簡潔な説明}.drawio

例:
NW-001-vpc-architecture.drawio
NW-002-tgw-connectivity.drawio
SEC-001-security-posture.drawio
MON-001-monitoring-flow.drawio
```

---

## 1.6 図の構成ルール（サンプル実装からの教訓）

### 全体構成図には外部環境を必ず含めること

**AWS内部だけの図を「全体構成図」にしてはいけない。** GC案件の構成図は以下の全領域を含めること:

```
[住民/利用者] → [インターネット] → [CloudFront/WAF] → [AWS Cloud/VPC] ← [TGW] ← [DirectConnect] ← [LGWAN] ← [市庁舎(オンプレ)]
                                                                                                              ← [ASP事業者]
```

**必須領域:**

| 領域 | 含めるもの | グループ色 |
|------|-----------|-----------|
| インターネット側 | 住民/利用者、インターネット雲 | fillColor=#E3F2FD, strokeColor=#1565C0 |
| AWS Cloud | VPC、サブネット、リソース群 | fillColor=none, strokeColor=#232F3E |
| 接続基盤 | TGW、DirectConnect、VPNバックアップ | - |
| LGWAN網 | LGWAN雲（概念表現） | fillColor=#FFF3E0, strokeColor=#E65100 |
| オンプレ（市庁舎等） | 庁内LAN、既存サーバー、職員端末 | fillColor=#F3E5F5, strokeColor=#7B1FA2 |
| ASP事業者 | 外部連携先 | fillColor=#E8F5E9, strokeColor=#2E7D32 |

### 図の種類と使い分け

GC案件では以下の図を使い分ける:

| 図の種類 | 目的 | 含める範囲 | ファイル名例 |
|---------|------|-----------|------------|
| **全体構成図** | 全接続経路の俯瞰 | 住民〜AWS〜LGWAN〜市庁舎 | `NW-001-overall-architecture.drawio` |
| **VPC詳細図** | AWS内部の詳細設計 | VPC/サブネット/SG/NACL | `NW-002-vpc-detail.drawio` |
| **TGW接続図** | マルチアカウント/LGWAN接続 | TGW/VPC Attachment/ルーティング | `NW-003-tgw-connectivity.drawio` |
| **セキュリティ構成図** | セキュリティサービス配置 | WAF/Shield/GuardDuty/SecurityHub | `SEC-001-security-posture.drawio` |
| **データフロー図** | 通信フローの可視化 | フロー経路にフォーカス | `NW-004-data-flow.drawio` |

### オンプレ側の表現

AWSシェイプがないオンプレ要素は以下で表現:

| 要素 | 表現方法 |
|------|---------|
| 市庁舎 | `rounded=1;container=1` のグループ |
| 庁内サーバー | `shape=mxgraph.aws4.traditional_server` |
| 職員端末 | `shape=mxgraph.aws4.client` |
| LGWAN | `ellipse`（雲形） |
| DirectConnect | `shape=mxgraph.aws4.resourceIcon;resIcon=mxgraph.aws4.direct_connect` |
| VPNバックアップ | エッジに `dashed=1` + ラベル「VPN（バックアップ）」 |

### 接続線には必ずラベルをつけること

各接続フローの目的が一目でわかるよう、ラベルを付ける:
- 「住民向けWebサービス」
- 「庁内業務システム」
- 「ASP連携」
- 「VPN（バックアップ）」
- 「アウトバウンド通信」

---

## 2. GCインフラ頻出図パターン

### 2.1 VPC構成図（Multi-AZ標準構成）

**典型パターン:** 2つのAZ、各AZにPublic/Private Subnet、IGW、NAT GW、ALB、EC2

```xml
<?xml version="1.0" encoding="UTF-8"?>
<mxfile host="app.diagrams.net" type="device">
  <diagram id="vpc_multi_az" name="VPC-Architecture">
    <mxGraphModel dx="1422" dy="762" grid="1" gridSize="10" guides="1"
                  tooltips="1" connect="1" arrows="1" fold="1" page="1"
                  pageScale="1" pageWidth="1169" pageHeight="827" math="0" shadow="0">
      <root>
        <mxCell id="0"/>
        <mxCell id="1" parent="0"/>

        <!-- VPCグループ -->
        <mxCell id="vpc1" value="VPC (10.0.0.0/16)"
                 style="points=[[0,0],[0.25,0],[0.5,0],[0.75,0],[1,0],[1,0.25],[1,0.5],[1,0.75],[1,1],[0.75,1],[0.5,1],[0.25,1],[0,1],[0,0.75],[0,0.5],[0,0.25]];outlineConnect=0;gradientColor=none;html=1;whiteSpace=wrap;fontSize=12;fontStyle=1;container=1;pointerEvents=0;collapsible=0;recursiveResize=0;shape=mxgraph.aws4.group;grIcon=mxgraph.aws4.group_vpc;strokeColor=#8C4FFF;fillColor=none;verticalAlign=top;align=left;spacingLeft=30;fontColor=#AAB7B8;dashed=0;"
                 vertex="1" parent="1">
          <mxGeometry x="40" y="40" width="1080" height="740" as="geometry"/>
        </mxCell>

        <!-- AZ 1a -->
        <mxCell id="az1a" value="Availability Zone a (ap-northeast-1a)"
                 style="points=[[0,0],[0.25,0],[0.5,0],[0.75,0],[1,0],[1,0.25],[1,0.5],[1,0.75],[1,1],[0.75,1],[0.5,1],[0.25,1],[0,1],[0,0.75],[0,0.5],[0,0.25]];outlineConnect=0;gradientColor=none;html=1;whiteSpace=wrap;fontSize=11;container=1;pointerEvents=0;collapsible=0;recursiveResize=0;shape=mxgraph.aws4.group;grIcon=mxgraph.aws4.group_availability_zone;strokeColor=#545B64;fillColor=none;verticalAlign=top;align=left;spacingLeft=30;fontColor=#AAB7B8;dashed=0;"
                 vertex="1" parent="vpc1">
          <mxGeometry x="60" y="80" width="440" height="620" as="geometry"/>
        </mxCell>

        <!-- Public Subnet 1a -->
        <mxCell id="pubsub1a" value="Public Subnet (10.0.1.0/24)"
                 style="points=[[0,0],[0.25,0],[0.5,0],[0.75,0],[1,0],[1,0.25],[1,0.5],[1,0.75],[1,1],[0.75,1],[0.5,1],[0.25,1],[0,1],[0,0.75],[0,0.5],[0,0.25]];outlineConnect=0;gradientColor=none;html=1;whiteSpace=wrap;fontSize=10;container=1;pointerEvents=0;collapsible=0;recursiveResize=0;shape=mxgraph.aws4.group;grIcon=mxgraph.aws4.group_subnet_public;strokeColor=#7AA116;fillColor=none;verticalAlign=top;align=left;spacingLeft=30;fontColor=#AAB7B8;dashed=0;"
                 vertex="1" parent="az1a">
          <mxGeometry x="20" y="30" width="400" height="120" as="geometry"/>
        </mxCell>

        <!-- ALB in Public Subnet 1a -->
        <mxCell id="alb1a" value="ALB (10.0.1.50)"
                 style="shape=mxgraph.aws4.resourceIcon;resIcon=mxgraph.aws4.elastic_load_balancing;html=1;whiteSpace=wrap;fontSize=10;strokeColor=#232F3E;fillColor=#ffffff;rounded=1;"
                 vertex="1" parent="pubsub1a">
          <mxGeometry x="150" y="45" width="100" height="60" as="geometry"/>
        </mxCell>

        <!-- Private Subnet 1a -->
        <mxCell id="privsub1a" value="Private Subnet (10.0.11.0/24)"
                 style="points=[[0,0],[0.25,0],[0.5,0],[0.75,0],[1,0],[1,0.25],[1,0.5],[1,0.75],[1,1],[0.75,1],[0.5,1],[0.25,1],[0,1],[0,0.75],[0,0.5],[0,0.25]];outlineConnect=0;gradientColor=none;html=1;whiteSpace=wrap;fontSize=10;container=1;pointerEvents=0;collapsible=0;recursiveResize=0;shape=mxgraph.aws4.group;grIcon=mxgraph.aws4.group_subnet_private;strokeColor=#147EBA;fillColor=none;verticalAlign=top;align=left;spacingLeft=30;fontColor=#AAB7B8;dashed=0;"
                 vertex="1" parent="az1a">
          <mxGeometry x="20" y="170" width="400" height="220" as="geometry"/>
        </mxCell>

        <!-- EC2 in Private Subnet 1a -->
        <mxCell id="ec2_1a_1" value="EC2 (10.0.11.50)"
                 style="shape=mxgraph.aws4.resourceIcon;resIcon=mxgraph.aws4.ec2;html=1;whiteSpace=wrap;fontSize=10;strokeColor=#232F3E;fillColor=#ffffff;rounded=1;"
                 vertex="1" parent="privsub1a">
          <mxGeometry x="150" y="50" width="100" height="60" as="geometry"/>
        </mxCell>

        <mxCell id="ec2_1a_2" value="EC2 (10.0.11.100)"
                 style="shape=mxgraph.aws4.resourceIcon;resIcon=mxgraph.aws4.ec2;html=1;whiteSpace=wrap;fontSize=10;strokeColor=#232F3E;fillColor=#ffffff;rounded=1;"
                 vertex="1" parent="privsub1a">
          <mxGeometry x="150" y="130" width="100" height="60" as="geometry"/>
        </mxCell>

        <!-- NAT GW in Public Subnet 1a -->
        <mxCell id="nat1a" value="NAT GW (10.0.1.100)"
                 style="shape=mxgraph.aws4.resourceIcon;resIcon=mxgraph.aws4.nat_gateway;html=1;whiteSpace=wrap;fontSize=10;strokeColor=#232F3E;fillColor=#ffffff;rounded=1;"
                 vertex="1" parent="pubsub1a">
          <mxGeometry x="270" y="45" width="100" height="60" as="geometry"/>
        </mxCell>

        <!-- AZ 1c (similar structure) -->
        <mxCell id="az1c" value="Availability Zone c (ap-northeast-1c)"
                 style="points=[[0,0],[0.25,0],[0.5,0],[0.75,0],[1,0],[1,0.25],[1,0.5],[1,0.75],[1,1],[0.75,1],[0.5,1],[0.25,1],[0,1],[0,0.75],[0,0.5],[0,0.25]];outlineConnect=0;gradientColor=none;html=1;whiteSpace=wrap;fontSize=11;container=1;pointerEvents=0;collapsible=0;recursiveResize=0;shape=mxgraph.aws4.group;grIcon=mxgraph.aws4.group_availability_zone;strokeColor=#545B64;fillColor=none;verticalAlign=top;align=left;spacingLeft=30;fontColor=#AAB7B8;dashed=0;"
                 vertex="1" parent="vpc1">
          <mxGeometry x="540" y="80" width="440" height="620" as="geometry"/>
        </mxCell>

        <!-- Public Subnet 1c -->
        <mxCell id="pubsub1c" value="Public Subnet (10.0.2.0/24)"
                 style="points=[[0,0],[0.25,0],[0.5,0],[0.75,0],[1,0],[1,0.25],[1,0.5],[1,0.75],[1,1],[0.75,1],[0.5,1],[0.25,1],[0,1],[0,0.75],[0,0.5],[0,0.25]];outlineConnect=0;gradientColor=none;html=1;whiteSpace=wrap;fontSize=10;container=1;pointerEvents=0;collapsible=0;recursiveResize=0;shape=mxgraph.aws4.group;grIcon=mxgraph.aws4.group_subnet_public;strokeColor=#7AA116;fillColor=none;verticalAlign=top;align=left;spacingLeft=30;fontColor=#AAB7B8;dashed=0;"
                 vertex="1" parent="az1c">
          <mxGeometry x="20" y="30" width="400" height="120" as="geometry"/>
        </mxCell>

        <!-- ALB in Public Subnet 1c -->
        <mxCell id="alb1c" value="ALB (10.0.2.50)"
                 style="shape=mxgraph.aws4.resourceIcon;resIcon=mxgraph.aws4.elastic_load_balancing;html=1;whiteSpace=wrap;fontSize=10;strokeColor=#232F3E;fillColor=#ffffff;rounded=1;"
                 vertex="1" parent="pubsub1c">
          <mxGeometry x="150" y="45" width="100" height="60" as="geometry"/>
        </mxCell>

        <!-- Private Subnet 1c -->
        <mxCell id="privsub1c" value="Private Subnet (10.0.12.0/24)"
                 style="points=[[0,0],[0.25,0],[0.5,0],[0.75,0],[1,0],[1,0.25],[1,0.5],[1,0.75],[1,1],[0.75,1],[0.5,1],[0.25,1],[0,1],[0,0.75],[0,0.5],[0,0.25]];outlineConnect=0;gradientColor=none;html=1;whiteSpace=wrap;fontSize=10;container=1;pointerEvents=0;collapsible=0;recursiveResize=0;shape=mxgraph.aws4.group;grIcon=mxgraph.aws4.group_subnet_private;strokeColor=#147EBA;fillColor=none;verticalAlign=top;align=left;spacingLeft=30;fontColor=#AAB7B8;dashed=0;"
                 vertex="1" parent="az1c">
          <mxGeometry x="20" y="170" width="400" height="220" as="geometry"/>
        </mxCell>

        <!-- EC2 in Private Subnet 1c -->
        <mxCell id="ec2_1c_1" value="EC2 (10.0.12.50)"
                 style="shape=mxgraph.aws4.resourceIcon;resIcon=mxgraph.aws4.ec2;html=1;whiteSpace=wrap;fontSize=10;strokeColor=#232F3E;fillColor=#ffffff;rounded=1;"
                 vertex="1" parent="privsub1c">
          <mxGeometry x="150" y="50" width="100" height="60" as="geometry"/>
        </mxCell>

        <!-- NAT GW in Public Subnet 1c -->
        <mxCell id="nat1c" value="NAT GW (10.0.2.100)"
                 style="shape=mxgraph.aws4.resourceIcon;resIcon=mxgraph.aws4.nat_gateway;html=1;whiteSpace=wrap;fontSize=10;strokeColor=#232F3E;fillColor=#ffffff;rounded=1;"
                 vertex="1" parent="pubsub1c">
          <mxGeometry x="270" y="45" width="100" height="60" as="geometry"/>
        </mxCell>

        <!-- IGW outside VPC -->
        <mxCell id="igw" value="Internet\nGateway"
                 style="shape=mxgraph.aws4.resourceIcon;resIcon=mxgraph.aws4.internet_gateway;html=1;whiteSpace=wrap;fontSize=10;strokeColor=#232F3E;fillColor=#ffffff;rounded=1;"
                 vertex="1" parent="1">
          <mxGeometry x="1180" y="350" width="100" height="80" as="geometry"/>
        </mxCell>

        <!-- Edges -->
        <mxCell id="edge_alb_igw" value=""
                 style="edgeStyle=orthogonalEdgeStyle;html=1;rounded=1;strokeColor=#232F3E;strokeWidth=2;"
                 edge="1" source="alb1a" target="igw" parent="1">
          <mxGeometry relative="1" as="geometry"/>
        </mxCell>

        <mxCell id="edge_alb_ec2_1a" value=""
                 style="edgeStyle=orthogonalEdgeStyle;html=1;rounded=1;strokeColor=#232F3E;strokeWidth=2;"
                 edge="1" source="alb1a" target="ec2_1a_1" parent="1">
          <mxGeometry relative="1" as="geometry"/>
        </mxCell>

        <mxCell id="edge_ec2_nat_1a" value=""
                 style="edgeStyle=orthogonalEdgeStyle;html=1;rounded=1;strokeColor=#232F3E;strokeWidth=2;"
                 edge="1" source="ec2_1a_1" target="nat1a" parent="1">
          <mxGeometry relative="1" as="geometry"/>
        </mxCell>

      </root>
    </mxGraphModel>
  </diagram>
</mxfile>
```

### 2.2 Transit Gateway接続図（LGWAN・ASP連携）

**要素:** TGW、LGWAN接続、複数VPC、ASP、Direct Connect

```xml
<!-- Transit GatewayコンテナとVPCアタッチメント -->
<mxCell id="tgw" value="Transit Gateway\n(jp-prd-gc-tgw)"
         style="shape=mxgraph.aws4.resourceIcon;resIcon=mxgraph.aws4.transit_gateway;html=1;whiteSpace=wrap;fontSize=11;strokeColor=#232F3E;fillColor=#ffffff;rounded=1;fontStyle=1;"
         vertex="1" parent="1">
  <mxGeometry x="500" y="300" width="120" height="100" as="geometry"/>
</mxCell>

<!-- LGWAN Connection -->
<mxCell id="lgwan" value="LGWAN\nConnection"
         style="rounded=1;html=1;whiteSpace=wrap;fontSize=10;strokeColor=#FF6B35;fillColor=#FFE5D9;strokeWidth=2;dashed=0;"
         vertex="1" parent="1">
  <mxGeometry x="800" y="350" width="100" height="60" as="geometry"/>
</mxCell>

<mxCell id="edge_tgw_lgwan" value="LGWAN"
         style="edgeStyle=orthogonalEdgeStyle;html=1;rounded=1;strokeColor=#FF6B35;strokeWidth=2;endArrow=classic;"
         edge="1" source="tgw" target="lgwan" parent="1">
  <mxGeometry relative="1" as="geometry"/>
</mxCell>

<!-- Spoke VPC Attachments -->
<mxCell id="edge_tgw_vpc1" value="Spoke VPC-1"
         style="edgeStyle=orthogonalEdgeStyle;html=1;rounded=1;strokeColor=#232F3E;strokeWidth=2;endArrow=classic;"
         edge="1" source="tgw" target="vpc1" parent="1">
  <mxGeometry relative="1" as="geometry"/>
</mxCell>
```

### 2.3 セキュリティ構成図

**要素:** WAF、Shield Advanced、GuardDuty、Security Hub、KMS、IAM

```xml
<!-- WAF -->
<mxCell id="waf" value="WAF\n(Web ACL)"
         style="shape=mxgraph.aws4.resourceIcon;resIcon=mxgraph.aws4.waf;html=1;whiteSpace=wrap;fontSize=10;strokeColor=#232F3E;fillColor=#ffffff;rounded=1;"
         vertex="1" parent="1">
  <mxGeometry x="100" y="80" width="100" height="80" as="geometry"/>
</mxCell>

<!-- Shield Advanced -->
<mxCell id="shield" value="Shield\nAdvanced"
         style="shape=mxgraph.aws4.resourceIcon;resIcon=mxgraph.aws4.shield;html=1;whiteSpace=wrap;fontSize=10;strokeColor=#232F3E;fillColor=#ffffff;rounded=1;"
         vertex="1" parent="1">
  <mxGeometry x="250" y="80" width="100" height="80" as="geometry"/>
</mxCell>

<!-- GuardDuty -->
<mxCell id="guardduty" value="GuardDuty\n(IDS/IPS)"
         style="shape=mxgraph.aws4.resourceIcon;resIcon=mxgraph.aws4.guardduty;html=1;whiteSpace=wrap;fontSize=10;strokeColor=#232F3E;fillColor=#ffffff;rounded=1;"
         vertex="1" parent="1">
  <mxGeometry x="400" y="80" width="100" height="80" as="geometry"/>
</mxCell>

<!-- Security Hub (aggregation) -->
<mxCell id="sechub" value="Security Hub\n(Findings)"
         style="shape=mxgraph.aws4.resourceIcon;resIcon=mxgraph.aws4.security_hub;html=1;whiteSpace=wrap;fontSize=10;strokeColor=#232F3E;fillColor=#ffffff;rounded=1;"
         vertex="1" parent="1">
  <mxGeometry x="250" y="250" width="100" height="80" as="geometry"/>
</mxCell>

<!-- Edges from security sources to Security Hub -->
<mxCell id="edge_waf_sechub" value=""
         style="edgeStyle=orthogonalEdgeStyle;html=1;rounded=1;strokeColor=#232F3E;strokeWidth=1.5;"
         edge="1" source="waf" target="sechub" parent="1">
  <mxGeometry relative="1" as="geometry"/>
</mxCell>

<mxCell id="edge_guardduty_sechub" value=""
         style="edgeStyle=orthogonalEdgeStyle;html=1;rounded=1;strokeColor=#232F3E;strokeWidth=1.5;"
         edge="1" source="guardduty" target="sechub" parent="1">
  <mxGeometry relative="1" as="geometry"/>
</mxCell>
```

### 2.4 監視・ロギング構成図

**要素:** CloudWatch、CloudTrail、Config、SNS、EventBridge

```xml
<!-- CloudWatch -->
<mxCell id="cloudwatch" value="CloudWatch\n(Metrics/Logs)"
         style="shape=mxgraph.aws4.resourceIcon;resIcon=mxgraph.aws4.cloudwatch;html=1;whiteSpace=wrap;fontSize=10;strokeColor=#232F3E;fillColor=#ffffff;rounded=1;"
         vertex="1" parent="1">
  <mxGeometry x="100" y="80" width="100" height="80" as="geometry"/>
</mxCell>

<!-- CloudTrail -->
<mxCell id="cloudtrail" value="CloudTrail\n(Audit Logs)"
         style="shape=mxgraph.aws4.resourceIcon;resIcon=mxgraph.aws4.cloudtrail;html=1;whiteSpace=wrap;fontSize=10;strokeColor=#232F3E;fillColor=#ffffff;rounded=1;"
         vertex="1" parent="1">
  <mxGeometry x="250" y="80" width="100" height="80" as="geometry"/>
</mxCell>

<!-- AWS Config -->
<mxCell id="config" value="AWS Config\n(Compliance)"
         style="shape=mxgraph.aws4.resourceIcon;resIcon=mxgraph.aws4.config;html=1;whiteSpace=wrap;fontSize=10;strokeColor=#232F3E;fillColor=#ffffff;rounded=1;"
         vertex="1" parent="1">
  <mxGeometry x="400" y="80" width="100" height="80" as="geometry"/>
</mxCell>

<!-- SNS (notification) -->
<mxCell id="sns" value="SNS\n(Notifications)"
         style="shape=mxgraph.aws4.resourceIcon;resIcon=mxgraph.aws4.simple_notification_service;html=1;whiteSpace=wrap;fontSize=10;strokeColor=#232F3E;fillColor=#ffffff;rounded=1;"
         vertex="1" parent="1">
  <mxGeometry x="250" y="250" width="100" height="80" as="geometry"/>
</mxCell>

<!-- EventBridge (orchestration) -->
<mxCell id="eventbridge" value="EventBridge\n(Rules)"
         style="shape=mxgraph.aws4.resourceIcon;resIcon=mxgraph.aws4.eventbridge;html=1;whiteSpace=wrap;fontSize=10;strokeColor=#232F3E;fillColor=#ffffff;rounded=1;"
         vertex="1" parent="1">
  <mxGeometry x="550" y="165" width="100" height="80" as="geometry"/>
</mxCell>

<!-- Edges -->
<mxCell id="edge_cw_sns" value="Alarms"
         style="edgeStyle=orthogonalEdgeStyle;html=1;rounded=1;strokeColor=#FF9900;strokeWidth=2;endArrow=classic;"
         edge="1" source="cloudwatch" target="sns" parent="1">
  <mxGeometry relative="1" as="geometry"/>
</mxCell>

<mxCell id="edge_trail_eventbridge" value=""
         style="edgeStyle=orthogonalEdgeStyle;html=1;rounded=1;strokeColor=#232F3E;strokeWidth=1.5;"
         edge="1" source="cloudtrail" target="eventbridge" parent="1">
  <mxGeometry relative="1" as="geometry"/>
</mxCell>
```

---

## 3. AWS4シェイプリファレンス（GC頻出）

### コンピュート
- `ec2` - EC2 Instance
- `lambda` - AWS Lambda
- `ecs` - Elastic Container Service
- `eks` - Elastic Kubernetes Service
- `auto_scaling2` - Auto Scaling Group
- `elasticbeanstalk` - Elastic Beanstalk

### ストレージ
- `s3` - S3 Bucket
- `elastic_block_store` - EBS Volume
- `elastic_file_system` - Amazon EFS
- `fsx` - Amazon FSx
- `storage_gateway` - Storage Gateway

### データベース
- `rds` - RDS Database Instance
- `dynamodb` - DynamoDB Table
- `aurora` - Amazon Aurora
- `elasticache` - ElastiCache Cluster
- `redshift` - Amazon Redshift

### ネットワーク
- `vpc` - VPC
- `internet_gateway` - Internet Gateway
- `nat_gateway` - NAT Gateway
- `vpn_gateway` - VPN Gateway
- `transit_gateway` - Transit Gateway
- `direct_connect` - AWS Direct Connect
- `elastic_load_balancing` - Elastic Load Balancer
- `api_gateway` - API Gateway
- `route_53` - Route 53
- `cloudfront` - CloudFront Distribution

### セキュリティ・IAM
- `iam` - IAM
- `kms` - AWS KMS
- `secrets_manager` - Secrets Manager
- `waf` - AWS WAF
- `shield` - AWS Shield
- `guardduty` - GuardDuty
- `inspector` - Amazon Inspector
- `security_hub` - Security Hub
- `certificate_manager` - AWS Certificate Manager
- `firewall_manager` - AWS Firewall Manager
- `cognito` - Amazon Cognito

### 管理・運用
- `cloudwatch` - CloudWatch
- `cloudtrail` - CloudTrail
- `config` - AWS Config
- `systems_manager` - Systems Manager
- `organizations` - AWS Organizations
- `control_tower` - Control Tower
- `trusted_advisor` - Trusted Advisor
- `eventbridge` - EventBridge

### グループ・コンテナ
- `group_vpc` - VPC Group
- `group_subnet_public` - Public Subnet Group
- `group_subnet_private` - Private Subnet Group
- `group_availability_zone` - Availability Zone Group
- `group_region` - AWS Region Group
- `group_account` - AWS Account Group
- `group_security_group` - Security Group
- `group_aws_cloud` - AWS Cloud

**使用方法:**
```xml
<!-- リソースアイコン -->
<mxCell style="shape=mxgraph.aws4.resourceIcon;resIcon=mxgraph.aws4.ec2;..."

<!-- グループアイコン -->
<mxCell style="shape=mxgraph.aws4.group;grIcon=mxgraph.aws4.group_vpc;..."
```

---

## 4. グループスタイルリファレンス

### VPC
```xml
style="points=[[0,0],[0.25,0],[0.5,0],[0.75,0],[1,0],[1,0.25],[1,0.5],[1,0.75],[1,1],[0.75,1],[0.5,1],[0.25,1],[0,1],[0,0.75],[0,0.5],[0,0.25]];outlineConnect=0;gradientColor=none;html=1;whiteSpace=wrap;fontSize=12;fontStyle=1;container=1;pointerEvents=0;collapsible=0;recursiveResize=0;shape=mxgraph.aws4.group;grIcon=mxgraph.aws4.group_vpc;strokeColor=#8C4FFF;fillColor=none;verticalAlign=top;align=left;spacingLeft=30;fontColor=#AAB7B8;dashed=0;"
```

### Public Subnet
```xml
style="points=[[0,0],[0.25,0],[0.5,0],[0.75,0],[1,0],[1,0.25],[1,0.5],[1,0.75],[1,1],[0.75,1],[0.5,1],[0.25,1],[0,1],[0,0.75],[0,0.5],[0,0.25]];outlineConnect=0;gradientColor=none;html=1;whiteSpace=wrap;fontSize=10;container=1;pointerEvents=0;collapsible=0;recursiveResize=0;shape=mxgraph.aws4.group;grIcon=mxgraph.aws4.group_subnet_public;strokeColor=#7AA116;fillColor=none;verticalAlign=top;align=left;spacingLeft=30;fontColor=#AAB7B8;dashed=0;"
```

### Private Subnet
```xml
style="points=[[0,0],[0.25,0],[0.5,0],[0.75,0],[1,0],[1,0.25],[1,0.5],[1,0.75],[1,1],[0.75,1],[0.5,1],[0.25,1],[0,1],[0,0.75],[0,0.5],[0,0.25]];outlineConnect=0;gradientColor=none;html=1;whiteSpace=wrap;fontSize=10;container=1;pointerEvents=0;collapsible=0;recursiveResize=0;shape=mxgraph.aws4.group;grIcon=mxgraph.aws4.group_subnet_private;strokeColor=#147EBA;fillColor=none;verticalAlign=top;align=left;spacingLeft=30;fontColor=#AAB7B8;dashed=0;"
```

### Availability Zone
```xml
style="points=[[0,0],[0.25,0],[0.5,0],[0.75,0],[1,0],[1,0.25],[1,0.5],[1,0.75],[1,1],[0.75,1],[0.5,1],[0.25,1],[0,1],[0,0.75],[0,0.5],[0,0.25]];outlineConnect=0;gradientColor=none;html=1;whiteSpace=wrap;fontSize=11;container=1;pointerEvents=0;collapsible=0;recursiveResize=0;shape=mxgraph.aws4.group;grIcon=mxgraph.aws4.group_availability_zone;strokeColor=#545B64;fillColor=none;verticalAlign=top;align=left;spacingLeft=30;fontColor=#AAB7B8;dashed=0;"
```

### AWS Region
```xml
style="points=[[0,0],[0.25,0],[0.5,0],[0.75,0],[1,0],[1,0.25],[1,0.5],[1,0.75],[1,1],[0.75,1],[0.5,1],[0.25,1],[0,1],[0,0.75],[0,0.5],[0,0.25]];outlineConnect=0;gradientColor=none;html=1;whiteSpace=wrap;fontSize=12;fontStyle=1;container=1;pointerEvents=0;collapsible=0;recursiveResize=0;shape=mxgraph.aws4.group;grIcon=mxgraph.aws4.group_region;strokeColor=#FFC900;fillColor=none;verticalAlign=top;align=left;spacingLeft=30;fontColor=#AAB7B8;dashed=0;"
```

### Security Group
```xml
style="shape=mxgraph.aws4.group;grIcon=mxgraph.aws4.group_security_group;html=1;whiteSpace=wrap;fontSize=10;container=1;strokeColor=#FF9900;fillColor=none;dashed=1;"
```

---

## 5. エッジスタイルリファレンス

### 標準データフロー
```xml
style="edgeStyle=orthogonalEdgeStyle;html=1;rounded=1;strokeColor=#232F3E;strokeWidth=2;endArrow=classic;"
```

### 管理フロー（AWS API呼び出し）
```xml
style="edgeStyle=orthogonalEdgeStyle;html=1;rounded=1;strokeColor=#0066CC;strokeWidth=1.5;dashed=0;endArrow=classic;dashPattern=1 2;"
```

### セキュリティ境界
```xml
style="edgeStyle=orthogonalEdgeStyle;html=1;rounded=1;strokeColor=#FF0000;strokeWidth=2;dashed=1;endArrow=none;"
```

### レプリケーション・バックアップ
```xml
style="edgeStyle=orthogonalEdgeStyle;html=1;rounded=1;strokeColor=#FF9900;strokeWidth=2;dashed=0;endArrow=classic;"
```

### 非同期イベント（EventBridge、SNS）
```xml
style="edgeStyle=orthogonalEdgeStyle;html=1;rounded=1;strokeColor=#FF6B35;strokeWidth=1.5;dashed=1;endArrow=classic;dashPattern=5 5;"
```

---

## 6. 色規約

**重要: グループ背景は必ず淡い色（パステル）または透明(none)を使用すること。原色は使わない。**

### 6.1 グループ背景色（最重要）

| グループ種別 | fillColor | strokeColor | 備考 |
|------------|-----------|-------------|------|
| AWS Cloud | `none` | `#232F3E` | 背景なし、ダークグレー枠 |
| VPC | `none` | `#8C4FFF` | 背景なし、紫枠 |
| Public Subnet | `#E9F3E6` | `#7AA116` | 非常に淡い緑 |
| Private Subnet | `#EDF3F8` | `#147EBA` | 非常に淡い青 |
| Availability Zone | `none` | `#545B64` | 背景なし、グレー枠 |
| Region | `none` | `#147EBA` | 背景なし |
| Security Group | `#FDEAEA` | `#DD344C` | 非常に淡い赤 |
| Account | `none` | `#232F3E` | 背景なし |

### 6.2 リソースアイコン色（AWS公式準拠）

| カテゴリ | fillColor | 対象サービス |
|---------|-----------|------------|
| コンピュート | `#ED7100` | EC2, Lambda, ECS, EKS |
| ネットワーク | `#8C4FFF` | VPC, TGW, DX, ELB |
| データベース | `#3B48CC` | RDS, DynamoDB, Aurora |
| ストレージ | `#3F8624` | S3, EBS, EFS |
| セキュリティ | `#DD344C` | IAM, KMS, WAF, GuardDuty |
| 管理ツール | `#E7157B` | CloudWatch, CloudTrail, Config |

### 6.3 環境別アクセント色（枠線・ラベル用、背景には使わない）

| 用途 | 色コード | 用途説明 |
|------|---------|---------|
| 本番環境 | `#C62828` | 枠線・ラベルのみ |
| ステージング | `#E65100` | 枠線・ラベルのみ |
| 開発環境 | `#2E7D32` | 枠線・ラベルのみ |
| セキュリティ境界 | `#DD344C` | 破線表現 |
| データフロー | `#232F3E` | 接続線 |

---

## 7. バリデーションチェックリスト

生成したdraw.io XMLファイルは以下をチェック:

- [ ] XML 構文が正しい（`xmllint` で検証）
- [ ] id="0"、id="1" が存在する
- [ ] すべての図形に `vertex="1"` がある
- [ ] すべてのエッジに `edge="1"` がある
- [ ] コンテナ（VPC等）に `container=1` がある
- [ ] コンテナ直下の図形は `parent="コンテナID"` を指定
- [ ] すべてのテキストで `html=1, whiteSpace=wrap` が指定されている
- [ ] AWS4シェイプが正しく参照されている（`resIcon`、`grIcon` の綴り）
- [ ] x, y, width, height がすべて指定されている
- [ ] エッジの source, target が有効な id を参照している
- [ ] pageWidth="1169"、pageHeight="827" （A3横）
- [ ] 図形がページ内に収まっている
- [ ] 色コードが CSS3 形式 `#RRGGBB` である

---

## 8. 設計書への埋め込み

### Markdownでの参照

```markdown
## ネットワーク構成

![VPC Multi-AZ構成](../diagrams/NW-001-vpc-architecture.drawio.png)

**図説:**
- VPC: 10.0.0.0/16
- Public Subnet (1a): 10.0.1.0/24、ALB、NAT GW
- Private Subnet (1a): 10.0.11.0/24、EC2 アプリケーションサーバー
- Public Subnet (1c): 10.0.2.0/24、ALB、NAT GW
- Private Subnet (1c): 10.0.12.0/24、EC2 アプリケーションサーバー
```

### PNG化の手順

#### 方法1: draw.io Web UIを使用
1. https://app.diagrams.net にアクセス
2. 「ファイル > 開く」で `.drawio` ファイルを選択
3. 「ファイル > エクスポート > PNG」で出力
4. 設計書ディレクトリに保存（同名で `.drawio.png` 拡張子）

#### 方法2: draw.io CLIを使用（自動化推奨）
```bash
# インストール
npm install -g draw-io-export
# または
pip install drawio

# PNG化
draw-io -f png -o NW-001-vpc-architecture.drawio.png NW-001-vpc-architecture.drawio

# 複数ファイル一括
for f in *.drawio; do draw-io -f png -o "${f%.drawio}.png" "$f"; done
```

#### 方法3: docker を使用
```bash
docker run --rm -v $(pwd):/data needlabs/draw.io-export \
  -i /data/NW-001-vpc-architecture.drawio \
  -o /data/NW-001-vpc-architecture.drawio.png
```

### 成果物フォルダ構成

```
設計書/
├── README.md
├── NW-設計書.md
├── SEC-設計書.md
├── diagrams/
│   ├── NW-001-vpc-architecture.drawio
│   ├── NW-001-vpc-architecture.drawio.png
│   ├── NW-002-tgw-connectivity.drawio
│   ├── NW-002-tgw-connectivity.drawio.png
│   ├── SEC-001-security-posture.drawio
│   ├── SEC-001-security-posture.drawio.png
│   ├── MON-001-monitoring-flow.drawio
│   └── MON-001-monitoring-flow.drawio.png
└── ...
```

---

## 関連スキル

- @infra-network — VPC・TGW設計
- @infra-security — セキュリティ構成設計
- @infra-monitoring — 監視・ロギング設計
- @pm-review — 設計書レビュー
- @tailoring — 案件テーラリング

---

**最終更新:** 2026-04-06
**スキルバージョン:** 1.0
