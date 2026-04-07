---
description: CFn/CDK構造規約（CloudFormation/CDK構造、TypeScriptパターン）
---

# CloudFormation/CDK 構造規約（GC案件用）

## 概要

GC インフラ案件での CloudFormation (CFn) および AWS CDK (Construct Development Kit) の標準構造を定義します。

---

## CloudFormation 推奨構造

### ディレクトリ構成

```
/infra/cloudformation/
├── templates/                      # テンプレート
│   ├── networking.yaml
│   ├── compute.yaml
│   ├── database.yaml
│   ├── monitoring.yaml
│   └── security.yaml
├── parameters/                     # パラメータファイル
│   ├── dev-params.json
│   ├── staging-params.json
│   └── prod-params.json
├── nested/                         # ネストされたテンプレート
│   ├── vpc-subnet.yaml
│   ├── security-group.yaml
│   └── rds-instance.yaml
├── scripts/                        # デプロイスクリプト
│   ├── deploy.sh
│   ├── validate.sh
│   └── delete.sh
└── outputs/                        # デプロイ出力
    ├── outputs-dev.json
    ├── outputs-staging.json
    └── outputs-prod.json
```

### CloudFormation テンプレート構造

#### templates/networking.yaml

```yaml
AWSTemplateFormatVersion: '2010-09-09'

Description: 'GC Infrastructure - Networking Stack'

Metadata:
  AWS::CloudFormation::Interface:
    ParameterGroups:
      - Label:
          default: VPC Configuration
        Parameters:
          - VpcCidr
          - Environment
      - Label:
          default: Subnet Configuration
        Parameters:
          - PrivateSubnet1aCidr
          - PrivateSubnet1cCidr

Parameters:
  Environment:
    Type: String
    AllowedValues: [dev, staging, prod]
    Default: dev
    Description: Environment name

  VpcCidr:
    Type: String
    Default: 10.0.0.0/16
    Description: VPC CIDR block
    AllowedPattern: '^(\d{1,3}\.){3}\d{1,3}/\d{1,2}$'

  PrivateSubnet1aCidr:
    Type: String
    Default: 10.0.10.0/24
    Description: Private subnet in AZ 1a

  PrivateSubnet1cCidr:
    Type: String
    Default: 10.0.11.0/24
    Description: Private subnet in AZ 1c

Conditions:
  IsProduction: !Equals [!Ref Environment, prod]
  IsNotProduction: !Not [!Condition IsProduction]

Resources:
  # VPC
  VPC:
    Type: AWS::EC2::VPC
    Properties:
      CidrBlock: !Ref VpcCidr
      EnableDnsHostnames: true
      EnableDnsSupport: true
      Tags:
        - Key: Name
          Value: !Sub '${Environment}-vpc'
        - Key: Environment
          Value: !Ref Environment
        - Key: ManagedBy
          Value: cloudformation

  # Internet Gateway
  InternetGateway:
    Type: AWS::EC2::InternetGateway
    Properties:
      Tags:
        - Key: Name
          Value: !Sub '${Environment}-igw'

  AttachGateway:
    Type: AWS::EC2::VPCGatewayAttachment
    Properties:
      VpcId: !Ref VPC
      InternetGatewayId: !Ref InternetGateway

  # Private Subnets
  PrivateSubnet1a:
    Type: AWS::EC2::Subnet
    Properties:
      VpcId: !Ref VPC
      CidrBlock: !Ref PrivateSubnet1aCidr
      AvailabilityZone: ap-northeast-1a
      Tags:
        - Key: Name
          Value: !Sub '${Environment}-private-1a'

  PrivateSubnet1c:
    Type: AWS::EC2::Subnet
    Properties:
      VpcId: !Ref VPC
      CidrBlock: !Ref PrivateSubnet1cCidr
      AvailabilityZone: ap-northeast-1c
      Tags:
        - Key: Name
          Value: !Sub '${Environment}-private-1c'

  # NAT Gateway (本番のみマルチAZ)
  EIP1a:
    Type: AWS::EC2::EIP
    DependsOn: AttachGateway
    Properties:
      Domain: vpc
      Tags:
        - Key: Name
          Value: !Sub '${Environment}-eip-1a'

  NATGateway1a:
    Type: AWS::EC2::NatGateway
    Properties:
      AllocationId: !GetAtt EIP1a.AllocationId
      SubnetId: !Ref PublicSubnet1a
      Tags:
        - Key: Name
          Value: !Sub '${Environment}-nat-1a'

Outputs:
  VpcId:
    Description: VPC ID
    Value: !Ref VPC
    Export:
      Name: !Sub '${Environment}-VpcId'

  PrivateSubnet1aId:
    Description: Private Subnet 1a ID
    Value: !Ref PrivateSubnet1a
    Export:
      Name: !Sub '${Environment}-PrivateSubnet1aId'

  PrivateSubnet1cId:
    Description: Private Subnet 1c ID
    Value: !Ref PrivateSubnet1c
    Export:
      Name: !Sub '${Environment}-PrivateSubnet1cId'
```

#### nested/security-group.yaml

```yaml
AWSTemplateFormatVersion: '2010-09-09'

Description: 'Nested template for Security Groups'

Parameters:
  VpcId:
    Type: AWS::EC2::VPC::Id
    Description: VPC ID

  Environment:
    Type: String
    AllowedValues: [dev, staging, prod]

Resources:
  WebSecurityGroup:
    Type: AWS::EC2::SecurityGroup
    Properties:
      GroupDescription: 'Web tier security group'
      VpcId: !Ref VpcId
      SecurityGroupIngress:
        - IpProtocol: tcp
          FromPort: 80
          ToPort: 80
          CidrIp: 0.0.0.0/0
          Description: HTTP
        - IpProtocol: tcp
          FromPort: 443
          ToPort: 443
          CidrIp: 0.0.0.0/0
          Description: HTTPS
      SecurityGroupEgress:
        - IpProtocol: -1
          CidrIp: 0.0.0.0/0
          Description: Allow all outbound
      Tags:
        - Key: Name
          Value: !Sub '${Environment}-web-sg'

Outputs:
  WebSecurityGroupId:
    Description: Web Security Group ID
    Value: !Ref WebSecurityGroup
    Export:
      Name: !Sub '${Environment}-WebSgId'
```

### デプロイスクリプト例

#### scripts/deploy.sh

```bash
#!/bin/bash

set -euo pipefail

ENVIRONMENT=${1:-dev}
TEMPLATE=${2:-templates/networking.yaml}
PARAMS_FILE="parameters/${ENVIRONMENT}-params.json"

echo "Deploying to $ENVIRONMENT environment..."

# バリデーション
aws cloudformation validate-template \
  --template-body file://$TEMPLATE

# スタック名
STACK_NAME="gc-infra-${ENVIRONMENT}"

# デプロイ
aws cloudformation deploy \
  --template-file $TEMPLATE \
  --stack-name $STACK_NAME \
  --parameter-overrides file://$PARAMS_FILE \
  --capabilities CAPABILITY_NAMED_IAM \
  --region ap-northeast-1 \
  --no-fail-on-empty-changeset

# 出力保存
aws cloudformation describe-stacks \
  --stack-name $STACK_NAME \
  --region ap-northeast-1 \
  --query 'Stacks[0].Outputs' > outputs/outputs-${ENVIRONMENT}.json

echo "✓ Deployment complete"
```

---

## AWS CDK 推奨構造（TypeScript）

### ディレクトリ構成

```
/infra/cdk/
├── lib/                           # CDK Construct 定義
│   ├── stacks/
│   │   ├── networking-stack.ts
│   │   ├── compute-stack.ts
│   │   └── database-stack.ts
│   ├── constructs/                # 再利用可能な Construct
│   │   ├── vpc-construct.ts
│   │   ├── security-group-construct.ts
│   │   ├── rds-construct.ts
│   │   └── monitoring-construct.ts
│   ├── config/
│   │   ├── dev.ts
│   │   ├── staging.ts
│   │   └── prod.ts
│   └── app.ts                     # CDK App エントリポイント
├── bin/
│   └── cdk.ts                     # CLI エントリポイント
├── cdk.json                       # CDK 設定
├── package.json
└── tsconfig.json
```

### CDK Construct 例

#### lib/constructs/vpc-construct.ts

```typescript
import * as cdk from 'aws-cdk-lib';
import * as ec2 from 'aws-cdk-lib/aws-ec2';

export interface VpcConstructProps {
  environment: string;
  vpcCidr: string;
  maxAzs: number;
}

export class VpcConstruct extends cdk.Stack {
  public readonly vpc: ec2.Vpc;

  constructor(
    scope: cdk.App,
    id: string,
    props: VpcConstructProps
  ) {
    super(scope, id, {
      env: {
        account: process.env.CDK_DEFAULT_ACCOUNT,
        region: 'ap-northeast-1',
      },
    });

    this.vpc = new ec2.Vpc(this, 'Vpc', {
      cidr: props.vpcCidr,
      maxAzs: props.maxAzs,
      natGateways: props.environment === 'prod' ? props.maxAzs : 1,
      subnetConfiguration: [
        {
          name: 'Public',
          subnetType: ec2.SubnetType.PUBLIC,
          cidrMask: 24,
        },
        {
          name: 'Private',
          subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS,
          cidrMask: 24,
        },
        {
          name: 'Database',
          subnetType: ec2.SubnetType.PRIVATE_ISOLATED,
          cidrMask: 24,
        },
      ],
    });

    // タグ付け
    cdk.Tags.of(this).add('Environment', props.environment);
    cdk.Tags.of(this).add('ManagedBy', 'cdk');
  }
}
```

#### lib/constructs/security-group-construct.ts

```typescript
import * as cdk from 'aws-cdk-lib';
import * as ec2 from 'aws-cdk-lib/aws-ec2';

export interface SecurityGroupConstructProps {
  vpc: ec2.Vpc;
  environment: string;
}

export class WebSecurityGroupConstruct extends cdk.Stack {
  public readonly securityGroup: ec2.SecurityGroup;

  constructor(
    scope: cdk.App,
    id: string,
    props: SecurityGroupConstructProps
  ) {
    super(scope, id);

    this.securityGroup = new ec2.SecurityGroup(
      this,
      'WebSg',
      {
        vpc: props.vpc,
        description: 'Web tier security group',
        allowAllOutbound: true,
      }
    );

    // HTTP/HTTPS を許可
    this.securityGroup.addIngressRule(
      ec2.Peer.anyIpv4(),
      ec2.Port.tcp(80),
      'Allow HTTP'
    );

    this.securityGroup.addIngressRule(
      ec2.Peer.anyIpv4(),
      ec2.Port.tcp(443),
      'Allow HTTPS'
    );

    cdk.Tags.of(this.securityGroup).add('Name', `${props.environment}-web-sg`);
  }
}
```

### CDK Stack 例

#### lib/stacks/networking-stack.ts

```typescript
import * as cdk from 'aws-cdk-lib';
import { VpcConstruct } from '../constructs/vpc-construct';
import { WebSecurityGroupConstruct } from '../constructs/security-group-construct';

export interface NetworkingStackProps extends cdk.StackProps {
  environment: string;
  vpcCidr: string;
  maxAzs: number;
}

export class NetworkingStack extends cdk.Stack {
  public readonly vpc: VpcConstruct;
  public readonly webSg: WebSecurityGroupConstruct;

  constructor(
    scope: cdk.App,
    id: string,
    props: NetworkingStackProps
  ) {
    super(scope, id, {
      env: {
        account: process.env.CDK_DEFAULT_ACCOUNT,
        region: 'ap-northeast-1',
      },
      ...props,
    });

    // VPC 構築
    this.vpc = new VpcConstruct(this, 'VpcConstruct', {
      environment: props.environment,
      vpcCidr: props.vpcCidr,
      maxAzs: props.maxAzs,
    });

    // Security Group 構築
    this.webSg = new WebSecurityGroupConstruct(this, 'WebSgConstruct', {
      vpc: this.vpc.vpc,
      environment: props.environment,
    });

    // Output
    new cdk.CfnOutput(this, 'VpcId', {
      value: this.vpc.vpc.vpcId,
      exportName: `${props.environment}-VpcId`,
      description: 'VPC ID',
    });

    new cdk.CfnOutput(this, 'WebSecurityGroupId', {
      value: this.webSg.securityGroup.securityGroupId,
      exportName: `${props.environment}-WebSgId`,
      description: 'Web Security Group ID',
    });
  }
}
```

### CDK App（エントリポイント）

#### lib/app.ts

```typescript
import * as cdk from 'aws-cdk-lib';
import { NetworkingStack } from './stacks/networking-stack';
import { devConfig, stagingConfig, prodConfig } from './config';

const app = new cdk.App();

const environment = process.env.ENVIRONMENT || 'dev';

let config;
switch (environment) {
  case 'staging':
    config = stagingConfig;
    break;
  case 'prod':
    config = prodConfig;
    break;
  case 'dev':
  default:
    config = devConfig;
}

new NetworkingStack(app, `GcInfra-${environment}`, {
  environment,
  ...config,
});

app.synth();
```

#### lib/config/dev.ts

```typescript
export const devConfig = {
  vpcCidr: '10.2.0.0/16',
  maxAzs: 1,  // 開発環境は単一AZ
  environment: 'dev',
  // その他の設定...
};
```

#### lib/config/prod.ts

```typescript
export const prodConfig = {
  vpcCidr: '10.0.0.0/16',
  maxAzs: 2,  // 本番環境はマルチAZ
  environment: 'prod',
  // その他の設定...
};
```

### bin/cdk.ts

```typescript
#!/usr/bin/env node

import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { app } from '../lib/app';

// アプリケーション実行
app.synth();
```

### cdk.json

```json
{
  "app": "npx ts-node bin/cdk.ts",
  "context": {
    "@aws-cdk/core:newStyleStackSynthesis": true
  },
  "watch": {
    "include": ["lib/**"],
    "exclude": ["node_modules"]
  }
}
```

### デプロイコマンド

```bash
# スタック表示
cdk ls

# 差分確認
ENVIRONMENT=prod cdk diff

# デプロイ
ENVIRONMENT=prod cdk deploy --require-approval never

# リソース削除
ENVIRONMENT=dev cdk destroy
```

---

## CloudFormation vs CDK 比較

| 観点 | CloudFormation | CDK |
|------|----------------|-----|
| 学習曲線 | 低 | 中～高 |
| 構文 | YAML/JSON | TypeScript等 |
| 再利用性 | ネストテンプレート | Construct Lib |
| IDE サポート | 低 | 高（TypeScript） |
| テスト容易性 | 困難 | 容易（Jest対応） |
| 本番推奨 | ✓（GC実績） | ✓（最新） |

---

## ベストプラクティス

### 1. パラメータ管理

```yaml
# ✓ Good: 環境別パラメータを分離
# parameters/prod-params.json
{
  "ParameterKey": "Environment",
  "ParameterValue": "prod"
}

# ✗ Bad: テンプレート内に値をハードコード
Resources:
  Vpc:
    Properties:
      CidrBlock: 10.0.0.0/16  # テンプレートに直書き
```

### 2. Export で他のスタックに参照

```yaml
Outputs:
  VpcId:
    Value: !Ref VPC
    Export:
      Name: !Sub '${Environment}-VpcId'  # 他のスタックが参照可能
```

### 3. CDK では Context の活用

```typescript
const vpcCidr = this.node.tryGetContext('vpcCidr') || '10.0.0.0/16';
```

### 4. タグは必ず付与

```yaml
# 全リソースに共通タグ
Tags:
  - Key: Environment
    Value: !Ref Environment
  - Key: ManagedBy
    Value: cloudformation
  - Key: CostCenter
    Value: !Ref CostCenter
```
