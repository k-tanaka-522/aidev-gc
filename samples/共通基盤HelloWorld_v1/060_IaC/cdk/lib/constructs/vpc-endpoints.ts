/**
 * lib/constructs/vpc-endpoints.ts
 * VpcEndpointConstruct — Gateway / Interface 型 VPC Endpoint 一括定義
 *
 * 対応 PARAM: PARAM-001 §9
 * 作成: infra-iac
 * 作成日: 2026-06-01
 *
 * 設計ポイント:
 *   - Gateway 型: S3（全パターン共通、PARAM-001 §9.1）
 *   - Interface 型: ecr-api / ecr-dkr / logs / sqs / batch / sts / ssm 等
 *     ENI は Protected-Data サブネット（1a / 1c）に配置（PARAM-001 §9.2）
 *   - private_dns_enabled=true で AWS FQDN を VPC 内解決
 *   - batch Endpoint はパターン B のみ必要（PARAM-001 §9.2）
 */

import * as cdk from 'aws-cdk-lib';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import { Construct } from 'constructs';
import { Environment, EnvConfig } from '../common/config';
import { applyTags, resourceName } from '../common/tags';

export interface VpcEndpointProps {
  readonly environment: Environment;
  readonly config: EnvConfig;
  readonly tenantId: string;
  /** テナント VPC */
  readonly vpc: ec2.CfnVPC;
  /** Protected-Data サブネット IDs（ENI 配置先）*/
  readonly protectedDataSubnetIds: string[];
  /** VPC Endpoint 用 SG */
  readonly sgVpcEndpointId: string;
  /** Private-App / Batch / Protected-Data ルートテーブル ID リスト（S3 Gateway 追加対象） */
  readonly gatewayRouteTableIds: string[];
  /** リージョン（PARAM-001 §9.2 サービス名のリージョン部分） */
  readonly region: string;
}

export class VpcEndpointConstruct extends Construct {
  constructor(scope: Construct, id: string, props: VpcEndpointProps) {
    super(scope, id);

    const { environment, config, tenantId, vpc, protectedDataSubnetIds,
            sgVpcEndpointId, gatewayRouteTableIds, region } = props;
    const name = (suffix: string) => resourceName(tenantId, suffix);

    // ---------- Gateway 型 VPC Endpoint ----------
    // 対応: PARAM-001 §9.1
    // S3 Gateway Endpoint — Private-App / Private-Batch / Protected-Data の RT に追加
    new ec2.CfnVPCEndpoint(this, 'S3GatewayEndpoint', {
      vpcId: vpc.ref,
      serviceName: `com.amazonaws.${region}.s3`,
      vpcEndpointType: 'Gateway',
      routeTableIds: gatewayRouteTableIds,
    });

    // ---------- Interface 型 VPC Endpoint 共通設定 ----------
    // 対応: PARAM-001 §9.2
    // ENI は Protected-Data サブネット（1a / 1c）、private_dns_enabled=true
    const interfaceEndpoints: Array<{ service: string; includePatterns: string[] }> = [
      { service: 'ecr.api',       includePatterns: ['B', 'C', 'online'] }, // PARAM-001 §9.2
      { service: 'ecr.dkr',       includePatterns: ['B', 'C', 'online'] },
      { service: 'logs',           includePatterns: ['all'] },      // 全パターン共通
      { service: 'sqs',            includePatterns: ['A', 'C'] },   // A=DLQ, C=主路
      { service: 'batch',          includePatterns: ['B'] },         // パターン B のみ
      { service: 'sts',            includePatterns: ['all'] },       // 全パターン共通
      { service: 'ssm',            includePatterns: ['all'] },       // 全パターン共通
      { service: 'ssmmessages',    includePatterns: ['all'] },
      { service: 'ec2messages',    includePatterns: ['all'] },
      { service: 'monitoring',     includePatterns: ['all'] },       // 特に C（PARAM-001 §9.2）
      { service: 'kms',            includePatterns: ['all'] },       // 全パターン共通
    ];

    for (const ep of interfaceEndpoints) {
      new ec2.CfnVPCEndpoint(this, `IfEp-${ep.service.replace('.', '-')}`, {
        vpcId: vpc.ref,
        serviceName: `com.amazonaws.${region}.${ep.service}`,
        vpcEndpointType: 'Interface',
        subnetIds: protectedDataSubnetIds, // Protected-Data 1a/1c（PARAM-001 §9.2）
        securityGroupIds: [sgVpcEndpointId],
        privateDnsEnabled: true, // PARAM-001 §9.2 private_dns_enabled=true
        tags: [
          { key: 'Name', value: name(`ep-${ep.service.replace('.', '-')}`) },
          { key: 'compliance', value: 'ismap' },
        ],
      });
    }

    // 7 タグ適用
    applyTags(this, environment, tenantId);
  }
}
