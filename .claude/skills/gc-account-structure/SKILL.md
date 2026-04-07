---
description: GCアカウント構成パターン（単独利用/共同利用、Organizations設計、SCP設計、アカウント分離戦略）
---

# GCアカウント構成パターン

## Organizations 基本構造

### 単独利用パターン
```
Organization (Root)
├── Organization Policy（SCP, AI Policy等）
└── Folder (by Function)
    ├── Network Folder
    ├── Shared Services Folder
    └── Applications Folder
        ├── Project-A
        ├── Project-B
        └── Project-C
```
**用途**: 1社 1 Org による単一テナント運用
**メリット**: シンプル、アカウント管理コスト低
**デメリット**: 複数部門間の請求分離が困難

### 共同利用パターン
```
Organization (Root)
├── Org Policy（SCP, AI Policy）
├── Folder (by Department)
│   ├── Department-A Folder
│   │   ├── Project-A1
│   │   └── Project-A2
│   └── Department-B Folder
│       ├── Project-B1
│       └── Project-B2
└── Shared Services Folder
    ├── Logging Project
    ├── Network Project
    └── Security Project
```
**用途**: 複数部門が共有Organizations内で独立運用
**メリット**: 請求・ロール管理の集約化、ネットワーク効率化
**デメリット**: 部門間の分離境界設定が複雑

## SCP（Service Control Policy）設計パターン

### 許可リスト型（Deny All → Whitelist）
```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "DenyAllByDefault",
      "Effect": "Deny",
      "Action": "*",
      "Resource": "*"
    },
    {
      "Sid": "AllowEC2",
      "Effect": "Allow",
      "Action": "ec2:*",
      "Resource": "*"
    },
    {
      "Sid": "AllowRDS",
      "Effect": "Allow",
      "Action": "rds:*",
      "Resource": "*"
    }
  ]
}
```
**適用**: 厳格なセキュリティが要求される環境（金融、医療）
**効果**: セキュリティ重視、運用手順増加

### 拒否リスト型（Allow All → Deny Specific）
```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "DenyHighRisk",
      "Effect": "Deny",
      "Action": [
        "iam:AttachUserPolicy",
        "iam:DeleteRole",
        "iam:PutUserPolicy",
        "ec2:TerminateInstances",
        "rds:DeleteDBInstance"
      ],
      "Resource": "*"
    }
  ]
}
```
**適用**: 標準的な企業環境
**効果**: 運用効率性重視、セキュリティは最低限

### 混合型（許可 + 拒否併用）
```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "AllowWithinOrgUnit",
      "Effect": "Allow",
      "Action": "*",
      "Resource": "*",
      "Condition": {
        "StringEquals": {
          "organizations:ParentOrgUnitId": "ou-xxxx"
        }
      }
    },
    {
      "Sid": "DenyDangerousActions",
      "Effect": "Deny",
      "Action": [
        "organizations:LeaveOrganization",
        "account:CloseAccount"
      ],
      "Resource": "*"
    }
  ]
}
```
**適用**: 機能ベースのアクセス制御
**効果**: バランス型

## アカウント分離戦略

| 分離軸 | 単独利用 | 共同利用 | 備考 |
|------|--------|--------|------|
| **部門別** | Folderで分離 | Folderで分離 | 請求分離の有無で設計分岐 |
| **環境別** | Folderで分離（dev/stg/prod） | Folderで分離 | リソースポリシーで運用環境は強化 |
| **セキュリティ境界** | Folder + VPC で分離 | Folder + VPC + Organizations Policy | 金融/医療は個別Organizations推奨 |
| **プロジェクト別** | Project内で論理分離 | Folder + Project で分離 | 請求トレーサビリティが必須な場合は独立 Project |

## Organizations Policies（SCP以外）

### AI Policy（LLM/生成AI制御）
```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "RestrictBedrockModelAccess",
      "Effect": "Deny",
      "Action": [
        "bedrock:InvokeModel",
        "bedrock-runtime:InvokeModel"
      ],
      "Resource": [
        "arn:aws:bedrock:*:*:foundation-model/anthropic.claude-*"
      ],
      "Condition": {
        "StringNotEquals": {
          "organizations:ParentOrgUnitId": "ou-approved"
        }
      }
    }
  ]
}
```

### Backup Policy（バックアップ要件の強制）
```json
{
  "Statement": [
    {
      "Sid": "EnableBackupPlans",
      "Effect": "Allow",
      "Action": [
        "backup:CreateBackupPlan",
        "backup:StartBackupJob"
      ],
      "Resource": "*"
    }
  ]
}
```

## アカウント命名規則

```
{env}-{dept}-{purpose}-{region}

例:
- prod-finance-main-ap-northeast-1
- dev-engineering-app-ap-northeast-1
- shared-logging-central-ap-northeast-1
```

## タグ戦略

**必須タグ（全リソース）**:
- `environment`: dev / staging / prod
- `owner`: 責任者メールアドレス
- `cost-center`: 部門コード
- `project`: プロジェクト名

**推奨タグ**:
- `backup-policy`: daily / weekly / monthly / none
- `disaster-recovery`: tier1 / tier2 / tier3
- `compliance`: ismap / iso27001 / pci / none
- `data-classification`: public / internal / confidential / restricted

## Organizations 階層の深さガイドライン

| OU深さ | 想定規模 | 管理複雑度 |
|-------|--------|---------|
| 1段（Root直下） | 部門<5、Project<20 | 低 |
| 2段（Root→Dept→Project） | 部門<20、Project<100 | 中 |
| 3段（Root→Area→Dept→Project） | 部門>20、Project>100 | 高 |

**推奨**: 2段までに留める。3段以上は Organizations Policy管理が複雑になり保守性低下

## GCAS（Google Cloud Assured Secure Services）申請とOrganizations設計の関連

- GCAS申請時に「Organizations構成」の提示が必須
- 金融機関向けGCASは「専用Organizations」を推奨
- GCAS Organizations内のSCPは「GC推奨設定」に準拠必須

## チェックリスト

- [ ] Organizations構成図が図示されている
- [ ] 各Folderの責任者が明記されている
- [ ] SCPポリシーの具体的な内容（JSON）がある
- [ ] タグ戦略がリソース群別に分類されている
- [ ] 部門別/プロジェクト別の請求分離方法が明記されている
- [ ] OU名命名規則がドキュメント化されている
