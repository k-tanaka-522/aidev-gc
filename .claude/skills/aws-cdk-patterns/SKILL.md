---
description: CDKベストプラクティス（Construct設計、Stack分割、パラメーター管理、cdk-nag統合）
---

# AWS CDK ベストプラクティス

## Construct 設計レベル

### L1 Construct（低レベル）
AWS CloudFormation をラップした最小単位

```typescript
import * as ec2 from 'aws-cdk-lib/aws-ec2';

// L1 Construct: AWS::EC2::SecurityGroup
const cfnSg = new ec2.CfnSecurityGroup(this, 'RawSecurityGroup', {
  groupDescription: 'Low-level SG',
  vpcId: vpcId,
});

cfnSg.addEgressRule('0.0.0.0/0', 'tcp', { startPort: 443, endPort: 443 });
```

**用途**: 新しい AWS リソースで L2/L3 がまだない場合

### L2 Construct（中レベル）
高度な抽象化と便利メソッド

```typescript
import * as ec2 from 'aws-cdk-lib/aws-ec2';

// L2 Construct: SecurityGroup
const sg = new ec2.SecurityGroup(this, 'ManagedSecurityGroup', {
  vpc,
  description: 'High-level SG with sensible defaults',
  allowAllOutbound: false,
});

sg.addIngressRule(ec2.Peer.anyIpv4(), ec2.Port.tcp(443));
sg.addEgressRule(ec2.Peer.anyIpv4(), ec2.Port.tcp(443));
```

**特徴**: デフォルト値、バリデーション、ライフサイクルメソッド

### L3 Construct（高レベル）
パターン化された複合リソース（Awesomeな構成）

```typescript
import { ApplicationLoadBalancedFargateService } from 'aws-cdk-lib/aws-ecs-patterns';

// L3: ECS + ALB + ロードバランシングをワンセット
const fargateService = new ApplicationLoadBalancedFargateService(
  this,
  'FargateService',
  {
    cluster,
    desiredCount: 3,
    taskImageOptions: {
      image: ecs.ContainerImage.fromRegistry('my-image'),
      containerPort: 8080,
    },
    publicLoadBalancer: true,
  },
);
```

### カスタム Construct 設計

```typescript
// lib/constructs/WebTierStack.ts
import { Construct } from 'constructs';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as ecs from 'aws-cdk-lib/aws-ecs';

interface WebTierProps {
  vpc: ec2.Vpc;
  desiredCount: number;
  environment: string;
}

export class WebTier extends Construct {
  public readonly service: ecs.FargateService;
  public readonly loadBalancer: elbv2.ApplicationLoadBalancer;

  constructor(scope: Construct, id: string, props: WebTierProps) {
    super(scope, id);

    // このカスタム Construct は複数の L2/L3 を組み合わせ
    // - ECS Cluster
    // - ALB
    // - Target Group
    // をまとめて提供

    const cluster = new ecs.Cluster(this, 'Cluster', {
      vpc: props.vpc,
      clusterName: `${props.environment}-web-cluster`,
    });

    this.service = new ecs.FargateService(this, 'Service', {
      cluster,
      desiredCount: props.desiredCount,
      // ...
    });

    this.loadBalancer = new elbv2.ApplicationLoadBalancer(this, 'ALB', {
      vpc: props.vpc,
      internetFacing: true,
    });
  }
}
```

## Stack 分割戦略

### パターン1: 機能単位の分割

```
lib/
├── stacks/
│   ├── foundation-stack.ts        # VPC, ネットワーク
│   ├── security-stack.ts          # IAM, KMS, Secrets
│   ├── database-stack.ts          # RDS, DynamoDB
│   ├── compute-stack.ts           # ECS, Lambda, EC2
│   ├── storage-stack.ts           # S3, EFS
│   └── monitoring-stack.ts        # CloudWatch, ALarms
├── constructs/
│   ├── web-tier.ts
│   ├── app-tier.ts
│   └── data-tier.ts
└── index.ts                       # Stack統合
```

#### bin/app.ts

```typescript
import * as cdk from 'aws-cdk-lib';
import { FoundationStack } from '../lib/stacks/foundation-stack';
import { SecurityStack } from '../lib/stacks/security-stack';
import { DatabaseStack } from '../lib/stacks/database-stack';
import { ComputeStack } from '../lib/stacks/compute-stack';

const app = new cdk.App();

const env = {
  account: process.env.CDK_DEFAULT_ACCOUNT,
  region: process.env.CDK_DEFAULT_REGION,
};

// Stack作成（依存関係順）
const foundationStack = new FoundationStack(app, 'FoundationStack', { env });
const securityStack = new SecurityStack(app, 'SecurityStack', { env });

const databaseStack = new DatabaseStack(app, 'DatabaseStack', {
  env,
  vpc: foundationStack.vpc,  // 依存性注入
  sg: securityStack.databaseSg,
});

const computeStack = new ComputeStack(app, 'ComputeStack', {
  env,
  vpc: foundationStack.vpc,
  dbSecurityGroup: securityStack.databaseSg,
});

// Stack間の依存性明記
computeStack.addDependency(databaseStack);
```

### パターン2: 環境別 Stack（推奨）

```
lib/
└── stacks/
    ├── dev-stack.ts
    ├── stg-stack.ts
    ├── prod-stack.ts
    └── shared-stack.ts

bin/
├── dev.ts
├── stg.ts
├── prod.ts
└── shared.ts
```

#### lib/stacks/dev-stack.ts

```typescript
import * as cdk from 'aws-cdk-lib';

export class DevStack extends cdk.Stack {
  constructor(scope: cdk.App, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const environment = 'dev';

    // 開発環境特有の設定
    const vpc = new ec2.Vpc(this, 'VPC', {
      cidr: '10.0.0.0/16',
      maxAzs: 2,
      // 開発: NAT Gateway は1AZのみ（コスト削減）
    });

    const clusterCapacity = 1;  // 開発: 1インスタンス
    const dbInstance = 'db.t3.micro';  // 開発: 最小スペック

    // Construct 作成
    const webTier = new WebTier(this, 'WebTier', {
      vpc,
      desiredCount: clusterCapacity,
      environment,
    });

    // ...
  }
}
```

#### lib/stacks/prod-stack.ts

```typescript
export class ProdStack extends cdk.Stack {
  constructor(scope: cdk.App, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const environment = 'prod';

    // 本番環境特有の設定
    const vpc = new ec2.Vpc(this, 'VPC', {
      cidr: '10.2.0.0/16',
      maxAzs: 3,  // 本番: 3AZ冗長化
      natGateways: 3,
    });

    const clusterCapacity = 5;  // 本番: 5インスタンス
    const dbInstance = 'db.r6g.xlarge';  // 本番: 高スペック

    // ...
  }
}
```

## パラメーター管理

### パターン1: config.json ファイル

```json
// config.dev.json
{
  "environment": "dev",
  "vpc": {
    "cidr": "10.0.0.0/16",
    "maxAzs": 2
  },
  "ecs": {
    "desiredCount": 1,
    "taskMemory": 512,
    "taskCpu": 256
  },
  "rds": {
    "instanceClass": "db.t3.micro",
    "allocatedStorage": 20,
    "backupRetentionDays": 0
  }
}

// config.prod.json
{
  "environment": "prod",
  "vpc": {
    "cidr": "10.2.0.0/16",
    "maxAzs": 3
  },
  "ecs": {
    "desiredCount": 5,
    "taskMemory": 2048,
    "taskCpu": 1024
  },
  "rds": {
    "instanceClass": "db.r6g.xlarge",
    "allocatedStorage": 500,
    "backupRetentionDays": 30
  }
}
```

#### Stack で config 読み込み

```typescript
import * as fs from 'fs';

export class ConfigurableStack extends cdk.Stack {
  constructor(
    scope: cdk.App,
    id: string,
    environment: string,
    props?: cdk.StackProps,
  ) {
    super(scope, id, props);

    const config = JSON.parse(
      fs.readFileSync(`./config.${environment}.json`, 'utf-8'),
    );

    const vpc = new ec2.Vpc(this, 'VPC', {
      cidr: config.vpc.cidr,
      maxAzs: config.vpc.maxAzs,
    });

    const service = new ecs.FargateService(this, 'Service', {
      desiredCount: config.ecs.desiredCount,
      taskDefinition: new ecs.TaskDefinition(this, 'TaskDef', {
        memoryMiB: config.ecs.taskMemory,
        cpu: config.ecs.taskCpu.toString(),
      }),
    });
  }
}
```

### パターン2: CDK Context（推奨）

```typescript
// bin/app.ts
const app = new cdk.App();

const environment = app.node.tryGetContext('environment') || 'dev';
const config = app.node.tryGetContext(environment);

new MyStack(app, 'MyStack', {
  config,
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: process.env.CDK_DEFAULT_REGION,
  },
});
```

実行時に context を渡す:
```bash
cdk deploy -c environment=prod
```

cdk.json で事前設定:
```json
{
  "context": {
    "dev": {
      "vpc_cidr": "10.0.0.0/16",
      "cluster_size": 1
    },
    "prod": {
      "vpc_cidr": "10.2.0.0/16",
      "cluster_size": 5
    }
  }
}
```

## cdk-nag セキュリティスキャン統合

### インストール・設定

```bash
npm install cdk-nag
```

#### lib/cdk-nag-stack.ts

```typescript
import { Annotations, Match } from 'aws-cdk-lib/assertions';
import { AwsSolutionsChecks, NagSuppressions } from 'cdk-nag';
import * as cdk from 'aws-cdk-lib';

export class CdkNagStack extends cdk.Stack {
  constructor(scope: cdk.App, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // cdk-nag ルール適用
    cdk.Aspects.of(this).add(new AwsSolutionsChecks({ verbose: true }));

    // リソース作成
    const bucket = new s3.Bucket(this, 'Bucket', {
      publicReadAccess: false,  // 推奨設定
      encryption: s3.BucketEncryption.KMS,  // 暗号化
      versioned: true,
    });

    // 特定のルールを無視（例外指定）
    NagSuppressions.addResourceSuppressions(bucket, [
      {
        id: 'AwsSolutions-S1',
        reason: 'ログバケットなので特別許可',
      },
    ]);
  }
}
```

### cdk-nag チェック例

```typescript
// CDK Synthesize 時に自動スキャン
// cdk synth → cdk-nag ルール実行

// 出力例:
// [WARN] AwsSolutions-S1: S3 Bucket must have server-access logs enabled
// [WARN] AwsSolutions-IAM4: IAM policies should not allow * resource
```

### cdk.json で cdk-nag ルール設定

```json
{
  "context": {
    "@aws-cdk/core:newStyleStackSynthesis": true,
    "cdk-nag": {
      "rules": [
        {
          "id": "AwsSolutions-S1",
          "applies": "error"
        },
        {
          "id": "AwsSolutions-IAM1",
          "applies": "warning"
        }
      ]
    }
  }
}
```

## CDK テスト戦略

### アサーション テスト

```typescript
import { Template } from 'aws-cdk-lib/assertions';
import * as cdk from 'aws-cdk-lib';

describe('WebTierStack', () => {
  let stack: cdk.Stack;

  beforeEach(() => {
    const app = new cdk.App();
    stack = new WebTierStack(app, 'TestStack');
  });

  test('ECS Cluster created', () => {
    const template = Template.fromStack(stack);
    template.hasResourceProperties('AWS::ECS::Cluster', {
      ClusterName: Match.stringLike('*-cluster'),
    });
  });

  test('ALB created with HTTPS', () => {
    const template = Template.fromStack(stack);
    template.hasResourceProperties(
      'AWS::ElasticLoadBalancingV2::LoadBalancer',
      {
        Scheme: 'internet-facing',
      },
    );
  });

  test('Security Group has proper ingress rules', () => {
    const template = Template.fromStack(stack);
    template.hasResourceProperties(
      'AWS::EC2::SecurityGroup',
      Match.objectLike({
        SecurityGroupIngress: Match.arrayWith([
          Match.objectLike({
            IpProtocol: 'tcp',
            FromPort: 443,
          }),
        ]),
      }),
    );
  });
});
```

実行:
```bash
npm test
```

## CDK ベストプラクティス チェックリスト

- [ ] L1/L2/L3 Construct の使い分けが明確
- [ ] カスタム Construct が単一責任の原則に従う
- [ ] Stack が機能単位で分割
- [ ] パラメーター管理が config.json or CDK Context
- [ ] 環境別設定（dev/stg/prod）が外部ファイルで管理
- [ ] cdk-nag セキュリティスキャンが CI に統合
- [ ] Unit Test が高カバレッジ（>80%）
- [ ] Stack 間の依存関係が明記（addDependency）
- [ ] Output が必要に応じて外部参照可能（Export）
- [ ] cdk destroy での自動削除ポリシーが設定（RemovalPolicy）
