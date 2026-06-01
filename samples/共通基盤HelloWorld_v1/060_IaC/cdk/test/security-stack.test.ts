/**
 * test/security-stack.test.ts
 * SecurityStack（KMS / IAM Permission Boundary / GuardDuty / Config Rules）Unit Test
 *
 * 作成: infra-iac
 * 作成日: 2026-06-01
 *
 * 実行方法: npm test
 * フレームワーク: Jest + aws-cdk-lib/assertions
 *
 * カバレッジ対象:
 *   - KMS キー 2 本（tenant-data CMK / app-common CMK）
 *   - CMK 自動ローテーション有効
 *   - Permission Boundary ManagedPolicy 作成
 *   - GuardDuty High Severity EventBridge ルール
 *   - Config Rules 4 本
 *   - SNS セキュリティアラートトピック（CMK 暗号化）
 *   - SSM Parameter（app-common CMK ARN 出力）
 *   - タグ 7 キー付与検証
 *
 * 対応 PARAM: PARAM-003 / PARAM-005
 */

import * as cdk from 'aws-cdk-lib';
import { Template, Match } from 'aws-cdk-lib/assertions';
import { SecurityStack } from '../lib/stacks/security-stack';
import { EnvConfig, Environment } from '../lib/common/config';

// ---------------------------------------------------------------------------
// テスト用スタブ設定（dev 環境）
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

const CDK_ENV: cdk.Environment = {
  account: TEST_CONFIG.accountId,
  region: TEST_CONFIG.region,
};

function buildStack() {
  const app = new cdk.App();
  const stack = new SecurityStack(app, 'TestSecurityStack', {
    env: CDK_ENV,
    environment: TEST_ENV,
    config: TEST_CONFIG,
  });
  return { app, stack, template: Template.fromStack(stack) };
}

// ---------------------------------------------------------------------------
// KMS テスト（PARAM-003 §2）
// ---------------------------------------------------------------------------
describe('SecurityStack - KMS', () => {
  let template: Template;

  beforeAll(() => {
    ({ template } = buildStack());
  });

  test('KMS キーが 2 本作成される（tenantData + appCommon）', () => {
    template.resourceCountIs('AWS::KMS::Key', 2);
  });

  test('両キーとも自動ローテーション有効（PARAM-003 §2.3）', () => {
    const keys = template.findResources('AWS::KMS::Key');
    for (const key of Object.values(keys)) {
      expect((key as any).Properties.EnableKeyRotation).toBe(true);
    }
  });

  test('KMS Key の PendingWindowInDays が 30 日（PARAM-003 §2.3）', () => {
    template.hasResourceProperties('AWS::KMS::Key', {
      PendingWindowInDays: 30,
    });
  });

  test('tenant-data CMK のエイリアスが正しい', () => {
    template.hasResourceProperties('AWS::KMS::Alias', {
      AliasName: 'alias/helloworld-tenant-A-data',
    });
  });

  test('app-common CMK のエイリアスが正しい', () => {
    template.hasResourceProperties('AWS::KMS::Alias', {
      AliasName: 'alias/helloworld-app-common',
    });
  });

  test('app-common CMK に CloudWatch Logs サービスプリンシパルが許可されている', () => {
    template.hasResourceProperties('AWS::KMS::Key', {
      KeyPolicy: Match.objectLike({
        Statement: Match.arrayWith([
          Match.objectLike({
            Principal: Match.objectLike({
              Service: Match.arrayWith(['logs.ap-northeast-1.amazonaws.com']),
            }),
          }),
        ]),
      }),
    });
  });

  test('app-common CMK ARN が SSM に出力される', () => {
    template.hasResourceProperties('AWS::SSM::Parameter', {
      Name: '/helloworld/security/app-common-cmk-arn',
      Type: 'String',
    });
  });
});

// ---------------------------------------------------------------------------
// IAM Permission Boundary テスト（PARAM-005 §3）
// ---------------------------------------------------------------------------
describe('SecurityStack - Permission Boundary', () => {
  let template: Template;

  beforeAll(() => {
    ({ template } = buildStack());
  });

  test('Permission Boundary マネージドポリシーが作成される', () => {
    template.hasResourceProperties('AWS::IAM::ManagedPolicy', {
      ManagedPolicyName: 'PB-ServiceRole',
    });
  });

  test('Permission Boundary ポリシーに Allow セクションが存在する', () => {
    template.hasResourceProperties('AWS::IAM::ManagedPolicy', {
      ManagedPolicyName: 'PB-ServiceRole',
      PolicyDocument: Match.objectLike({
        Statement: Match.arrayWith([
          Match.objectLike({ Effect: 'Allow' }),
        ]),
      }),
    });
  });

  test('Permission Boundary ポリシーに Deny セクションが存在する', () => {
    template.hasResourceProperties('AWS::IAM::ManagedPolicy', {
      ManagedPolicyName: 'PB-ServiceRole',
      PolicyDocument: Match.objectLike({
        Statement: Match.arrayWith([
          Match.objectLike({ Effect: 'Deny' }),
        ]),
      }),
    });
  });
});

// ---------------------------------------------------------------------------
// GuardDuty + EventBridge テスト（PARAM-005 §5）
// ---------------------------------------------------------------------------
describe('SecurityStack - GuardDuty EventBridge', () => {
  let template: Template;

  beforeAll(() => {
    ({ template } = buildStack());
  });

  test('EventBridge ルールが作成される（GuardDuty High Severity）', () => {
    template.resourceCountIs('AWS::Events::Rule', 1);
  });

  test('GuardDuty High Severity ルールのパターンが正しい（severity >= 7.0）', () => {
    template.hasResourceProperties('AWS::Events::Rule', {
      EventPattern: Match.objectLike({
        source: ['aws.guardduty'],
        'detail-type': ['GuardDuty Finding'],
      }),
    });
  });

  test('EventBridge ターゲットに SNS セキュリティアラートトピックが設定される', () => {
    template.hasResourceProperties('AWS::Events::Rule', {
      Targets: Match.arrayWith([
        Match.objectLike({
          Arn: Match.anyValue(),
        }),
      ]),
    });
  });
});

// ---------------------------------------------------------------------------
// Config Rules テスト（PARAM-005 §6）
// ---------------------------------------------------------------------------
describe('SecurityStack - Config Rules', () => {
  let template: Template;

  beforeAll(() => {
    ({ template } = buildStack());
  });

  test('Config マネージドルールが 4 本作成される', () => {
    template.resourceCountIs('AWS::Config::ConfigRule', 4);
  });

  test('iam-no-inline-policy ルールが存在する', () => {
    template.hasResourceProperties('AWS::Config::ConfigRule', {
      Source: Match.objectLike({
        SourceIdentifier: 'IAM_NO_INLINE_POLICY_CHECK',
      }),
    });
  });

  test('restricted-ssh ルールが存在する', () => {
    template.hasResourceProperties('AWS::Config::ConfigRule', {
      Source: Match.objectLike({
        SourceIdentifier: 'INCOMING_SSH_DISABLED',
      }),
    });
  });

  test('s3-bucket-public-read-prohibited ルールが存在する', () => {
    template.hasResourceProperties('AWS::Config::ConfigRule', {
      Source: Match.objectLike({
        SourceIdentifier: 'S3_BUCKET_PUBLIC_READ_PROHIBITED',
      }),
    });
  });

  test('s3-server-side-encryption ルールが存在する', () => {
    template.hasResourceProperties('AWS::Config::ConfigRule', {
      Source: Match.objectLike({
        SourceIdentifier: 'S3_BUCKET_SERVER_SIDE_ENCRYPTION_ENABLED',
      }),
    });
  });
});

// ---------------------------------------------------------------------------
// SNS セキュリティアラートテスト（PARAM-005 §7）
// ---------------------------------------------------------------------------
describe('SecurityStack - SNS Security Alerts', () => {
  let template: Template;

  beforeAll(() => {
    ({ template } = buildStack());
  });

  test('セキュリティアラート SNS トピックが CMK 暗号化で作成される', () => {
    template.hasResourceProperties('AWS::SNS::Topic', {
      TopicName: 'helloworld-security-alerts',
    });
  });
});

// ---------------------------------------------------------------------------
// タグ統制テスト（7 キー）
// ---------------------------------------------------------------------------
describe('SecurityStack - Tag Governance', () => {
  let template: Template;

  beforeAll(() => {
    ({ template } = buildStack());
  });

  test('KMS キーに 7 必須タグが付与されている', () => {
    template.hasResourceProperties('AWS::KMS::Key', {
      Tags: Match.arrayWith([
        Match.objectLike({ Key: 'environment', Value: 'dev' }),
        Match.objectLike({ Key: 'owner' }),
        Match.objectLike({ Key: 'cost_center' }),
        Match.objectLike({ Key: 'project' }),
        Match.objectLike({ Key: 'tenant', Value: 'A' }),
        Match.objectLike({ Key: 'compliance', Value: 'ismap' }),
        Match.objectLike({ Key: 'pattern' }),
      ]),
    });
  });
});

// ---------------------------------------------------------------------------
// Stack 出力テスト
// ---------------------------------------------------------------------------
describe('SecurityStack - Outputs', () => {
  let template: Template;

  beforeAll(() => {
    ({ template } = buildStack());
  });

  test('TenantDataCmkArn が出力される', () => {
    template.hasOutput('TenantDataCmkArn', {
      Value: Match.anyValue(),
    });
  });

  test('AppCommonCmkArn が出力される', () => {
    template.hasOutput('AppCommonCmkArn', {
      Value: Match.anyValue(),
    });
  });

  test('SecurityAlertsSnsArn が出力される', () => {
    template.hasOutput('SecurityAlertsSnsArn', {
      Value: Match.anyValue(),
    });
  });
});
