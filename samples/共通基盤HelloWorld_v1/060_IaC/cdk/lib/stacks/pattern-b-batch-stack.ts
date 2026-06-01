/**
 * lib/stacks/pattern-b-batch-stack.ts
 * PatternBBatchStack — AWS Batch CE / Job Queue / Job Definition / ECR / Alarms
 *
 * 対応 PARAM: PARAM-006 §2〜12
 * 作成: infra-iac
 * 作成日: 2026-06-01
 *
 * Phase3 引き継ぎ注意:
 *   - AWS Batch に CDK L2 が存在しないため L1 (CfnComputeEnvironment等) を使用（CDK設計書 §3.2）
 *   - Fargate CE 推奨（PARAM-006 §1 dev/stg/prod 共に FARGATE）
 *   - EC2 CE は大規模バッチ要件確定時のみ採用（PARAM-006 §2.1 参考記載）
 *   - ECR Endpoint（ecr-api / ecr-dkr）は NetworkStack で作成済み（PARAM-001 §9.2）
 *   - Batch Endpoint も NetworkStack で作成済み（PARAM-001 §9.2 batch は B のみ）
 */

import * as cdk from 'aws-cdk-lib';
import * as batch from 'aws-cdk-lib/aws-batch';
import * as ecr from 'aws-cdk-lib/aws-ecr';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as kms from 'aws-cdk-lib/aws-kms';
import * as logs from 'aws-cdk-lib/aws-logs';
import * as cloudwatch from 'aws-cdk-lib/aws-cloudwatch';
import * as cwActions from 'aws-cdk-lib/aws-cloudwatch-actions';
import * as events from 'aws-cdk-lib/aws-events';
import * as eventsTargets from 'aws-cdk-lib/aws-events-targets';
import * as sns from 'aws-cdk-lib/aws-sns';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import { Construct } from 'constructs';
import { NagSuppressions } from 'cdk-nag';
import { Environment, EnvConfig } from '../common/config';
import { applyTags, patternResourceName, resourceName } from '../common/tags';

export interface PatternBBatchStackProps extends cdk.StackProps {
  readonly environment: Environment;
  readonly config: EnvConfig;
  readonly vpc: ec2.CfnVPC;
  readonly sgBatchB: ec2.CfnSecurityGroup;
  readonly privateBatchSubnetIds: string[];
  readonly appCommonCmkArn: string;
  readonly tenantDataCmkArn: string;
  readonly appAlertsSnsArn: string;
}

export class PatternBBatchStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: PatternBBatchStackProps) {
    super(scope, id, props);

    const { environment, config: envConfig } = props;
    const tenantId = envConfig.tenantId;
    const pName = (r: string) => patternResourceName(tenantId, r, 'B');
    const name = (r: string) => resourceName(tenantId, r);

    const appCommonCmk = kms.Key.fromKeyArn(this, 'AppCommonCmk', props.appCommonCmkArn);
    const tenantDataCmk = kms.Key.fromKeyArn(this, 'TenantDataCmk', props.tenantDataCmkArn);
    const appAlertsTopic = sns.Topic.fromTopicArn(this, 'AppAlerts', props.appAlertsSnsArn);
    const alarmAction = new cwActions.SnsAction(appAlertsTopic);

    // ---------- Batch ログ グループ（先行作成）----------
    // 対応: PARAM-006 §9
    const batchLogGroup = new logs.LogGroup(this, 'BatchLogGroup', {
      logGroupName: `/helloworld/batch/tenant-${tenantId}/pattern-B`,
      retention: envConfig.logsRetentionDays as logs.RetentionDays,
      encryptionKey: appCommonCmk, // PARAM-006 §9 ISMAP LG-17
      removalPolicy: cdk.RemovalPolicy.RETAIN,
    });

    // ---------- ECR リポジトリ（パターン B 専用）----------
    // 対応: PARAM-006 §5
    const batchEcr = new ecr.Repository(this, 'BatchEcr', {
      repositoryName: 'helloworld/batch-pattern-B',
      imageScanOnPush: true,                            // PARAM-006 §5 scan_on_push=true（SEC-001 VN-7）
      imageTagMutability: ecr.TagMutability.IMMUTABLE,  // PARAM-006 §5
      encryptionKey: appCommonCmk,                      // PARAM-006 §5 encryption_type=KMS
      removalPolicy: cdk.RemovalPolicy.RETAIN,
    });

    // ---------- IAM ロール ----------
    // 対応: PARAM-006 §7

    // batchServiceRole-B（Batch サービスロール）
    const batchServiceRole = new iam.Role(this, 'BatchServiceRole', {
      roleName: `batchServiceRole-B-tenant-${tenantId}`,
      assumedBy: new iam.ServicePrincipal('batch.amazonaws.com'),
      managedPolicies: [
        iam.ManagedPolicy.fromAwsManagedPolicyName('service-role/AWSBatchServiceRole'),
      ],
    });
    NagSuppressions.addResourceSuppressions(batchServiceRole, [
      { id: 'AwsSolutions-IAM4', reason: 'AWSBatchServiceRole is required for Batch service' },
    ]);

    // batchTaskExecutionRole（ECR pull / Logs）
    const batchTaskExecutionRole = new iam.Role(this, 'BatchTaskExecutionRole', {
      roleName: `batchTaskExecutionRole-B-tenant-${tenantId}`,
      assumedBy: new iam.ServicePrincipal('ecs-tasks.amazonaws.com'),
      managedPolicies: [
        iam.ManagedPolicy.fromAwsManagedPolicyName('service-role/AmazonECSTaskExecutionRolePolicy'),
      ],
    });
    appCommonCmk.grantDecrypt(batchTaskExecutionRole); // PARAM-006 §7.2

    // batchJobRole-B（ジョブ実行ロール）
    const batchJobRole = new iam.Role(this, 'BatchJobRole', {
      roleName: `batchJobRole-B-tenant-${tenantId}`,
      assumedBy: new iam.ServicePrincipal('ecs-tasks.amazonaws.com'),
    });
    batchJobRole.addToPolicy(new iam.PolicyStatement({
      actions: ['s3:GetObject', 's3:PutObject'],
      resources: [`arn:aws:s3:::helloworld-tenant-${tenantId}-output/*`],
      conditions: { StringEquals: { 'aws:ResourceTag/tenant': tenantId } },
    }));
    tenantDataCmk.grantEncryptDecrypt(batchJobRole);
    batchLogGroup.grantWrite(batchJobRole);
    NagSuppressions.addResourceSuppressions(batchJobRole, [
      { id: 'AwsSolutions-IAM5', reason: 'Scoped to tenant output bucket prefix' },
    ]);

    // ---------- Batch Compute Environment（Fargate）----------
    // 対応: PARAM-006 §2
    // Phase3 注意: L1 使用（CDK設計書 §3.2 / 付録B）
    const maxVcpus = envConfig.albDeletionProtection ? 16
      : (environment === 'stg' ? 8 : 4);

    const batchCe = new batch.CfnComputeEnvironment(this, 'BatchCe', {
      computeEnvironmentName: pName('batch-CE-fargate'),
      type: 'MANAGED',
      state: 'ENABLED',
      serviceRole: batchServiceRole.roleArn,
      computeResources: {
        type: 'FARGATE', // PARAM-006 §2 推奨
        maxvCpus: maxVcpus,
        subnets: props.privateBatchSubnetIds,
        securityGroupIds: [props.sgBatchB.ref],
      },
      tags: {
        pattern: 'batch',
        compliance: 'ismap',
        tenant: tenantId,
      },
    });

    // ---------- Job Queue ----------
    // 対応: PARAM-006 §3
    const jobQueue = new batch.CfnJobQueue(this, 'JobQueue', {
      jobQueueName: pName('batch-queue'),
      state: 'ENABLED',
      priority: 100,
      computeEnvironmentOrder: [
        { computeEnvironment: batchCe.ref, order: 1 },
      ],
      tags: {
        pattern: 'batch',
        compliance: 'ismap',
        tenant: tenantId,
      },
    });

    // ---------- Job Definition ----------
    // 対応: PARAM-006 §4
    const taskCpu = envConfig.albDeletionProtection ? 2048 : 512;   // prod=2vCPU, dev=0.5vCPU
    const taskMemory = envConfig.albDeletionProtection ? 4096 : 1024; // prod=4GB, dev=1GB

    const jobDef = new batch.CfnJobDefinition(this, 'JobDef', {
      jobDefinitionName: pName('batch-job'),
      type: 'container',
      platformCapabilities: ['FARGATE'],
      containerProperties: {
        image: `${this.account}.dkr.ecr.${this.region}.amazonaws.com/helloworld/batch-pattern-B:latest`,
        jobRoleArn: batchJobRole.roleArn,
        executionRoleArn: batchTaskExecutionRole.roleArn,
        resourceRequirements: [
          { type: 'VCPU', value: String(taskCpu / 1024) },
          { type: 'MEMORY', value: String(taskMemory) },
        ],
        networkConfiguration: {
          assignPublicIp: 'DISABLED', // PARAM-006 §4
        },
        fargatePlatformConfiguration: { platformVersion: 'LATEST' },
        logConfiguration: {
          logDriver: 'awslogs',
          options: {
            'awslogs-group': batchLogGroup.logGroupName,
            'awslogs-region': this.region,
          },
        },
        environment: [
          { name: 'TENANT_ID', value: tenantId },
          { name: 'S3_OUTPUT_BUCKET', value: name('output') },
          { name: 'S3_OUTPUT_PREFIX', value: 'pattern-B/' },
        ],
      },
      retryStrategy: { attempts: envConfig.albDeletionProtection ? 3 : 1 }, // PARAM-006 §4
      timeout: {
        attemptDurationSeconds: envConfig.albDeletionProtection ? 3600 : 300, // PARAM-006 §4
      },
      tags: {
        pattern: 'batch',
        compliance: 'ismap',
        tenant: tenantId,
      },
    });

    // ---------- EventBridge スケジュールルール ----------
    // 対応: PARAM-006 §8
    new events.Rule(this, 'BatchScheduleRule', {
      ruleName: pName('schedule'),
      description: 'Pattern B Batch schedule trigger',
      schedule: envConfig.albDeletionProtection
        ? events.Schedule.cron({ hour: '2', minute: '0' }) // prod: 日次 02:00 UTC（PARAM-006 §8）
        : events.Schedule.rate(cdk.Duration.minutes(60)),   // dev: 60分毎
      enabled: envConfig.albDeletionProtection,
      targets: [
        new eventsTargets.BatchJob(
          jobQueue.ref,
          jobQueue,
          jobDef.ref,
          jobDef,
          {
            jobName: pName('batch-job-run'),
          },
        ),
      ],
    });

    // ---------- CloudWatch アラーム（パターン B 固有）----------
    // 対応: PARAM-006 §11
    // NOTE: Batch のメトリクスは AWS/Batch 名前空間
    new cloudwatch.Alarm(this, 'BatchJobFailed', {
      alarmName: `${name('B-batch-job-failed')}`,
      metric: new cloudwatch.Metric({
        namespace: 'AWS/Batch',
        metricName: 'FailedJobCount',
        dimensionsMap: { JobQueue: pName('batch-queue') },
        period: cdk.Duration.minutes(5),
        statistic: 'Sum',
      }),
      threshold: 1, // PARAM-006 §11
      evaluationPeriods: 1,
      comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_OR_EQUAL_TO_THRESHOLD,
      treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
    }).addAlarmAction(alarmAction);

    new cloudwatch.Alarm(this, 'BatchJobPending', {
      alarmName: `${name('B-batch-job-pending')}`,
      metric: new cloudwatch.Metric({
        namespace: 'AWS/Batch',
        metricName: 'PendingJobCount',
        dimensionsMap: { JobQueue: pName('batch-queue') },
        period: cdk.Duration.minutes(10),
        statistic: 'Sum',
      }),
      threshold: 10, // PARAM-006 §11
      evaluationPeriods: 1,
      comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_THRESHOLD,
      treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
    }).addAlarmAction(alarmAction);

    // ---------- Output ----------
    new cdk.CfnOutput(this, 'JobQueueArn', {
      value: jobQueue.ref,
      exportName: `${id}-JobQueueArn`,
    });

    // 7 タグ適用（pattern='batch'）
    applyTags(this, environment, tenantId, 'B');
  }
}
