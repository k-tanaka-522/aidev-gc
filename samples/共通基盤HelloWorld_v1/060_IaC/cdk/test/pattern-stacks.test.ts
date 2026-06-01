/**
 * test/pattern-stacks.test.ts
 * PatternA(Lambda) / PatternB(Batch) / PatternC(SQS+Fargate) の Unit Test
 *
 * 作成: infra-iac
 * 作成日: 2026-06-01
 *
 * 実行方法: npm test
 * フレームワーク: Jest + aws-cdk-lib/assertions
 *
 * カバレッジ対象:
 *   - Pattern A: Lambda関数・SQS DLQ・S3出力バケット・EventBridgeスケジュール・アラーム4本
 *   - Pattern B: Batch CE・ジョブキュー・ジョブ定義・EventBridgeスケジュール・アラーム2本
 *   - Pattern C: SQSキュー・Fargate Worker・Auto Scaling・アラーム5本
 *   - 全パターン: CMK暗号化・Permission Boundary・タグ7キー
 *
 * 対応 PARAM: PARAM-005（A）/ PARAM-006（B）/ PARAM-007（C）
 */

import * as cdk from 'aws-cdk-lib';
import { Template, Match } from 'aws-cdk-lib/assertions';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as ecs from 'aws-cdk-lib/aws-ecs';
import { SecurityStack } from '../lib/stacks/security-stack';
import { NetworkStack } from '../lib/stacks/network-stack';
import { OnlineStack } from '../lib/stacks/online-stack';
import { PatternALambdaStack } from '../lib/stacks/pattern-a-lambda-stack';
import { PatternBBatchStack } from '../lib/stacks/pattern-b-batch-stack';
import { PatternCSqsFargateStack } from '../lib/stacks/pattern-c-sqs-fargate-stack';
import { EnvConfig, Environment } from '../lib/common/config';

// ---------------------------------------------------------------------------
// テスト用スタブ設定
// ---------------------------------------------------------------------------
const TEST_ENV: Environment = 'dev';
const TEST_CONFIG: EnvConfig = {
  accountId: '123456789012',
  region: 'ap-northeast-1',
  tenantId: 'A',
  vpcCidr: '10.20.0.0/16',
  natGateways: 1,
  flowLogsRetentionDays: 90,
  logsRetentionDays: 90,
  ecsDesiredCount: 1,
  ecsCpu: 256,
  ecsMemory: 512,
  albDeletionProtection: false,
  wafMode: 'count',
  tgwAttach: false,
  enableAutoScaling: false,
};

const PROD_CONFIG: EnvConfig = {
  ...TEST_CONFIG,
  enableAutoScaling: true,
  albDeletionProtection: true,
  wafMode: 'block',
  natGateways: 2,
};

const CDK_ENV: cdk.Environment = {
  account: TEST_CONFIG.accountId,
  region: TEST_CONFIG.region,
};

/** ダミー ARN を生成するユーティリティ */
const dummyArn = (svc: string, resource: string) =>
  `arn:aws:${svc}:ap-northeast-1:123456789012:${resource}`;

/** 依存スタックを含む全スタックを構築して返す */
function buildAllStacks(config: EnvConfig = TEST_CONFIG, env: Environment = TEST_ENV) {
  const app = new cdk.App();

  const securityStack = new SecurityStack(app, 'TestSecurityStack', {
    env: CDK_ENV,
    environment: env,
    config,
  });

  const networkStack = new NetworkStack(app, 'TestNetworkStack', {
    env: CDK_ENV,
    environment: env,
    config,
    appCommonCmkArn: securityStack.appCommonCmkArn,
  });

  const onlineStack = new OnlineStack(app, 'TestOnlineStack', {
    env: CDK_ENV,
    environment: env,
    config,
    vpc: networkStack.vpc,
    publicSubnetIds: networkStack.publicSubnetIds,
    privateAppSubnetIds: networkStack.privateAppSubnetIds,
    sgPublicAlb: networkStack.sgPublicAlb,
    sgInternalAlb: networkStack.sgInternalAlb,
    sgFargateApp: networkStack.sgFargateApp,
    appCommonCmkArn: securityStack.appCommonCmkArn,
  });

  const patternA = new PatternALambdaStack(app, 'TestPatternAStack', {
    env: CDK_ENV,
    environment: env,
    config,
    vpc: networkStack.vpc,
    privateBatchSubnetIds: networkStack.privateBatchSubnetIds,
    sgBatchA: networkStack.sgBatchA,
    tenantDataCmkArn: securityStack.tenantDataCmkArn,
    appCommonCmkArn: securityStack.appCommonCmkArn,
    appAlertsSnsArn: dummyArn('sns', 'helloworld-app-alerts'),
  });

  const patternB = new PatternBBatchStack(app, 'TestPatternBStack', {
    env: CDK_ENV,
    environment: env,
    config,
    vpc: networkStack.vpc,
    privateBatchSubnetIds: networkStack.privateBatchSubnetIds,
    sgBatchB: networkStack.sgBatchB,
    tenantDataCmkArn: securityStack.tenantDataCmkArn,
    appCommonCmkArn: securityStack.appCommonCmkArn,
    appAlertsSnsArn: dummyArn('sns', 'helloworld-app-alerts'),
  });

  const patternC = new PatternCSqsFargateStack(app, 'TestPatternCStack', {
    env: CDK_ENV,
    environment: env,
    config,
    vpc: networkStack.vpc,
    privateBatchSubnetIds: networkStack.privateBatchSubnetIds,
    sgBatchC: networkStack.sgBatchC,
    ecsCluster: onlineStack.ecsCluster,
    tenantDataCmkArn: securityStack.tenantDataCmkArn,
    appCommonCmkArn: securityStack.appCommonCmkArn,
    appAlertsSnsArn: dummyArn('sns', 'helloworld-app-alerts'),
  });

  return {
    app, securityStack, networkStack, onlineStack,
    patternA, patternB, patternC,
    templateA: Template.fromStack(patternA),
    templateB: Template.fromStack(patternB),
    templateC: Template.fromStack(patternC),
  };
}

// ===========================================================================
// Pattern A: Lambda + EventBridge Schedule テスト（PARAM-005）
// ===========================================================================
describe('PatternALambdaStack - Lambda', () => {
  let templateA: Template;

  beforeAll(() => {
    ({ templateA } = buildAllStacks());
  });

  test('Lambda 関数が 1 つ作成される', () => {
    templateA.resourceCountIs('AWS::Lambda::Function', 1);
  });

  test('Lambda ランタイムが Java21（PARAM-005 §2）', () => {
    templateA.hasResourceProperties('AWS::Lambda::Function', {
      Runtime: 'java21',
    });
  });

  test('Lambda が VPC 内に配置される', () => {
    templateA.hasResourceProperties('AWS::Lambda::Function', {
      VpcConfig: Match.objectLike({
        SubnetIds: Match.anyValue(),
        SecurityGroupIds: Match.anyValue(),
      }),
    });
  });

  test('dev 環境の Lambda ReservedConcurrentExecutions が 5（PARAM-005 §3）', () => {
    templateA.hasResourceProperties('AWS::Lambda::Function', {
      ReservedConcurrentExecutions: 5,
    });
  });

  test('Lambda 実行ロールに permissionsBoundary が適用される（PARAM-003 §3）', () => {
    templateA.hasResourceProperties('AWS::IAM::Role', {
      PermissionsBoundary: Match.anyValue(),
    });
  });
});

describe('PatternALambdaStack - SQS DLQ', () => {
  let templateA: Template;

  beforeAll(() => {
    ({ templateA } = buildAllStacks());
  });

  test('SQS DLQ が CMK 暗号化で作成される（PARAM-005 §4）', () => {
    templateA.hasResourceProperties('AWS::SQS::Queue', {
      KmsMasterKeyId: Match.anyValue(),
    });
  });
});

describe('PatternALambdaStack - S3 出力バケット', () => {
  let templateA: Template;

  beforeAll(() => {
    ({ templateA } = buildAllStacks());
  });

  test('S3 出力バケットが SSE-KMS で作成される（PARAM-005 §4）', () => {
    templateA.hasResourceProperties('AWS::S3::Bucket', {
      BucketEncryption: Match.objectLike({
        ServerSideEncryptionConfiguration: Match.arrayWith([
          Match.objectLike({
            ServerSideEncryptionByDefault: Match.objectLike({
              SSEAlgorithm: 'aws:kms',
            }),
          }),
        ]),
      }),
    });
  });

  test('S3 バケットにライフサイクルルールが設定されている', () => {
    templateA.hasResourceProperties('AWS::S3::Bucket', {
      LifecycleConfiguration: Match.objectLike({
        Rules: Match.arrayWith([
          Match.objectLike({ Status: 'Enabled' }),
        ]),
      }),
    });
  });
});

describe('PatternALambdaStack - EventBridge Schedule', () => {
  let templateA: Template;

  beforeAll(() => {
    ({ templateA } = buildAllStacks());
  });

  test('EventBridge ルールが作成される', () => {
    templateA.resourceCountIs('AWS::Events::Rule', 1);
  });

  test('dev 環境では EventBridge が DISABLED（PARAM-005 §5）', () => {
    templateA.hasResourceProperties('AWS::Events::Rule', {
      State: 'DISABLED',
    });
  });
});

describe('PatternALambdaStack - CloudWatch Alarms', () => {
  let templateA: Template;

  beforeAll(() => {
    ({ templateA } = buildAllStacks());
  });

  test('Lambda アラームが 4 本作成される（PARAM-005 §6）', () => {
    templateA.resourceCountIs('AWS::CloudWatch::Alarm', 4);
  });

  test('Lambda エラーアラームが存在する', () => {
    templateA.hasResourceProperties('AWS::CloudWatch::Alarm', {
      MetricName: 'Errors',
      Namespace: 'AWS/Lambda',
      Threshold: 3,
    });
  });

  test('DLQ 深度アラームが存在する（PARAM-005 §6.1）', () => {
    templateA.hasResourceProperties('AWS::CloudWatch::Alarm', {
      Namespace: 'AWS/SQS',
      Threshold: 1,
    });
  });

  test('Lambda 実行時間アラームが存在する（PARAM-005 §6.1）', () => {
    templateA.hasResourceProperties('AWS::CloudWatch::Alarm', {
      MetricName: 'Duration',
      Namespace: 'AWS/Lambda',
    });
  });
});

describe('PatternALambdaStack - LogGroup Pre-creation', () => {
  let templateA: Template;

  beforeAll(() => {
    ({ templateA } = buildAllStacks());
  });

  test('Lambda LogGroup が CMK 暗号化で先行作成される（Phase3 引き継ぎ注意）', () => {
    templateA.hasResourceProperties('AWS::Logs::LogGroup', {
      KmsKeyId: Match.anyValue(),
    });
  });
});

// ===========================================================================
// Pattern B: AWS Batch テスト（PARAM-006）
// ===========================================================================
describe('PatternBBatchStack - Compute Environment', () => {
  let templateB: Template;

  beforeAll(() => {
    ({ templateB } = buildAllStacks());
  });

  test('Batch Compute Environment が 1 つ作成される', () => {
    templateB.resourceCountIs('AWS::Batch::ComputeEnvironment', 1);
  });

  test('Compute Environment が FARGATE タイプ（PARAM-006 §2）', () => {
    templateB.hasResourceProperties('AWS::Batch::ComputeEnvironment', {
      ComputeResources: Match.objectLike({
        Type: 'FARGATE',
      }),
    });
  });

  test('dev 環境の maxvCpus が 4（PARAM-006 §2）', () => {
    templateB.hasResourceProperties('AWS::Batch::ComputeEnvironment', {
      ComputeResources: Match.objectLike({
        MaxvCpus: 4,
      }),
    });
  });

  test('Compute Environment に VPC サブネットが設定される', () => {
    templateB.hasResourceProperties('AWS::Batch::ComputeEnvironment', {
      ComputeResources: Match.objectLike({
        Subnets: Match.anyValue(),
        SecurityGroupIds: Match.anyValue(),
      }),
    });
  });
});

describe('PatternBBatchStack - Job Queue & Definition', () => {
  let templateB: Template;

  beforeAll(() => {
    ({ templateB } = buildAllStacks());
  });

  test('Batch ジョブキューが作成される', () => {
    templateB.resourceCountIs('AWS::Batch::JobQueue', 1);
  });

  test('Batch ジョブ定義が作成される', () => {
    templateB.resourceCountIs('AWS::Batch::JobDefinition', 1);
  });

  test('ジョブ定義のタイプが container（PARAM-006 §3）', () => {
    templateB.hasResourceProperties('AWS::Batch::JobDefinition', {
      Type: 'container',
    });
  });
});

describe('PatternBBatchStack - IAM Roles', () => {
  let templateB: Template;

  beforeAll(() => {
    ({ templateB } = buildAllStacks());
  });

  test('Batch 用 IAM ロールが複数作成される（PARAM-006 §8）', () => {
    const roles = templateB.findResources('AWS::IAM::Role');
    expect(Object.keys(roles).length).toBeGreaterThanOrEqual(2);
  });

  test('IAM ロールに Permission Boundary が適用される', () => {
    templateB.hasResourceProperties('AWS::IAM::Role', {
      PermissionsBoundary: Match.anyValue(),
    });
  });
});

describe('PatternBBatchStack - EventBridge & Alarms', () => {
  let templateB: Template;

  beforeAll(() => {
    ({ templateB } = buildAllStacks());
  });

  test('EventBridge スケジュールが作成される（PARAM-006 §5）', () => {
    templateB.resourceCountIs('AWS::Events::Rule', 1);
  });

  test('dev 環境では EventBridge が DISABLED（PARAM-006 §5）', () => {
    templateB.hasResourceProperties('AWS::Events::Rule', {
      State: 'DISABLED',
    });
  });

  test('Batch アラームが 2 本作成される（PARAM-006 §6）', () => {
    templateB.resourceCountIs('AWS::CloudWatch::Alarm', 2);
  });

  test('Batch ジョブ失敗アラームが存在する', () => {
    templateB.hasResourceProperties('AWS::CloudWatch::Alarm', {
      MetricName: 'FailedJobCount',
      Namespace: 'AWS/Batch',
    });
  });

  test('Batch ジョブペンディングアラームが存在する', () => {
    templateB.hasResourceProperties('AWS::CloudWatch::Alarm', {
      MetricName: 'PendingJobCount',
      Namespace: 'AWS/Batch',
    });
  });
});

describe('PatternBBatchStack - ECR Repository', () => {
  let templateB: Template;

  beforeAll(() => {
    ({ templateB } = buildAllStacks());
  });

  test('ECR リポジトリが IMMUTABLE タグ付きで作成される（PARAM-006 §7）', () => {
    templateB.hasResourceProperties('AWS::ECR::Repository', {
      ImageTagMutability: 'IMMUTABLE',
    });
  });

  test('ECR リポジトリがスキャンオンプッシュ設定', () => {
    templateB.hasResourceProperties('AWS::ECR::Repository', {
      ImageScanningConfiguration: Match.objectLike({
        ScanOnPush: true,
      }),
    });
  });
});

// ===========================================================================
// Pattern C: SQS + ECS Fargate テスト（PARAM-007）
// ===========================================================================
describe('PatternCSqsFargateStack - SQS', () => {
  let templateC: Template;

  beforeAll(() => {
    ({ templateC } = buildAllStacks());
  });

  test('SQS キューが 2 つ作成される（メイン + DLQ）', () => {
    templateC.resourceCountIs('AWS::SQS::Queue', 2);
  });

  test('メインキューの VisibilityTimeout が 300 秒（PARAM-007 §2.2）', () => {
    templateC.hasResourceProperties('AWS::SQS::Queue', {
      VisibilityTimeout: 300,
    });
  });

  test('SQS キューが CMK 暗号化（PARAM-007 §2.3）', () => {
    const queues = templateC.findResources('AWS::SQS::Queue', {
      Properties: {
        KmsMasterKeyId: Match.anyValue(),
      },
    });
    expect(Object.keys(queues).length).toBeGreaterThanOrEqual(1);
  });

  test('DLQ のリドライブ設定で maxReceiveCount が 5', () => {
    templateC.hasResourceProperties('AWS::SQS::Queue', {
      RedrivePolicy: Match.objectLike({
        maxReceiveCount: 5,
      }),
    });
  });
});

describe('PatternCSqsFargateStack - Fargate Worker', () => {
  let templateC: Template;

  beforeAll(() => {
    ({ templateC } = buildAllStacks());
  });

  test('ECS タスク定義が作成される（PARAM-007 §5）', () => {
    templateC.resourceCountIs('AWS::ECS::TaskDefinition', 1);
  });

  test('ECS サービスが作成される（desiredCount=1）', () => {
    templateC.hasResourceProperties('AWS::ECS::Service', {
      DesiredCount: 1,
    });
  });

  test('ECS サービスに Circuit Breaker が有効（CDK設計書 §3.4）', () => {
    templateC.hasResourceProperties('AWS::ECS::Service', {
      DeploymentConfiguration: Match.objectLike({
        DeploymentCircuitBreaker: Match.objectLike({
          Enable: true,
          Rollback: true,
        }),
      }),
    });
  });

  test('Worker IAM ロールに Permission Boundary が適用される', () => {
    templateC.hasResourceProperties('AWS::IAM::Role', {
      PermissionsBoundary: Match.anyValue(),
    });
  });
});

describe('PatternCSqsFargateStack - Auto Scaling', () => {
  let templateCDev: Template;
  let templateCProd: Template;

  beforeAll(() => {
    ({ templateC: templateCDev } = buildAllStacks(TEST_CONFIG, TEST_ENV));
    ({ templateC: templateCProd } = buildAllStacks(PROD_CONFIG, 'prod'));
  });

  test('dev 環境では Auto Scaling スケーラブルターゲットが作成されない（enableAutoScaling=false）', () => {
    templateCDev.resourceCountIs('AWS::ApplicationAutoScaling::ScalableTarget', 0);
  });

  test('prod 環境では Auto Scaling スケーラブルターゲットが作成される（PARAM-007 §6）', () => {
    templateCProd.resourceCountIs('AWS::ApplicationAutoScaling::ScalableTarget', 1);
  });

  test('prod 環境では TargetTracking スケーリングポリシーが作成される（PARAM-007 §6.2）', () => {
    templateCProd.hasResourceProperties('AWS::ApplicationAutoScaling::ScalingPolicy', {
      PolicyType: 'TargetTrackingScaling',
    });
  });

  test('prod ターゲットトラッキングのターゲット値が 10.0（PARAM-007 §6.2）', () => {
    templateCProd.hasResourceProperties('AWS::ApplicationAutoScaling::ScalingPolicy', {
      TargetTrackingScalingPolicyConfiguration: Match.objectLike({
        TargetValue: 10,
      }),
    });
  });
});

describe('PatternCSqsFargateStack - Alarms', () => {
  let templateC: Template;

  beforeAll(() => {
    ({ templateC } = buildAllStacks());
  });

  test('アラームが 5 本作成される（PARAM-007 §7）', () => {
    templateC.resourceCountIs('AWS::CloudWatch::Alarm', 5);
  });

  test('Worker CPU 高負荷アラームが存在する（PARAM-007 §7）', () => {
    templateC.hasResourceProperties('AWS::CloudWatch::Alarm', {
      MetricName: 'CPUUtilization',
      Namespace: 'AWS/ECS',
      Threshold: 80,
    });
  });

  test('Worker 最小タスク数アラームが存在する（CRITICAL、PARAM-007 §7）', () => {
    templateC.hasResourceProperties('AWS::CloudWatch::Alarm', {
      Namespace: 'AWS/ECS',
      MetricName: 'RunningTaskCount',
      Threshold: 1,
      ComparisonOperator: 'LessThanThreshold',
    });
  });
});

describe('PatternCSqsFargateStack - SSM Output', () => {
  let templateC: Template;

  beforeAll(() => {
    ({ templateC } = buildAllStacks());
  });

  test('SQS キュー URL が SSM に出力される（PARAM-007 §8）', () => {
    templateC.hasResourceProperties('AWS::SSM::Parameter', {
      Name: Match.stringLikeRegexp('.*sqs.*'),
    });
  });
});

describe('PatternCSqsFargateStack - ECR Repository', () => {
  let templateC: Template;

  beforeAll(() => {
    ({ templateC } = buildAllStacks());
  });

  test('ECR Worker リポジトリが IMMUTABLE タグ付きで作成される', () => {
    templateC.hasResourceProperties('AWS::ECR::Repository', {
      ImageTagMutability: 'IMMUTABLE',
    });
  });
});

// ===========================================================================
// 全パターン共通: タグ統制テスト（PARAM-001 §2.1 タグ列）
// ===========================================================================
describe('All Patterns - Tag Governance', () => {
  let templateA: Template;
  let templateB: Template;
  let templateC: Template;

  beforeAll(() => {
    ({ templateA, templateB, templateC } = buildAllStacks());
  });

  test('Pattern A: Lambda に environment タグが付与される', () => {
    templateA.hasResourceProperties('AWS::Lambda::Function', {
      Tags: Match.arrayWith([
        Match.objectLike({ Key: 'environment', Value: 'dev' }),
      ]),
    });
  });

  test('Pattern A: Lambda に compliance=ismap タグが付与される', () => {
    templateA.hasResourceProperties('AWS::Lambda::Function', {
      Tags: Match.arrayWith([
        Match.objectLike({ Key: 'compliance', Value: 'ismap' }),
      ]),
    });
  });

  test('Pattern A: Lambda に tenant=A タグが付与される', () => {
    templateA.hasResourceProperties('AWS::Lambda::Function', {
      Tags: Match.arrayWith([
        Match.objectLike({ Key: 'tenant', Value: 'A' }),
      ]),
    });
  });

  test('Pattern B: Batch CE に environment タグが付与される（L1: Tags オブジェクト形式）', () => {
    templateB.hasResourceProperties('AWS::Batch::ComputeEnvironment', {
      Tags: Match.objectLike({
        environment: 'dev',
      }),
    });
  });

  test('Pattern C: SQS キューに compliance=ismap タグが付与される', () => {
    const queues = templateC.findResources('AWS::SQS::Queue', {
      Properties: {
        Tags: Match.arrayWith([
          Match.objectLike({ Key: 'compliance', Value: 'ismap' }),
        ]),
      },
    });
    expect(Object.keys(queues).length).toBeGreaterThanOrEqual(1);
  });
});
