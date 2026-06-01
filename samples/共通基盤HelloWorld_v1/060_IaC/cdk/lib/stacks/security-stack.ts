/**
 * lib/stacks/security-stack.ts
 * SecurityStack — KMS CMK / IAM Permission Boundary / Config Rules / GuardDuty / SecurityHub
 *
 * 対応 PARAM: PARAM-003 §2〜10
 * 作成: infra-iac
 * 作成日: 2026-06-01
 *
 * 重要: 自動適用層（CloudTrail Org Trail / Config Recorder / GuardDuty Org 有効化 /
 *       SecurityHub 委任管理）は本スタックに含めない。
 *       CDK は テナント Workloads 側の追加統制のみを定義する（PARAM-003 §1）。
 */

import * as cdk from 'aws-cdk-lib';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as kms from 'aws-cdk-lib/aws-kms';
import * as sns from 'aws-cdk-lib/aws-sns';
import * as snsSubscriptions from 'aws-cdk-lib/aws-sns-subscriptions';
import * as events from 'aws-cdk-lib/aws-events';
import * as eventsTargets from 'aws-cdk-lib/aws-events-targets';
import * as config from 'aws-cdk-lib/aws-config';
import { Construct } from 'constructs';
import { NagSuppressions } from 'cdk-nag';
import { Environment, EnvConfig } from '../common/config';
import { HelloWorldKmsConstruct } from '../constructs/kms';
import { applyTags, resourceName } from '../common/tags';

export interface SecurityStackProps extends cdk.StackProps {
  readonly environment: Environment;
  readonly config: EnvConfig;
}

export class SecurityStack extends cdk.Stack {
  /** テナント別データ CMK ARN（他スタックへ渡す）*/
  public readonly tenantDataCmkArn: string;
  /** アプリ共通 CMK ARN（他スタックへ渡す）*/
  public readonly appCommonCmkArn: string;
  /** セキュリティアラート SNS ARN */
  public readonly securityAlertsSnsArn: string;

  constructor(scope: Construct, id: string, props: SecurityStackProps) {
    super(scope, id, props);

    const { environment, config: envConfig } = props;
    const tenantId = envConfig.tenantId;

    // ---------- KMS CMK ----------
    // 対応: PARAM-003 §2
    const kmsConstruct = new HelloWorldKmsConstruct(this, 'Kms', {
      environment,
      config: envConfig,
      tenantId,
    });

    this.tenantDataCmkArn = kmsConstruct.tenantDataCmk.keyArn;
    this.appCommonCmkArn = kmsConstruct.appCommonCmk.keyArn;

    // ---------- IAM Permission Boundary ポリシー ----------
    // 対応: PARAM-003 §3
    // 各 PB は ManagedPolicy として作成し、各ロールの permissionsBoundary に設定する
    // スケルトン: PB-ServiceRole（最重要）のみ定義、他は同パターンで拡張
    const pbServiceRole = new iam.ManagedPolicy(this, 'PbServiceRole', {
      managedPolicyName: 'PB-ServiceRole',
      description: 'Permission Boundary for all workload service roles',
      statements: [
        // 許可: 具体的なサービス操作のみ
        new iam.PolicyStatement({
          effect: iam.Effect.ALLOW,
          actions: [
            's3:GetObject', 's3:PutObject', 's3:ListBucket',
            'sqs:SendMessage', 'sqs:ReceiveMessage', 'sqs:DeleteMessage', 'sqs:GetQueueAttributes',
            'kms:Decrypt', 'kms:GenerateDataKey', 'kms:DescribeKey',
            'logs:CreateLogStream', 'logs:PutLogEvents', 'logs:CreateLogGroup',
            'ecr:GetAuthorizationToken', 'ecr:BatchCheckLayerAvailability',
            'ecr:GetDownloadUrlForLayer', 'ecr:BatchGetImage',
            'ecs:DescribeServices', 'ecs:UpdateService',
            'batch:SubmitJob', 'batch:DescribeJobs',
            'lambda:InvokeFunction',
            'cloudwatch:GetMetricData', 'cloudwatch:DescribeAlarms',
            'application-autoscaling:*',
          ],
          resources: ['*'],
        }),
        // Deny: ガードレール改変・IAM/Org 管理操作（PARAM-003 §3）
        new iam.PolicyStatement({
          effect: iam.Effect.DENY,
          actions: [
            'iam:CreateUser', 'iam:DeleteUser',
            'iam:CreateGroup', 'iam:DeleteGroup',
            'iam:AttachRolePolicy', 'iam:DetachRolePolicy',
            'organizations:*',
            'cloudtrail:DeleteTrail', 'cloudtrail:StopLogging',
            'config:DeleteConfigRule', 'config:StopConfigurationRecorder',
            'guardduty:DeleteDetector', 'securityhub:DisableSecurityHub',
            'kms:ScheduleKeyDeletion', 'kms:DisableKey',
          ],
          resources: ['*'],
        }),
      ],
    });

    // cdk-nag Suppression: PB自体はワイルドカードを使用するが意図的（境界ポリシーとして）
    NagSuppressions.addResourceSuppressions(pbServiceRole, [
      {
        id: 'AwsSolutions-IAM5',
        reason: 'Permission Boundary policy intentionally uses wildcard — constrained by explicit Deny statements',
      },
    ]);

    // ---------- セキュリティアラート SNS トピック ----------
    // 対応: PARAM-003 §10
    const securityAlertsTopic = new sns.Topic(this, 'SecurityAlertsTopic', {
      topicName: 'helloworld-security-alerts',
      masterKey: kmsConstruct.appCommonCmk, // PARAM-003 §10 encryption
      displayName: 'HelloWorld Security Alerts',
    });

    // セキュリティチームへのメール通知（仮アドレス、実運用時に変更）
    securityAlertsTopic.addSubscription(
      new snsSubscriptions.EmailSubscription('security-team@example.go.jp'),
    );

    this.securityAlertsSnsArn = securityAlertsTopic.topicArn;

    // ---------- GuardDuty 高重要度 Findings 自動応答 ----------
    // 対応: PARAM-003 §6.2
    // Org 有効化は自動適用層。本スタックは Findings への自動応答のみ定義。
    const guarddutyHighRule = new events.Rule(this, 'GuardDutyHighSeverityRule', {
      ruleName: 'helloworld-guardduty-high-severity',
      description: 'GuardDuty High Severity findings notification',
      eventPattern: {
        source: ['aws.guardduty'],
        detailType: ['GuardDuty Finding'],
        detail: {
          severity: [{ numeric: ['>=', 7.0] }], // PARAM-003 §6.2 severity >= 7.0
        },
      },
      targets: [new eventsTargets.SnsTopic(securityAlertsTopic)],
    });

    // ---------- Config Rules（テナント Workloads 側）----------
    // 対応: PARAM-003 §5.1
    // 自動適用層の Config Recorder は既存前提。テナント側の追加 Rules のみ定義。
    // スケルトン: 代表的な 3 ルールを定義

    // IAM: インラインポリシー禁止（PARAM-003 §5.1 iam-inline-policy-blocked）
    new config.ManagedRule(this, 'ConfigRuleIamInlinePolicy', {
      identifier: config.ManagedRuleIdentifiers.IAM_NO_INLINE_POLICY_CHECK,
      configRuleName: 'iam-inline-policy-blocked',
    });

    // NW: SSH 制限（PARAM-003 §5.1 restricted-ssh、prod は自動修復）
    new config.ManagedRule(this, 'ConfigRuleRestrictedSsh', {
      identifier: config.ManagedRuleIdentifiers.INCOMING_SSH_DISABLED,
      configRuleName: 'restricted-ssh',
    });

    // Storage: S3 公開読み取り禁止（PARAM-003 §5.1 s3-bucket-public-read-prohibited）
    new config.ManagedRule(this, 'ConfigRuleS3PublicRead', {
      identifier: config.ManagedRuleIdentifiers.S3_BUCKET_PUBLIC_READ_PROHIBITED,
      configRuleName: 's3-bucket-public-read-prohibited',
    });

    // Storage: S3 サーバーサイド暗号化（PARAM-003 §5.1）
    new config.ManagedRule(this, 'ConfigRuleS3Encryption', {
      identifier: config.ManagedRuleIdentifiers.S3_BUCKET_SERVER_SIDE_ENCRYPTION_ENABLED,
      configRuleName: 's3-bucket-server-side-encryption-enabled',
    });

    // ---------- Output ----------
    new cdk.CfnOutput(this, 'TenantDataCmkArn', {
      value: this.tenantDataCmkArn,
      exportName: `${id}-TenantDataCmkArn`,
      description: 'Tenant data CMK ARN',
    });
    new cdk.CfnOutput(this, 'AppCommonCmkArn', {
      value: this.appCommonCmkArn,
      exportName: `${id}-AppCommonCmkArn`,
      description: 'App common CMK ARN',
    });
    new cdk.CfnOutput(this, 'SecurityAlertsSnsArn', {
      value: this.securityAlertsSnsArn,
      exportName: `${id}-SecurityAlertsSnsArn`,
      description: 'Security alerts SNS topic ARN',
    });

    // 7 タグ適用
    applyTags(this, environment, tenantId);
  }
}
