/**
 * lib/stacks/pattern-a-lambda-stack.ts
 * PatternALambdaStack — Lambda / EventBridge スケジュール / SQS DLQ / S3 成果物バケット / Alarms
 *
 * 対応 PARAM: PARAM-005 §2〜9
 * 作成: infra-iac
 * 作成日: 2026-06-01
 *
 * Phase3 引き継ぎ注意:
 *   - Lambda LogGroup は Lambda 自動作成前に CDK で先行作成して CMK 設定（PARAM-005 §2.3）
 *   - VPC Lambda の ENI は Private-Batch サブネットに払い出される（PARAM-005 §2.1）
 *   - reserved_concurrent_executions は環境別に設定（PARAM-005 §2 dev=5/stg=20/prod=100）
 */

import * as cdk from 'aws-cdk-lib';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as lambdaEventSources from 'aws-cdk-lib/aws-lambda-event-sources';
import * as events from 'aws-cdk-lib/aws-events';
import * as eventsTargets from 'aws-cdk-lib/aws-events-targets';
import * as sqs from 'aws-cdk-lib/aws-sqs';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as kms from 'aws-cdk-lib/aws-kms';
import * as logs from 'aws-cdk-lib/aws-logs';
import * as cloudwatch from 'aws-cdk-lib/aws-cloudwatch';
import * as cwActions from 'aws-cdk-lib/aws-cloudwatch-actions';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as sns from 'aws-cdk-lib/aws-sns';
import { Construct } from 'constructs';
import { NagSuppressions } from 'cdk-nag';
import { Environment, EnvConfig } from '../common/config';
import { applyTags, patternResourceName, resourceName } from '../common/tags';

export interface PatternALambdaStackProps extends cdk.StackProps {
  readonly environment: Environment;
  readonly config: EnvConfig;
  readonly vpc: ec2.CfnVPC;
  readonly sgBatchA: ec2.CfnSecurityGroup;
  readonly privateBatchSubnetIds: string[];
  readonly appCommonCmkArn: string;
  readonly tenantDataCmkArn: string;
  readonly appAlertsSnsArn: string;
}

export class PatternALambdaStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: PatternALambdaStackProps) {
    super(scope, id, props);

    const { environment, config: envConfig } = props;
    const tenantId = envConfig.tenantId;
    const pName = (r: string) => patternResourceName(tenantId, r, 'A');
    const name = (r: string) => resourceName(tenantId, r);

    const appCommonCmk = kms.Key.fromKeyArn(this, 'AppCommonCmk', props.appCommonCmkArn);
    const tenantDataCmk = kms.Key.fromKeyArn(this, 'TenantDataCmk', props.tenantDataCmkArn);
    const appAlertsTopic = sns.Topic.fromTopicArn(this, 'AppAlerts', props.appAlertsSnsArn);
    const alarmAction = new cwActions.SnsAction(appAlertsTopic);

    // ---------- Lambda LogGroup（先行作成）----------
    // 対応: PARAM-005 §2.3
    // Phase3 注意: Lambda 自動作成より先に CDK で作成して CMK を設定
    const lambdaLogGroup = new logs.LogGroup(this, 'LambdaLogGroup', {
      logGroupName: `/aws/lambda/helloworld-tenant-${tenantId}-batch-pattern-A`,
      retention: envConfig.logsRetentionDays as logs.RetentionDays,
      encryptionKey: appCommonCmk, // PARAM-005 §2.3 kms_key_id
      removalPolicy: cdk.RemovalPolicy.RETAIN,
    });

    // ---------- SQS DLQ ----------
    // 対応: PARAM-005 §4
    const dlq = new sqs.Queue(this, 'Dlq', {
      queueName: pName('dlq'),
      visibilityTimeout: cdk.Duration.seconds(300), // PARAM-005 §4 Lambda timeout と同等
      retentionPeriod: cdk.Duration.seconds(
        envConfig.albDeletionProtection ? 1209600 : 86400, // prod=14日, dev=1日
      ),
      encryptionMasterKey: tenantDataCmk, // PARAM-005 §4 テナント別データ CMK
      receiveMessageWaitTime: cdk.Duration.seconds(20), // PARAM-005 §4 Long Polling
    });

    // ---------- S3 成果物バケット ----------
    // 対応: PARAM-005 §7
    const outputBucket = new s3.Bucket(this, 'OutputBucket', {
      bucketName: name('output'),
      versioned: true,                              // PARAM-005 §7
      encryptionKey: tenantDataCmk,                 // PARAM-005 §7 SSE-KMS テナント別 CMK
      encryption: s3.BucketEncryption.KMS,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL, // PARAM-005 §7
      enforceSSL: true,                             // PARAM-005 §7 TLS 強制
      removalPolicy: cdk.RemovalPolicy.RETAIN,
      lifecycleRules: [
        {
          id: 'PatternALifecycle',
          prefix: 'pattern-A/',
          transitions: [
            // PARAM-005 §7: 30日後 S3-IA
            { storageClass: s3.StorageClass.INFREQUENT_ACCESS, transitionAfter: cdk.Duration.days(30) },
            // 90日後 Glacier Instant
            { storageClass: s3.StorageClass.GLACIER_INSTANT_RETRIEVAL, transitionAfter: cdk.Duration.days(90) },
          ],
        },
      ],
    });

    // ---------- IAM ロール（lambdaExecRole-A）----------
    // 対応: PARAM-005 §6
    const lambdaExecRole = new iam.Role(this, 'LambdaExecRole', {
      roleName: `lambdaExecRole-A-tenant-${tenantId}`,
      assumedBy: new iam.ServicePrincipal('lambda.amazonaws.com'),
      managedPolicies: [
        // PARAM-005 §6: VPC ENI 作成権限含む
        iam.ManagedPolicy.fromAwsManagedPolicyName('service-role/AWSLambdaVPCAccessExecutionRole'),
      ],
    });
    // S3 出力権限（テナント条件付き）
    lambdaExecRole.addToPolicy(new iam.PolicyStatement({
      actions: ['s3:PutObject'],
      resources: [`${outputBucket.bucketArn}/pattern-A/*`],
      conditions: { StringEquals: { 'aws:ResourceTag/tenant': tenantId } },
    }));
    // SQS DLQ 送信
    lambdaExecRole.addToPolicy(new iam.PolicyStatement({
      actions: ['sqs:SendMessage'],
      resources: [dlq.queueArn],
    }));
    // KMS
    tenantDataCmk.grantEncryptDecrypt(lambdaExecRole);
    appCommonCmk.grantDecrypt(lambdaExecRole);
    // ログ
    lambdaExecRole.addToPolicy(new iam.PolicyStatement({
      actions: ['logs:CreateLogStream', 'logs:PutLogEvents'],
      resources: [lambdaLogGroup.logGroupArn],
    }));

    NagSuppressions.addResourceSuppressions(lambdaExecRole, [
      { id: 'AwsSolutions-IAM5', reason: 'Scoped to tenant prefix and specific ARNs' },
    ]);

    // ---------- Lambda 関数 ----------
    // 対応: PARAM-005 §2
    // Phase3 注意: コードは S3 デプロイ前提（QA-102 仮定）。ECR コンテナ採用時は変更。
    const reservedConcurrency = envConfig.albDeletionProtection ? 100
      : (environment === 'stg' ? 20 : 5);

    const lambdaFn = new lambda.Function(this, 'LambdaFunction', {
      functionName: pName('lambda'),
      description: 'Hello World batch function - Pattern A Lambda',
      runtime: lambda.Runtime.JAVA_21,              // PARAM-005 §2 runtime=java21
      handler: 'com.example.HelloWorldHandler::handleRequest', // PARAM-005 §2
      // コードは S3 バケットから参照（プレースホルダ）
      // 実際の実装では lambda.Code.fromBucket() を使用
      code: lambda.Code.fromInline(
        // スケルトン: インラインコード（実際は S3 or ECR）
        'exports.handler = async () => ({ statusCode: 200, body: "Hello World - Pattern A" });',
      ),
      timeout: cdk.Duration.seconds(envConfig.albDeletionProtection ? 300 : 30), // PARAM-005 §2
      memorySize: envConfig.albDeletionProtection ? 512 : 256,  // PARAM-005 §2
      ephemeralStorageSize: cdk.Size.mebibytes(512),            // PARAM-005 §2 ephemeral_storage=512MB
      role: lambdaExecRole,
      vpc: ec2.Vpc.fromVpcAttributes(this, 'Vpc', {
        vpcId: props.vpc.ref,
        availabilityZones: ['ap-northeast-1a', 'ap-northeast-1c'],
        privateSubnetIds: props.privateBatchSubnetIds,
      }),
      vpcSubnets: { subnets: props.privateBatchSubnetIds.map((sid, i) =>
        ec2.Subnet.fromSubnetId(this, `BatchSubnet${i}`, sid)) },
      securityGroups: [
        ec2.SecurityGroup.fromSecurityGroupId(this, 'SgBatchA', props.sgBatchA.ref),
      ],
      reservedConcurrentExecutions: reservedConcurrency, // PARAM-005 §2
      environmentEncryption: appCommonCmk,              // PARAM-005 §2 kms_key_arn（環境変数暗号化）
      environment: {
        TENANT_ID: tenantId,
        S3_OUTPUT_BUCKET: outputBucket.bucketName,
        S3_OUTPUT_PREFIX: 'pattern-A/',
        DLQ_URL: dlq.queueUrl,
        LOG_LEVEL: envConfig.albDeletionProtection ? 'INFO' : 'DEBUG',
      },
      deadLetterQueue: dlq, // PARAM-005 §4
      logGroup: lambdaLogGroup,
    });

    // cdk-nag: Java21 Lambda は VPC 外でも動作させる場合のルールは今回不要（VPC 内配置）
    NagSuppressions.addResourceSuppressions(lambdaFn, [
      { id: 'AwsSolutions-L1', reason: 'Java 21 is the latest LTS runtime' },
    ]);

    // ---------- EventBridge スケジュールルール ----------
    // 対応: PARAM-005 §3
    const scheduleRule = new events.Rule(this, 'ScheduleRule', {
      ruleName: pName('schedule'),
      description: 'Pattern A Lambda schedule trigger',
      schedule: envConfig.albDeletionProtection
        ? events.Schedule.rate(cdk.Duration.minutes(5))   // prod: 5分毎（PARAM-005 §3）
        : events.Schedule.rate(cdk.Duration.minutes(60)), // dev: 60分毎
      enabled: envConfig.albDeletionProtection, // dev は DISABLED（PARAM-005 §3）
      targets: [
        new eventsTargets.LambdaFunction(lambdaFn, {
          event: events.RuleTargetInput.fromObject({
            tenant: tenantId,
            pattern: 'A',
          }),
        }),
      ],
    });

    // ---------- CloudWatch アラーム（パターン A 固有）----------
    // 対応: PARAM-005 §8
    new cloudwatch.Alarm(this, 'LambdaErrors', {
      alarmName: `${name('A-lambda-errors')}`,
      metric: lambdaFn.metricErrors({ period: cdk.Duration.minutes(1) }),
      threshold: 3,
      evaluationPeriods: 1,
      comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_OR_EQUAL_TO_THRESHOLD,
      treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
    }).addAlarmAction(alarmAction);

    new cloudwatch.Alarm(this, 'LambdaThrottles', {
      alarmName: `${name('A-lambda-throttles')}`,
      metric: lambdaFn.metricThrottles({ period: cdk.Duration.minutes(1) }),
      threshold: 1,
      evaluationPeriods: 1,
      comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_THRESHOLD,
      treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
    }).addAlarmAction(alarmAction);

    new cloudwatch.Alarm(this, 'DlqDepth', {
      alarmName: `${name('A-dlq-depth')}`,
      metric: dlq.metricApproximateNumberOfMessagesVisible({ period: cdk.Duration.minutes(5) }),
      threshold: 1,
      evaluationPeriods: 1,
      comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_OR_EQUAL_TO_THRESHOLD,
      treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
    }).addAlarmAction(alarmAction);

    new cloudwatch.Alarm(this, 'LambdaDuration', {
      alarmName: `${name('A-lambda-duration')}`,
      metric: lambdaFn.metricDuration({ period: cdk.Duration.minutes(5), statistic: 'p99' }),
      threshold: 200000, // PARAM-005 §8 200,000ms（300秒の2/3）
      evaluationPeriods: 1,
      comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_THRESHOLD,
      treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
    }).addAlarmAction(alarmAction);

    // ---------- Output ----------
    new cdk.CfnOutput(this, 'LambdaFunctionArn', {
      value: lambdaFn.functionArn,
      exportName: `${id}-LambdaFunctionArn`,
    });

    // 7 タグ適用（pattern='lambda'）
    applyTags(this, environment, tenantId, 'A');
  }
}
