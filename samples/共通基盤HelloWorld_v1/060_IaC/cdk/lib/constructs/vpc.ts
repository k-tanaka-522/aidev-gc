/**
 * lib/constructs/vpc.ts
 * HelloWorldVpcConstruct — テナント VPC / サブネット / ルートテーブル / IGW / NAT GW / Flow Logs
 *
 * 対応 PARAM: PARAM-001 §2〜8
 * 作成: infra-iac
 * 作成日: 2026-06-01
 *
 * 設計ポイント:
 *   - CDK Vpc L2 の代わりに CfnVpc + CfnSubnet を組み合わせてサブネット種別を明示管理
 *   - サブネット 5 種（public / private-app / private-batch / protected-data / tgw-attach）
 *   - dev は NAT GW 1 台（1a のみ）、stg/prod は 2 台（PARAM-001 §5）
 *   - VPC Flow Logs は CloudWatch Logs 出力（PARAM-001 §8）
 *   - 自動適用層 Network Hub VPC は作成しない（SSM 参照のみ）
 */

import * as cdk from 'aws-cdk-lib';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as logs from 'aws-cdk-lib/aws-logs';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as kms from 'aws-cdk-lib/aws-kms';
import { Construct } from 'constructs';
import { Environment, EnvConfig } from '../common/config';
import { applyTags, resourceName } from '../common/tags';

export interface HelloWorldVpcProps {
  readonly environment: Environment;
  readonly config: EnvConfig;
  readonly tenantId: string;
  /** VPC Flow Logs 暗号化 CMK（PARAM-001 §8 kms_key_id） */
  readonly appCommonCmk: kms.IKey;
}

export class HelloWorldVpcConstruct extends Construct {
  /** テナント VPC */
  public readonly vpc: ec2.CfnVPC;
  /** Public Subnet IDs [1a, 1c] */
  public readonly publicSubnetIds: string[];
  /** Private-App Subnet IDs [1a, 1c] */
  public readonly privateAppSubnetIds: string[];
  /** Private-Batch Subnet IDs [1a, 1c] */
  public readonly privateBatchSubnetIds: string[];
  /** Protected-Data Subnet IDs [1a, 1c] */
  public readonly protectedDataSubnetIds: string[];
  /** TGW-Attach Subnet IDs [1a, 1c] */
  public readonly tgwAttachSubnetIds: string[];
  /** Internet Gateway */
  public readonly igw: ec2.CfnInternetGateway;

  constructor(scope: Construct, id: string, props: HelloWorldVpcProps) {
    super(scope, id);

    const { environment, config, tenantId, appCommonCmk } = props;
    const name = (suffix: string) => resourceName(tenantId, suffix);

    // ---------- VPC ----------
    // 対応: PARAM-001 §2.1
    this.vpc = new ec2.CfnVPC(this, 'Vpc', {
      cidrBlock: config.vpcCidr, // PARAM-001 §2.1 CIDR: 10.20.0.0/16
      enableDnsHostnames: true,  // PARAM-001 §2.1 enable_dns_hostnames
      enableDnsSupport: true,    // PARAM-001 §2.1 enable_dns_support
      instanceTenancy: 'default',
      tags: [
        { key: 'Name', value: name('vpc') },
        { key: 'tenant', value: tenantId },
      ],
    });

    // ---------- Internet Gateway ----------
    // 対応: PARAM-001 §4
    this.igw = new ec2.CfnInternetGateway(this, 'Igw', {
      tags: [{ key: 'Name', value: name('igw') }],
    });
    new ec2.CfnVPCGatewayAttachment(this, 'IgwAttach', {
      vpcId: this.vpc.ref,
      internetGatewayId: this.igw.ref,
    });

    // ---------- サブネット定義 ----------
    // 対応: PARAM-001 §3.1〜3.5
    // CIDR は PARAM-001 §3 の代表値を使用（テナント A、10.20.x.0/24）

    const subnetDefs = [
      // Public サブネット（PARAM-001 §3.1）
      { az: 'ap-northeast-1a', cidr: '10.20.0.0/24', type: 'public', suffix: 'public-1a' },
      { az: 'ap-northeast-1c', cidr: '10.20.1.0/24', type: 'public', suffix: 'public-1c' },
      // Private-App サブネット（PARAM-001 §3.2）
      { az: 'ap-northeast-1a', cidr: '10.20.10.0/24', type: 'private-app', suffix: 'private-app-1a' },
      { az: 'ap-northeast-1c', cidr: '10.20.11.0/24', type: 'private-app', suffix: 'private-app-1c' },
      // Private-Batch サブネット（PARAM-001 §3.3）
      { az: 'ap-northeast-1a', cidr: '10.20.20.0/24', type: 'private-batch', suffix: 'private-batch-1a' },
      { az: 'ap-northeast-1c', cidr: '10.20.21.0/24', type: 'private-batch', suffix: 'private-batch-1c' },
      // Protected-Data サブネット（PARAM-001 §3.4）
      { az: 'ap-northeast-1a', cidr: '10.20.30.0/24', type: 'protected-data', suffix: 'protected-data-1a' },
      { az: 'ap-northeast-1c', cidr: '10.20.31.0/24', type: 'protected-data', suffix: 'protected-data-1c' },
      // TGW-Attach サブネット（PARAM-001 §3.5、/28 = 16IP）
      { az: 'ap-northeast-1a', cidr: '10.20.40.0/28', type: 'tgw-attach', suffix: 'tgw-attach-1a' },
      { az: 'ap-northeast-1c', cidr: '10.20.41.0/28', type: 'tgw-attach', suffix: 'tgw-attach-1c' },
    ];

    const cfnSubnets: Record<string, ec2.CfnSubnet> = {};

    for (const def of subnetDefs) {
      const subnet = new ec2.CfnSubnet(this, `Subnet-${def.suffix}`, {
        vpcId: this.vpc.ref,
        cidrBlock: def.cidr,
        availabilityZone: def.az,
        mapPublicIpOnLaunch: false, // PARAM-001 §3 map_public_ip_on_launch=false
        tags: [
          { key: 'Name', value: name(def.suffix) },
          { key: 'subnet_type', value: def.type },
        ],
      });
      cfnSubnets[def.suffix] = subnet;
    }

    this.publicSubnetIds = ['public-1a', 'public-1c'].map(k => cfnSubnets[k].ref);
    this.privateAppSubnetIds = ['private-app-1a', 'private-app-1c'].map(k => cfnSubnets[k].ref);
    this.privateBatchSubnetIds = ['private-batch-1a', 'private-batch-1c'].map(k => cfnSubnets[k].ref);
    this.protectedDataSubnetIds = ['protected-data-1a', 'protected-data-1c'].map(k => cfnSubnets[k].ref);
    this.tgwAttachSubnetIds = ['tgw-attach-1a', 'tgw-attach-1c'].map(k => cfnSubnets[k].ref);

    // ---------- EIP & NAT Gateway ----------
    // 対応: PARAM-001 §4〜5
    // dev: 1台（1a のみ）、stg/prod: 2台（PARAM-001 §5）
    const natGwCount = config.natGateways; // cdk.json context より

    const eip1a = new ec2.CfnEIP(this, 'Eip1a', {
      domain: 'vpc',
      tags: [{ key: 'Name', value: name('eip-nat-1a') }],
    });
    const natGw1a = new ec2.CfnNatGateway(this, 'NatGw1a', {
      subnetId: cfnSubnets['public-1a'].ref,
      allocationId: eip1a.attrAllocationId,
      connectivityType: 'public',
      tags: [{ key: 'Name', value: name('nat-1a') }],
    });

    let natGw1c: ec2.CfnNatGateway | undefined;
    if (natGwCount >= 2) {
      const eip1c = new ec2.CfnEIP(this, 'Eip1c', {
        domain: 'vpc',
        tags: [{ key: 'Name', value: name('eip-nat-1c') }],
      });
      natGw1c = new ec2.CfnNatGateway(this, 'NatGw1c', {
        subnetId: cfnSubnets['public-1c'].ref,
        allocationId: eip1c.attrAllocationId,
        connectivityType: 'public',
        tags: [{ key: 'Name', value: name('nat-1c') }],
      });
    }

    // ---------- Route Tables ----------
    // 対応: PARAM-001 §6

    // RT-Public（PARAM-001 §6.1）
    const rtPublic = new ec2.CfnRouteTable(this, 'RtPublic', {
      vpcId: this.vpc.ref,
      tags: [{ key: 'Name', value: name('rt-public') }],
    });
    new ec2.CfnRoute(this, 'RtPublicDefault', {
      routeTableId: rtPublic.ref,
      destinationCidrBlock: '0.0.0.0/0',
      gatewayId: this.igw.ref,
    });
    // Public サブネットとルートテーブルを関連付け
    for (const sid of this.publicSubnetIds) {
      new ec2.CfnSubnetRouteTableAssociation(this, `RtPublicAssoc-${sid}`, {
        subnetId: sid,
        routeTableId: rtPublic.ref,
      });
    }

    // RT-Private-App-1a（PARAM-001 §6.2）
    const rtPrivateApp1a = new ec2.CfnRouteTable(this, 'RtPrivateApp1a', {
      vpcId: this.vpc.ref,
      tags: [{ key: 'Name', value: name('rt-private-app-1a') }],
    });
    new ec2.CfnRoute(this, 'RtPrivateApp1aDefault', {
      routeTableId: rtPrivateApp1a.ref,
      destinationCidrBlock: '0.0.0.0/0',
      natGatewayId: natGw1a.ref,
    });
    new ec2.CfnSubnetRouteTableAssociation(this, 'RtPrivateApp1aAssoc', {
      subnetId: cfnSubnets['private-app-1a'].ref,
      routeTableId: rtPrivateApp1a.ref,
    });

    // RT-Private-App-1c（PARAM-001 §6.2、dev は 1a の NAT GW を使用）
    const rtPrivateApp1c = new ec2.CfnRouteTable(this, 'RtPrivateApp1c', {
      vpcId: this.vpc.ref,
      tags: [{ key: 'Name', value: name('rt-private-app-1c') }],
    });
    new ec2.CfnRoute(this, 'RtPrivateApp1cDefault', {
      routeTableId: rtPrivateApp1c.ref,
      destinationCidrBlock: '0.0.0.0/0',
      // dev は NAT GW 1 台なので 1a の NAT GW を使用（PARAM-001 §5）
      natGatewayId: natGw1c ? natGw1c.ref : natGw1a.ref,
    });
    new ec2.CfnSubnetRouteTableAssociation(this, 'RtPrivateApp1cAssoc', {
      subnetId: cfnSubnets['private-app-1c'].ref,
      routeTableId: rtPrivateApp1c.ref,
    });

    // RT-Private-Batch（PARAM-001 §6.3、S3 Gateway Endpoint は VpcEndpointConstruct で追加）
    const rtPrivateBatch = new ec2.CfnRouteTable(this, 'RtPrivateBatch', {
      vpcId: this.vpc.ref,
      tags: [{ key: 'Name', value: name('rt-private-batch') }],
    });
    // Private-Batch 1a/1c を同一 RT に関連付け（外部アクセス不要、PARAM-001 §6.3）
    for (const sid of this.privateBatchSubnetIds) {
      new ec2.CfnSubnetRouteTableAssociation(this, `RtPrivateBatchAssoc-${sid}`, {
        subnetId: sid,
        routeTableId: rtPrivateBatch.ref,
      });
    }

    // RT-Protected-Data（PARAM-001 §6.4、VPC 内閉域のみ）
    const rtProtectedData = new ec2.CfnRouteTable(this, 'RtProtectedData', {
      vpcId: this.vpc.ref,
      tags: [{ key: 'Name', value: name('rt-protected-data') }],
    });
    for (const sid of this.protectedDataSubnetIds) {
      new ec2.CfnSubnetRouteTableAssociation(this, `RtProtectedDataAssoc-${sid}`, {
        subnetId: sid,
        routeTableId: rtProtectedData.ref,
      });
    }

    // RT-TGW-Attach（PARAM-001 §6.5）
    const rtTgwAttach = new ec2.CfnRouteTable(this, 'RtTgwAttach', {
      vpcId: this.vpc.ref,
      tags: [{ key: 'Name', value: name('rt-tgw-attach') }],
    });
    for (const sid of this.tgwAttachSubnetIds) {
      new ec2.CfnSubnetRouteTableAssociation(this, `RtTgwAttachAssoc-${sid}`, {
        subnetId: sid,
        routeTableId: rtTgwAttach.ref,
      });
    }

    // ---------- VPC Flow Logs ----------
    // 対応: PARAM-001 §8
    const flowLogsRole = new iam.Role(this, 'FlowLogsRole', {
      assumedBy: new iam.ServicePrincipal('vpc-flow-logs.amazonaws.com'),
      roleName: name('flowlogs-role'),
    });

    const flowLogsGroup = new logs.LogGroup(this, 'FlowLogsGroup', {
      logGroupName: `/helloworld/flowlogs/tenant-${tenantId}`,
      retention: props.config.flowLogsRetentionDays as logs.RetentionDays, // PARAM-001 §8
      encryptionKey: appCommonCmk, // PARAM-001 §8 kms_key_id
      removalPolicy: cdk.RemovalPolicy.RETAIN,
    });

    flowLogsGroup.grantWrite(flowLogsRole);

    new ec2.CfnFlowLog(this, 'FlowLog', {
      resourceType: 'VPC',
      resourceId: this.vpc.ref,
      trafficType: 'ALL', // PARAM-001 §8 traffic_type=ALL
      logDestinationType: 'cloud-watch-logs',
      logDestination: flowLogsGroup.logGroupArn,
      deliverLogsPermissionArn: flowLogsRole.roleArn,
      tags: [
        { key: 'Name', value: name('flowlog') },
        { key: 'compliance', value: 'ismap' },
      ],
    });

    // 7 タグ適用
    applyTags(this, environment, tenantId);
  }
}
