/**
 * lib/common/ssm-refs.ts
 * 自動適用層リソースの SSM Parameter Store 参照ヘルパー
 *
 * 対応: PARAM-001 §7（TGW ID の SSM 参照）
 *       gc-iac-best-practices「GCテンプレートとの共存」原則
 *
 * 重要: 自動適用層（Security Base / Network Base）が管理するリソース
 * （TGW、Hub VPC、CloudTrail Org Trail、Config Recorder 等）は
 * CDK で直接作成・変更してはならない。
 * SSM Parameter Store 経由で参照のみ行う（Import 参照方式）。
 *
 * 作成: infra-iac
 * 作成日: 2026-06-01
 */

import * as ssm from 'aws-cdk-lib/aws-ssm';
import { Construct } from 'constructs';

/** 自動適用層リソースの SSM パラメーターパス定義 */
export const SSM_PATHS = {
  /** Transit Gateway ID（PARAM-001 §7）*/
  tgwId: '/helloworld/network/tgw-id',
  /** Network Hub VPC ID（参照のみ）*/
  hubVpcId: '/helloworld/network/hub-vpc-id',
  /** Log Archive S3 バケット（Config / CloudTrail 配信先） */
  logArchiveBucket: '/helloworld/security/log-archive-bucket',
  /** GuardDuty Delegated Admin Account ID */
  guarddutyAdminAccountId: '/helloworld/security/guardduty-admin-account-id',
  /** アプリ共通 CMK ARN（PARAM-003 §2.2）*/
  appCommonCmkArn: '/helloworld/security/app-common-cmk-arn',
} as const;

/**
 * TGW ID を SSM から取得する（PARAM-001 §7）。
 * prod のみ TGW アタッチを行うため、tgwAttach=false の場合は呼ばない。
 */
export function getTgwIdFromSsm(scope: Construct, id: string): string {
  return ssm.StringParameter.valueForStringParameter(scope, SSM_PATHS.tgwId);
}

/**
 * アプリ共通 CMK ARN を SSM から取得する（PARAM-003 §2.2）。
 * security-stack で CMK を作成し、この SSM パスに出力する。
 * 他スタックからは当関数で参照のみ。
 */
export function getAppCommonCmkArnFromSsm(scope: Construct, id: string): string {
  return ssm.StringParameter.valueForStringParameter(scope, SSM_PATHS.appCommonCmkArn);
}
