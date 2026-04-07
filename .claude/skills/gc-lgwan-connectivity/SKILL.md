---
description: LGWAN/DirectConnect接続パターン（LGCS経由、DC経由、冗長構成、帯域設計、回線調達プロセス）
---

# LGWAN/DirectConnect 接続パターン

## LGWAN（行政専用ネットワーク）接続パターン

### パターン1: LGCS経由接続（推奨）

```
オンプレミス
  ↓
LGWAN
  ↓
LGCS（LGWAN Cloud Service）
  ↓
VPC Endpoint（S3/DynamoDB等）
  ↓
GC Applications
```

**特徴**:
- GC内のパブリックサービス（S3, DynamoDB等）に直接接続可能
- オンプレミス内のシステム（社内API等）には接続不可
- オンプレミス ↔ GC間の専用経路で間接接続

**帯域**: 100Mbps ～ 10Gbps（業者選択に依存）

### パターン2: LGCS + Site-to-Site VPN（ハイブリッド）

```
オンプレミス
  ├─ LGWAN → LGCS → GC Services
  └─ Internet VPN → Site-to-Site VPN → VPC
```

**特徴**:
- LGWAN側: GCパブリックサービスのみ
- VPN側: オンプレミス ↔ VPC (Private) の双方向通信
- 冗長性向上

### パターン3: Site-to-Site VPN のみ

```
オンプレミス
  ↓
Internet
  ↓
Site-to-Site VPN Gateway
  ↓
VPC
```

**用途**: LGWAN 契約がない環境
**セキュリティ**: Internet経由で暗号化通信

## DirectConnect（専用線）接続パターン

### パターン1: DirectConnect Single Connection

```
オンプレミス
  ↓ （キャリア回線例：NTT, KDDI等）
DirectConnect Location (東京、大阪等)
  ↓
GC DirectConnect Virtual Interface (VIF)
  ↓
VPC / Public Services
```

**帯域**: 1Gbps, 10Gbps, 100Gbps（ロケーション依存）
**遅延**: <1ms (WAN遅延なし)
**コスト**: 月額 ¥約30万～100万（帯域に依存）

### パターン2: DirectConnect Redundant（推奨）

```
オンプレミス (複数地点)
  ├─ DirectConnect-A (1Gbps)
  │   └─ Location-Tokyo
  └─ DirectConnect-B (1Gbps)
      └─ Location-Osaka
         ↓
      Virtual Private Gateway (VGW)
         ↓
      VPC
```

**利点**:
- 帯域: 2Gbps合計
- 単一回線障害時でも 1Gbps で疎通
- BGP自動フェイルオーバー

### パターン3: DirectConnect + Site-to-Site VPN（最高可用性）

```
オンプレミス
  ├─ DirectConnect (Primary Path)
  │   └─ 1Gbps, <1ms
  └─ Site-to-Site VPN (Backup Path)
      └─ Internet経由, フェイルオーバー用
```

**フェイルオーバー**:
- 通常: DirectConnect優先 (低遅延)
- DirectConnect障害: VPN へ自動フェイルオーバー

## 帯域設計ガイドライン

### トラフィック予測

```
ピークアワー時の想定トラフィック =
  [ 平常時トラフィック × ピーク倍率 ] + [ バックアップトラフィック ]

例:
  平常時: 100Mbps
  ピーク倍率: 3倍（昼間）
  バックアップ: 200Mbps/日（夜間）

  必要帯域 = (100 × 3) + 200 = 500Mbps
  → DirectConnect 1Gbps を推奨（余裕係数: 2倍）
```

### 回線選択マトリックス

| 想定トラフィック | 推奨回線 | 料金感 | 備考 |
|-------------|--------|-------|------|
| ～ 50Mbps | Site-to-Site VPN | 低 | Internet接続で十分 |
| 50～500Mbps | LGCS or DirectConnect 1Gbps | 中 | LGWAN対応なら LGCS推奨 |
| 500Mbps～2Gbps | DirectConnect 1Gbps ×2 (冗長) | 高 | 高可用性要求 |
| 2Gbps以上 | DirectConnect 10Gbps ×2+ | 非常に高 | 大規模エンタープライズ |

## 回線調達プロセス

### Phase 1: ベンダー選定（2～4週間）

| ベンダー | LGWAN対応 | DirectConnect | 備考 |
|--------|---------|-------------|------|
| **NTT東/西** | Yes | Yes | 国内主流、安定性高 |
| **KDDI** | Yes | Yes | 全国対応 |
| **Softbank** | Yes | Yes | 全国対応 |
| **クラウテル** | Yes | Yes | 専門業者 |

**選定ステップ**:
1. RFQ（Request for Quote）作成
2. 各ベンダーから見積取得
3. SLA（稼働率保証等）確認
4. ベンダー選定

### Phase 2: 申込・工事（6～12週間）

```
Week 1-2:
  └─ 施工予定日調整

Week 3-8:
  └─ キャリア側で回線手配（構内配線工事等）

Week 9-10:
  └─ GC側での VIF 設定

Week 11-12:
  └─ テスト、本番化
```

### Phase 3: テスト（2～4週間）

```
テスト項目:
  1. 疎通確認（ping疎通確認）
  2. スループット測定（帯域確認）
  3. 遅延測定（< 期待値か）
  4. MTU サイズ確認 (1500 vs Jumbo Frame 9000)
  5. BGP 経路収束テスト
  6. フェイルオーバー動作確認
```

## DirectConnect Virtual Interface (VIF) 設計

### Private VIF（VPC向け）

```
VIF設定:
  - VLAN: 1000 (例)
  - Primary BGP IP: 169.254.10.1/30 (GC)
  - Secondary BGP IP: 169.254.10.5/30 (GC)
  - Customer BGP IP: 169.254.10.2/30 (On-Premise)
  - BGP ASN: 64512 (Private range)
  - Virtual Private Gateway: vgw-xxxxx
  - Direct Connect Gateway: dcgw-xxxxx (複数VPC向けの場合)

接続先:
  - VPC CIDR: 10.0.0.0/16
  - オンプレ CIDR: 192.168.0.0/16
```

### Public VIF（GC Services向け）

```
VIF設定:
  - VLAN: 1001 (例)
  - Primary BGP IP: 52.1.2.3/30 (GC Public)
  - Customer BGP IP: 52.1.2.4/30
  - BGP ASN: 64512

接続先:
  - S3, DynamoDB等のGCサービス
  - 認証: AWS Signature v4
```

## 冗長構成チェックリスト

- [ ] Primary + Backup 回線が物理的に異なるルート（ベンダーが異なる or 異なるキャリア）
- [ ] VIF が複数VPC向け（Direct Connect Gateway）に対応可能
- [ ] BGP設定で Primary VIF への優先度付け（AS Path制御）
- [ ] 単一回線障害時の帯域低下が許容範囲（75%推奨）
- [ ] フェイルオーバー時間が目標RTO 内（通常: <5分）
- [ ] BGP Keepalive / Hold Time が適切（通常: 10秒/30秒）
- [ ] MTU サイズが物理層〜アプリケーション層で統一（1500 or 9000）
- [ ] 回線障害時の連絡体制（ベンダー SLA、エスカレーション）が明記

## LGWAN vs DirectConnect 比較表

| 項目 | LGWAN (LGCS経由) | DirectConnect |
|-----|-------------|-------------|
| **接続先** | GC公開サービスのみ | VPC + 公開サービス |
| **帯域** | 100M～10G | 1G, 10G, 100G |
| **遅延** | 数～10ms | <1ms |
| **月額コスト** | ¥10万～50万 | ¥30万～150万 |
| **工期** | 6～8週間 | 8～12週間 |
| **冗長構成** | 別LGCS回線 | DirectConnect ×2 |
| **セキュリティ** | 行政ネットワーク標準 | トランスポート暗号化なし（注） |
| **オンプレ ↔ VPC通信** | 不可 | 可能 |

**注**: DirectConnect のセキュリティは物理層隔離に依存。通信内容は VPN等で別途暗号化が推奨。

## チェックリスト

- [ ] LGWAN/DirectConnect 選択理由が明記
- [ ] 帯域計算根拠（トラフィック予測）がある
- [ ] ベンダー選定基準が明確
- [ ] 工期見積（何週間）がある
- [ ] VIF 設計（BGP AS番号、VLAN ID等）が明記
- [ ] 冗長化方針（Single or Redundant）が決定
- [ ] テスト項目チェックリスト完備
- [ ] 回線障害時の対応体制（24/7 SLA等）が明記
