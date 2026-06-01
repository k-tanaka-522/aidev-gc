/**
 * lib/stacks/network-stack.ts
 * NetworkStack — VPC / Subnet / Route Table / IGW / NAT GW / TGW Attach / VPC Endpoint / SG / NACL / Flow Logs
 *
 * 対応 PARAM: PARAM-001 §2〜12
 * 作成: infra-iac
 * 作成日: 2026-06-01
 *
 * 重要: Network Hub VPC / TGW 自体は自動適用層管理。
 *       TGW Attachment のみ CDK で作成（prod のみ、PARAM-001 §7）。
 *       TGW ID は SSM Parameter Store から取得。
 */

import * as cdk from 'aws-cdk-lib';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as kms from 'aws-cdk-lib/aws-kms';
import * as route53 from 'aws-cdk-lib/aws-route53';
import { Construct } from 'constructs';
import { Environment, EnvConfig } from '../common/config';
import { HelloWorldVpcConstruct } from '../constructs/vpc';
import { HelloWorldSecurityGroupConstruct } from '../constructs/security-groups';
import { VpcEndpointConstruct } from '../constructs/vpc-endpoints';
import { getTgwIdFromSsm } from '../common/ssm-refs';
import { applyTags, resourceName } from '../common/tags';

export interface NetworkStackProps extends cdk.StackProps {
  readonly environment: Environment;
  readonly config: EnvConfig;
  /** SecurityStack から渡されるアプリ共通 CMK ARN（Flow Logs 暗号化用）*/
  readonly appCommonCmkArn: string;
}

export class NetworkStack extends cdk.Stack {
  /** テナント VPC（他スタックへ渡す）*/
  public readonly vpc: ec2.CfnVPC;
  /** Public Subnet IDs */
  public readonly publicSubnetIds: string[];
  /** Private-App Subnet IDs */
  public readonly privateAppSubnetIds: string[];
  /** Private-Batch Subnet IDs */
  public readonly privateBatchSubnetIds: string[];
  /** Protected-Data Subnet IDs */
  public readonly protectedDataSubnetIds: string[];
  // セキュリティグループ（各スタックが参照）
  public readonly sgPublicAlb: ec2.CfnSecurityGroup;
  public readonly sgInternalAlb: ec2.CfnSecurityGroup;
  public readonly sgFargateApp: ec2.CfnSecurityGroup;
  public readonly sgBatchA: ec2.CfnSecurityGroup;
  public readonly sgBatchB: ec2.CfnSecurityGroup;
  public readonly sgBatchC: ec2.CfnSecurityGroup;

  constructor(scope: Construct, id: string, props: NetworkStackProps) {
    super(scope, id, props);

    const { environment, config: envConfig, appCommonCmkArn } = props;
    const tenantId = envConfig.tenantId;
    const name = (suffix: string) => resourceName(tenantId, suffix);

    // CMK 参照（SecurityStack から渡された ARN）
    const appCommonCmk = kms.Key.fromKeyArn(this, 'AppCommonCmk', appCommonCmkArn);

    // ---------- VPC / Subnet / RT / IGW / NAT GW / Flow Logs ----------
    // 対応: PARAM-001 §2〜8
    const vpcConstruct = new HelloWorldVpcConstruct(this, 'Vpc', {
      environment,
      config: envConfig,
      tenantId,
      appCommonCmk,
    });

    this.vpc = vpcConstruct.vpc;
    this.publicSubnetIds = vpcConstruct.publicSubnetIds;
    this.privateAppSubnetIds = vpcConstruct.privateAppSubnetIds;
    this.privateBatchSubnetIds = vpcConstruct.privateBatchSubnetIds;
    this.protectedDataSubnetIds = vpcConstruct.protectedDataSubnetIds;

    // ---------- Security Groups ----------
    // 対応: PARAM-001 §10
    const sgConstruct = new HelloWorldSecurityGroupConstruct(this, 'SecurityGroups', {
      environment,
      config: envConfig,
      tenantId,
      vpc: this.vpc,
    });

    this.sgPublicAlb = sgConstruct.sgPublicAlb;
    this.sgInternalAlb = sgConstruct.sgInternalAlb;
    this.sgFargateApp = sgConstruct.sgFargateApp;
    this.sgBatchA = sgConstruct.sgBatchA;
    this.sgBatchB = sgConstruct.sgBatchB;
    this.sgBatchC = sgConstruct.sgBatchC;

    // ---------- VPC Endpoints ----------
    // 対応: PARAM-001 §9
    // Gateway Endpoint の対象 RT: Private-App / Private-Batch / Protected-Data
    // NOTE: RT ID はスタック内で管理されているため、より詳細な実装では vpcConstruct から公開するか
    //       VpcEndpointConstruct に RT 作成を内包する設計も可能
    new VpcEndpointConstruct(this, 'VpcEndpoints', {
      environment,
      config: envConfig,
      tenantId,
      vpc: this.vpc,
      protectedDataSubnetIds: vpcConstruct.protectedDataSubnetIds,
      sgVpcEndpointId: sgConstruct.sgVpcEndpoint.ref,
      // S3 Gateway は Private-App / Private-Batch / Protected-Data の RT に追加
      // スケルトン: RT ID はダミー値（実装時は vpcConstruct から取得）
      gatewayRouteTableIds: [], // TODO: vpcConstruct から RT IDs を公開して渡す
      region: envConfig.region,
    });

    // ---------- NACL ----------
    // 対応: PARAM-001 §11
    // NACL-Public（PARAM-001 §11）
    const naclPublic = new ec2.CfnNetworkAcl(this, 'NaclPublic', {
      vpcId: this.vpc.ref,
      tags: [{ key: 'Name', value: name('nacl-public') }],
    });
    // In: 100 TCP 443 0.0.0.0/0 ALLOW
    new ec2.CfnNetworkAclEntry(this, 'NaclPublicIn100', {
      networkAclId: naclPublic.ref, ruleNumber: 100, protocol: 6,
      ruleAction: 'allow', egress: false,
      cidrBlock: '0.0.0.0/0',
      portRange: { from: 443, to: 443 },
    });
    // In: 110 TCP 80 0.0.0.0/0 ALLOW
    new ec2.CfnNetworkAclEntry(this, 'NaclPublicIn110', {
      networkAclId: naclPublic.ref, ruleNumber: 110, protocol: 6,
      ruleAction: 'allow', egress: false,
      cidrBlock: '0.0.0.0/0',
      portRange: { from: 80, to: 80 },
    });
    // In: 120 TCP 1024-65535 0.0.0.0/0 ALLOW（戻り）
    new ec2.CfnNetworkAclEntry(this, 'NaclPublicIn120', {
      networkAclId: naclPublic.ref, ruleNumber: 120, protocol: 6,
      ruleAction: 'allow', egress: false,
      cidrBlock: '0.0.0.0/0',
      portRange: { from: 1024, to: 65535 },
    });
    // Out: 200 TCP 443 0.0.0.0/0 ALLOW
    new ec2.CfnNetworkAclEntry(this, 'NaclPublicOut200', {
      networkAclId: naclPublic.ref, ruleNumber: 200, protocol: 6,
      ruleAction: 'allow', egress: true,
      cidrBlock: '0.0.0.0/0',
      portRange: { from: 443, to: 443 },
    });
    // Out: 210 TCP 1024-65535 0.0.0.0/0 ALLOW
    new ec2.CfnNetworkAclEntry(this, 'NaclPublicOut210', {
      networkAclId: naclPublic.ref, ruleNumber: 210, protocol: 6,
      ruleAction: 'allow', egress: true,
      cidrBlock: '0.0.0.0/0',
      portRange: { from: 1024, to: 65535 },
    });
    // Public Subnet に NACL を関連付け
    for (let i = 0; i < vpcConstruct.publicSubnetIds.length; i++) {
      new ec2.CfnSubnetNetworkAclAssociation(this, `NaclPublicAssoc${i}`, {
        subnetId: vpcConstruct.publicSubnetIds[i],
        networkAclId: naclPublic.ref,
      });
    }

    // NACL-Protected-Data（PARAM-001 §11 最も厳格：VPC 内のみ）
    const naclProtectedData = new ec2.CfnNetworkAcl(this, 'NaclProtectedData', {
      vpcId: this.vpc.ref,
      tags: [{ key: 'Name', value: name('nacl-protected-data') }],
    });
    new ec2.CfnNetworkAclEntry(this, 'NaclProtectedDataIn100', {
      networkAclId: naclProtectedData.ref, ruleNumber: 100, protocol: 6,
      ruleAction: 'allow', egress: false,
      cidrBlock: envConfig.vpcCidr,
      portRange: { from: 0, to: 65535 },
    });
    new ec2.CfnNetworkAclEntry(this, 'NaclProtectedDataOut200', {
      networkAclId: naclProtectedData.ref, ruleNumber: 200, protocol: 6,
      ruleAction: 'allow', egress: true,
      cidrBlock: envConfig.vpcCidr,
      portRange: { from: 0, to: 65535 },
    });
    for (let i = 0; i < vpcConstruct.protectedDataSubnetIds.length; i++) {
      new ec2.CfnSubnetNetworkAclAssociation(this, `NaclProtectedDataAssoc${i}`, {
        subnetId: vpcConstruct.protectedDataSubnetIds[i],
        networkAclId: naclProtectedData.ref,
      });
    }

    // ---------- TGW Attachment ----------
    // 対応: PARAM-001 §7
    // prod のみ。TGW ID は SSM から取得（自動適用層管理）
    if (envConfig.tgwAttach) {
      const tgwId = getTgwIdFromSsm(this, 'TgwId');
      new ec2.CfnTransitGatewayAttachment(this, 'TgwAttach', {
        transitGatewayId: tgwId,
        vpcId: this.vpc.ref,
        subnetIds: vpcConstruct.tgwAttachSubnetIds, // PARAM-001 §7
        options: {
          DnsSupport: 'enable',    // PARAM-001 §7 dns_support=enable
          Ipv6Support: 'disable',  // PARAM-001 §7 ipv6_support=disable
        },
        tags: [
          { key: 'Name', value: name('tgw-attach') },
          { key: 'compliance', value: 'ismap' },
        ],
      });
    }

    // ---------- Route53 Private Hosted Zone ----------
    // 対応: PARAM-001 §12
    const phz = new route53.CfnHostedZone(this, 'Phz', {
      name: `tenant-${tenantId.toLowerCase()}.internal.helloworld.go.jp`,
      vpcs: [{ vpcId: this.vpc.ref, vpcRegion: envConfig.region }],
      hostedZoneTags: [
        { key: 'Name', value: name('phz') },
        { key: 'tenant', value: tenantId },
      ],
    });

    // ---------- Output ----------
    new cdk.CfnOutput(this, 'VpcId', {
      value: this.vpc.ref,
      exportName: `${id}-VpcId`,
    });

    // 7 タグ適用
    applyTags(this, environment, tenantId);
  }
}
