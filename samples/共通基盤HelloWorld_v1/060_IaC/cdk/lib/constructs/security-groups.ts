/**
 * lib/constructs/security-groups.ts
 * HelloWorldSecurityGroupConstruct — 全 SG 一括定義
 *
 * 対応 PARAM: PARAM-001 §10（sg-public-alb / sg-internal-alb / sg-fargate-app
 *             sg-batch-common / sg-vpc-endpoint / sg-tgw-attach）
 *             PARAM-005 §5（sg-batch-A）
 *             PARAM-006 §6（sg-batch-B）
 *             PARAM-007 §7（sg-batch-C）
 * 作成: infra-iac
 * 作成日: 2026-06-01
 *
 * 設計ポイント:
 *   - 全 SG を 1 Construct にまとめ、SG 間参照を安全に解決する
 *   - CloudFront マネージドプレフィックスリストを使用（com.amazonaws.global.cloudfront.origin-facing）
 *   - NACL は NetworkStack で別途定義
 */

import * as cdk from 'aws-cdk-lib';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import { Construct } from 'constructs';
import { Environment, EnvConfig } from '../common/config';
import { applyTags, resourceName } from '../common/tags';

export interface HelloWorldSecurityGroupProps {
  readonly environment: Environment;
  readonly config: EnvConfig;
  readonly tenantId: string;
  /** テナント VPC */
  readonly vpc: ec2.CfnVPC;
}

export class HelloWorldSecurityGroupConstruct extends Construct {
  /** 公開 ALB 用 SG（PARAM-001 §10 sg-public-alb） */
  public readonly sgPublicAlb: ec2.CfnSecurityGroup;
  /** 内部 ALB 用 SG（PARAM-001 §10 sg-internal-alb） */
  public readonly sgInternalAlb: ec2.CfnSecurityGroup;
  /** ECS Fargate App 用 SG（PARAM-001 §10 sg-fargate-app） */
  public readonly sgFargateApp: ec2.CfnSecurityGroup;
  /** バッチ共通骨子 SG（PARAM-001 §10 sg-batch-common） */
  public readonly sgBatchCommon: ec2.CfnSecurityGroup;
  /** パターン A 専用 SG（PARAM-005 §5 sg-batch-A） */
  public readonly sgBatchA: ec2.CfnSecurityGroup;
  /** パターン B 専用 SG（PARAM-006 §6 sg-batch-B） */
  public readonly sgBatchB: ec2.CfnSecurityGroup;
  /** パターン C 専用 SG（PARAM-007 §7 sg-batch-C） */
  public readonly sgBatchC: ec2.CfnSecurityGroup;
  /** VPC Endpoint 用 SG（PARAM-001 §10 sg-vpc-endpoint） */
  public readonly sgVpcEndpoint: ec2.CfnSecurityGroup;
  /** TGW Attach 用 SG（PARAM-001 §10 sg-tgw-attach） */
  public readonly sgTgwAttach: ec2.CfnSecurityGroup;

  constructor(scope: Construct, id: string, props: HelloWorldSecurityGroupProps) {
    super(scope, id);

    const { environment, config, tenantId, vpc } = props;
    const name = (suffix: string) => resourceName(tenantId, suffix);
    const vpcId = vpc.ref;
    const vpcCidr = config.vpcCidr; // 10.20.0.0/16

    // CloudFront マネージドプレフィックスリスト ID（東京リージョン）
    // 対応: PARAM-001 §10 sg-public-alb In 443 CloudFront prefix list
    // 実際の pl-xxx ID は SSM 参照または環境変数から取得するが、スケルトンでは定数を使用
    const cfPrefixListId = 'pl-58a04531'; // ap-northeast-1 の CloudFront Origin プレフィックスリスト（要確認）

    // ---------- sg-vpc-endpoint ----------
    // 対応: PARAM-001 §10 sg-vpc-endpoint（先に作成して他 SG から参照）
    this.sgVpcEndpoint = new ec2.CfnSecurityGroup(this, 'SgVpcEndpoint', {
      groupName: name('sg-vpc-endpoint'),
      groupDescription: 'VPC Interface Endpoint SG',
      vpcId,
      securityGroupIngress: [
        // PARAM-001 §10 In: TCP 443 VPC内全サブネット（10.20.0.0/16）
        {
          ipProtocol: 'tcp',
          fromPort: 443,
          toPort: 443,
          cidrIp: vpcCidr,
          description: 'HTTPS from VPC',
        },
      ],
      // Egress はデフォルト（Stateful 戻りのみ）
      tags: [{ key: 'Name', value: name('sg-vpc-endpoint') }],
    });

    // ---------- sg-public-alb ----------
    // 対応: PARAM-001 §10 sg-public-alb
    this.sgPublicAlb = new ec2.CfnSecurityGroup(this, 'SgPublicAlb', {
      groupName: name('sg-public-alb'),
      groupDescription: 'Public ALB SG — HTTPS from CloudFront only',
      vpcId,
      securityGroupIngress: [
        // PARAM-001 §10 In: TCP 443 CloudFront Prefix List
        {
          ipProtocol: 'tcp',
          fromPort: 443,
          toPort: 443,
          sourcePrefixListId: cfPrefixListId,
          description: 'HTTPS from CloudFront',
        },
      ],
      tags: [{ key: 'Name', value: name('sg-public-alb') }],
    });

    // ---------- sg-internal-alb ----------
    // 対応: PARAM-001 §10 sg-internal-alb
    this.sgInternalAlb = new ec2.CfnSecurityGroup(this, 'SgInternalAlb', {
      groupName: name('sg-internal-alb'),
      groupDescription: 'Internal ALB SG — HTTPS from intra-agency CIDR',
      vpcId,
      securityGroupIngress: [
        // PARAM-001 §10 In: TCP 443 庁内 CIDR 192.168.0.0/16
        {
          ipProtocol: 'tcp',
          fromPort: 443,
          toPort: 443,
          cidrIp: '192.168.0.0/16',
          description: 'HTTPS from intra-agency',
        },
      ],
      tags: [{ key: 'Name', value: name('sg-internal-alb') }],
    });

    // ---------- sg-fargate-app ----------
    // 対応: PARAM-001 §10 sg-fargate-app
    this.sgFargateApp = new ec2.CfnSecurityGroup(this, 'SgFargateApp', {
      groupName: name('sg-fargate-app'),
      groupDescription: 'ECS Fargate App SG',
      vpcId,
      securityGroupIngress: [
        // PARAM-001 §10 In: TCP 8080 from sg-public-alb
        {
          ipProtocol: 'tcp',
          fromPort: 8080,
          toPort: 8080,
          sourceSecurityGroupId: this.sgPublicAlb.ref,
          description: 'App port from Public ALB',
        },
        // PARAM-001 §10 In: TCP 8080 from sg-internal-alb
        {
          ipProtocol: 'tcp',
          fromPort: 8080,
          toPort: 8080,
          sourceSecurityGroupId: this.sgInternalAlb.ref,
          description: 'App port from Internal ALB',
        },
      ],
      securityGroupEgress: [
        // PARAM-001 §10 Out: TCP 443 → sg-vpc-endpoint
        {
          ipProtocol: 'tcp',
          fromPort: 443,
          toPort: 443,
          destinationSecurityGroupId: this.sgVpcEndpoint.ref,
          description: 'HTTPS to VPC Endpoint',
        },
        // PARAM-001 §10 Out: TCP 443 → S3 Prefix List（S3 Gateway）
        // S3 プレフィックスリスト（pl-61a54008 for ap-northeast-1）
        {
          ipProtocol: 'tcp',
          fromPort: 443,
          toPort: 443,
          destinationPrefixListId: 'pl-61a54008',
          description: 'HTTPS to S3 Gateway Endpoint',
        },
      ],
      tags: [{ key: 'Name', value: name('sg-fargate-app') }],
    });

    // ---------- sg-batch-common（骨子） ----------
    // 対応: PARAM-001 §10 sg-batch-common
    this.sgBatchCommon = new ec2.CfnSecurityGroup(this, 'SgBatchCommon', {
      groupName: name('sg-batch-common'),
      groupDescription: 'Batch common SG base',
      vpcId,
      securityGroupIngress: [], // In なし
      securityGroupEgress: [
        {
          ipProtocol: 'tcp',
          fromPort: 443,
          toPort: 443,
          destinationSecurityGroupId: this.sgVpcEndpoint.ref,
          description: 'HTTPS to VPC Endpoint',
        },
        {
          ipProtocol: 'tcp',
          fromPort: 443,
          toPort: 443,
          destinationPrefixListId: 'pl-61a54008',
          description: 'HTTPS to S3 Gateway Endpoint',
        },
      ],
      tags: [{ key: 'Name', value: name('sg-batch-common') }],
    });

    // ---------- sg-batch-A ----------
    // 対応: PARAM-005 §5（sg-batch-common と同一ルール）
    this.sgBatchA = new ec2.CfnSecurityGroup(this, 'SgBatchA', {
      groupName: name('sg-batch-A'),
      groupDescription: 'Pattern A Lambda SG',
      vpcId,
      securityGroupIngress: [],
      securityGroupEgress: [
        {
          ipProtocol: 'tcp',
          fromPort: 443,
          toPort: 443,
          destinationSecurityGroupId: this.sgVpcEndpoint.ref,
          description: 'HTTPS to VPC Endpoint (Logs/STS/KMS/SQS)',
        },
        {
          ipProtocol: 'tcp',
          fromPort: 443,
          toPort: 443,
          destinationPrefixListId: 'pl-61a54008',
          description: 'HTTPS to S3 Gateway Endpoint',
        },
      ],
      tags: [{ key: 'Name', value: name('sg-batch-A') }],
    });

    // ---------- sg-batch-B ----------
    // 対応: PARAM-006 §6（ECR/Batch Endpoint への経路を含む）
    this.sgBatchB = new ec2.CfnSecurityGroup(this, 'SgBatchB', {
      groupName: name('sg-batch-B'),
      groupDescription: 'Pattern B Batch SG',
      vpcId,
      securityGroupIngress: [],
      securityGroupEgress: [
        {
          ipProtocol: 'tcp',
          fromPort: 443,
          toPort: 443,
          destinationSecurityGroupId: this.sgVpcEndpoint.ref,
          description: 'HTTPS to VPC Endpoint (ECR/Batch/Logs/S3/STS/Monitoring/KMS)',
        },
        {
          ipProtocol: 'tcp',
          fromPort: 443,
          toPort: 443,
          destinationPrefixListId: 'pl-61a54008',
          description: 'HTTPS to S3 Gateway Endpoint',
        },
      ],
      tags: [{ key: 'Name', value: name('sg-batch-B') }],
    });

    // ---------- sg-batch-C ----------
    // 対応: PARAM-007 §7（SQS/ECR Endpoint への経路を含む）
    this.sgBatchC = new ec2.CfnSecurityGroup(this, 'SgBatchC', {
      groupName: name('sg-batch-C'),
      groupDescription: 'Pattern C SQS+Fargate Worker SG',
      vpcId,
      securityGroupIngress: [],
      securityGroupEgress: [
        {
          ipProtocol: 'tcp',
          fromPort: 443,
          toPort: 443,
          destinationSecurityGroupId: this.sgVpcEndpoint.ref,
          description: 'HTTPS to VPC Endpoint (SQS/ECR/Logs/STS/Monitoring/KMS)',
        },
        {
          ipProtocol: 'tcp',
          fromPort: 443,
          toPort: 443,
          destinationPrefixListId: 'pl-61a54008',
          description: 'HTTPS to S3 Gateway Endpoint',
        },
      ],
      tags: [{ key: 'Name', value: name('sg-batch-C') }],
    });

    // ---------- sg-tgw-attach ----------
    // 対応: PARAM-001 §10 sg-tgw-attach
    this.sgTgwAttach = new ec2.CfnSecurityGroup(this, 'SgTgwAttach', {
      groupName: name('sg-tgw-attach'),
      groupDescription: 'TGW Attachment SG',
      vpcId,
      securityGroupIngress: [
        {
          ipProtocol: '-1',
          cidrIp: '192.168.0.0/16',
          description: 'All traffic from intra-agency CIDR',
        },
      ],
      securityGroupEgress: [
        {
          ipProtocol: '-1',
          cidrIp: vpcCidr,
          description: 'All traffic to VPC',
        },
      ],
      tags: [{ key: 'Name', value: name('sg-tgw-attach') }],
    });

    // ALB から Fargate App への Egress ルールを後付け（SG 相互参照のため）
    new ec2.CfnSecurityGroupEgress(this, 'SgPublicAlbEgress', {
      groupId: this.sgPublicAlb.ref,
      ipProtocol: 'tcp',
      fromPort: 8080,
      toPort: 8080,
      destinationSecurityGroupId: this.sgFargateApp.ref,
      description: 'App port to Fargate',
    });
    new ec2.CfnSecurityGroupEgress(this, 'SgInternalAlbEgress', {
      groupId: this.sgInternalAlb.ref,
      ipProtocol: 'tcp',
      fromPort: 8080,
      toPort: 8080,
      destinationSecurityGroupId: this.sgFargateApp.ref,
      description: 'App port to Fargate',
    });

    // 7 タグ適用
    applyTags(this, environment, tenantId);
  }
}
