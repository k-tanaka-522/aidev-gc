/**
 * test/network-stack.test.ts
 * NetworkStack / VPC / SecurityGroups / VpcEndpoints の Unit Test
 *
 * 作成: infra-iac
 * 作成日: 2026-06-01
 *
 * 実行方法: npm test
 * フレームワーク: Jest + aws-cdk-lib/assertions
 *
 * カバレッジ対象:
 *   - VPC / Subnet 数・CIDR 検証
 *   - セキュリティグループ数とポート設定
 *   - VPC Endpoint 数（S3 Gateway + 11 Interface）
 *   - NACL エントリ数
 *   - タグ 7 キー付与検証
 *   - Route53 PHZ 作成
 *
 * 対応 PARAM: PARAM-001 全般
 */

import * as cdk from 'aws-cdk-lib';
import { Template, Match } from 'aws-cdk-lib/assertions';
import { SecurityStack } from '../lib/stacks/security-stack';
import { NetworkStack } from '../lib/stacks/network-stack';
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

function buildStacks() {
  const app = new cdk.App();

  const securityStack = new SecurityStack(app, 'TestSecurityStack', {
    env: CDK_ENV,
    environment: TEST_ENV,
    config: TEST_CONFIG,
  });

  const networkStack = new NetworkStack(app, 'TestNetworkStack', {
    env: CDK_ENV,
    environment: TEST_ENV,
    config: TEST_CONFIG,
    tenantDataCmkArn: securityStack.tenantDataCmkArn,
    appCommonCmkArn: securityStack.appCommonCmkArn,
  });

  return { app, securityStack, networkStack };
}

// ---------------------------------------------------------------------------
// VPC テスト
// ---------------------------------------------------------------------------
describe('NetworkStack - VPC', () => {
  let template: Template;

  beforeAll(() => {
    const { networkStack } = buildStacks();
    template = Template.fromStack(networkStack);
  });

  test('VPC が 1 つ作成される', () => {
    template.resourceCountIs('AWS::EC2::VPC', 1);
  });

  test('VPC CIDR が PARAM-001 §2.1 通り', () => {
    template.hasResourceProperties('AWS::EC2::VPC', {
      CidrBlock: '10.20.0.0/16',
      EnableDnsHostnames: true,
      EnableDnsSupport: true,
    });
  });

  test('サブネットが 10 個作成される（5 タイプ × 2 AZ）', () => {
    // public(2) + private-app(2) + private-batch(2) + protected-data(2) + tgw-attach(2) = 10
    template.resourceCountIs('AWS::EC2::Subnet', 10);
  });

  test('Public サブネット CIDR が PARAM-001 §3 通り（1a: 10.20.0.0/24）', () => {
    template.hasResourceProperties('AWS::EC2::Subnet', {
      CidrBlock: '10.20.0.0/24',
    });
  });

  test('Protected-Data サブネット CIDR が PARAM-001 §3 通り（1a: 10.20.30.0/24）', () => {
    template.hasResourceProperties('AWS::EC2::Subnet', {
      CidrBlock: '10.20.30.0/24',
    });
  });

  test('dev は NAT Gateway 1 つ（PARAM-001 §5）', () => {
    template.resourceCountIs('AWS::EC2::NatGateway', 1);
  });

  test('ルートテーブルが 6 つ作成される', () => {
    // RT-Public / RT-Private-App-1a / RT-Private-App-1c / RT-Private-Batch / RT-Protected-Data / RT-TGW-Attach
    template.resourceCountIs('AWS::EC2::RouteTable', 6);
  });

  test('VPC Flow Logs が作成される', () => {
    template.resourceCountIs('AWS::EC2::FlowLog', 1);
  });
});

// ---------------------------------------------------------------------------
// セキュリティグループテスト
// ---------------------------------------------------------------------------
describe('NetworkStack - SecurityGroups', () => {
  let template: Template;

  beforeAll(() => {
    const { networkStack } = buildStacks();
    template = Template.fromStack(networkStack);
  });

  test('セキュリティグループが 9 個作成される', () => {
    // Public ALB / Internal ALB / Fargate App / Batch Common / Batch A / Batch B / Batch C / VPC Endpoint / TGW Attach
    template.resourceCountIs('AWS::EC2::SecurityGroup', 9);
  });

  test('Public ALB SG が HTTPS(443) インバウンドを許可', () => {
    template.hasResourceProperties('AWS::EC2::SecurityGroup', {
      GroupDescription: Match.stringLikeRegexp('.*[Pp]ublic.*[Aa][Ll][Bb].*'),
      SecurityGroupIngress: Match.arrayWith([
        Match.objectLike({
          IpProtocol: 'tcp',
          FromPort: 443,
          ToPort: 443,
          CidrIp: '0.0.0.0/0',
        }),
      ]),
    });
  });

  test('VPC Endpoint SG が HTTPS(443) のみ許可', () => {
    template.hasResourceProperties('AWS::EC2::SecurityGroup', {
      GroupDescription: Match.stringLikeRegexp('.*[Vv][Pp][Cc].*[Ee]ndpoint.*'),
      SecurityGroupIngress: Match.arrayWith([
        Match.objectLike({
          IpProtocol: 'tcp',
          FromPort: 443,
          ToPort: 443,
        }),
      ]),
    });
  });
});

// ---------------------------------------------------------------------------
// VPC Endpoint テスト
// ---------------------------------------------------------------------------
describe('NetworkStack - VpcEndpoints', () => {
  let template: Template;

  beforeAll(() => {
    const { networkStack } = buildStacks();
    template = Template.fromStack(networkStack);
  });

  test('S3 Gateway Endpoint が 1 つ作成される', () => {
    template.hasResourceProperties('AWS::EC2::VPCEndpoint', {
      VpcEndpointType: 'Gateway',
      ServiceName: Match.stringLikeRegexp('.*s3.*'),
    });
  });

  test('Interface Endpoint が 11 個作成される（PARAM-001 §9.2）', () => {
    // ecr.api, ecr.dkr, logs, sqs, batch, sts, ssm, ssmmessages, ec2messages, monitoring, kms
    const ifEndpoints = template.findResources('AWS::EC2::VPCEndpoint', {
      Properties: {
        VpcEndpointType: 'Interface',
      },
    });
    expect(Object.keys(ifEndpoints).length).toBe(11);
  });

  test('ECR API Endpoint が PrivateDnsEnabled=true', () => {
    template.hasResourceProperties('AWS::EC2::VPCEndpoint', {
      VpcEndpointType: 'Interface',
      ServiceName: Match.stringLikeRegexp('.*ecr.api.*'),
      PrivateDnsEnabled: true,
    });
  });
});

// ---------------------------------------------------------------------------
// NACL テスト
// ---------------------------------------------------------------------------
describe('NetworkStack - NACL', () => {
  let template: Template;

  beforeAll(() => {
    const { networkStack } = buildStacks();
    template = Template.fromStack(networkStack);
  });

  test('NACL が 2 つ作成される（Public + Protected-Data）', () => {
    template.resourceCountIs('AWS::EC2::NetworkAcl', 2);
  });

  test('Public NACL に HTTPS(443) 許可エントリが存在する', () => {
    template.hasResourceProperties('AWS::EC2::NetworkAclEntry', {
      Protocol: 6, // TCP
      PortRange: { From: 443, To: 443 },
      Egress: false,
      RuleAction: 'allow',
    });
  });
});

// ---------------------------------------------------------------------------
// Route53 PHZ テスト
// ---------------------------------------------------------------------------
describe('NetworkStack - Route53', () => {
  let template: Template;

  beforeAll(() => {
    const { networkStack } = buildStacks();
    template = Template.fromStack(networkStack);
  });

  test('プライベートホストゾーンが作成される（PARAM-001 §10）', () => {
    template.resourceCountIs('AWS::Route53::HostedZone', 1);
  });

  test('PHZ が VPC に関連付けられている', () => {
    template.hasResourceProperties('AWS::Route53::HostedZone', {
      Name: 'tenant-a.internal.helloworld.go.jp.',
      VPCs: Match.arrayWith([
        Match.objectLike({
          VPCRegion: 'ap-northeast-1',
        }),
      ]),
    });
  });
});

// ---------------------------------------------------------------------------
// タグ統制テスト（7 キー）
// ---------------------------------------------------------------------------
describe('NetworkStack - Tag Governance', () => {
  let template: Template;

  beforeAll(() => {
    const { networkStack } = buildStacks();
    template = Template.fromStack(networkStack);
  });

  test('VPC に 7 必須タグが付与されている', () => {
    template.hasResourceProperties('AWS::EC2::VPC', {
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
