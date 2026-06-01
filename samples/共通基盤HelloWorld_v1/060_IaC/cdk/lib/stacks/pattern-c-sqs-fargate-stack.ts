/**
 * lib/stacks/pattern-c-sqs-fargate-stack.ts
 * PatternCSqsFargateStack — SQS / DLQ / ECR / ECS Worker / Auto Scaling (キュー深度連動) / Alarms
 *
 * 対応 PARAM: PARAM-007 §2〜12
 * 作成: infra-iac
 * 作成日: 2026-06-01
 *
 * Phase3 引き継ぎ注意:
 *   - SQS 深度連動スケール: ApproximateNumberOfMessages / RunningTaskCount をカスタムメトリクスとして
 *     CloudWatch に Publish し、TargetTracking のカスタムメトリクスに指定（PARAM-007 §6.2）
 *   - Monitoring Endpoint（monitoring endpoint、PARAM-001 §9.2）が成立していること前提
 *   - min_capacity=1（常時最低1タスク、アイドルコスト発生）（PARAM-007 §6.1）
 *   - autoScalingRole-C は application-autoscaling.amazonaws.com を Trusted Entity とする
 */

import * as cdk from 'aws-cdk-lib';
import * as sqs from 'aws-cdk-lib/aws-sqs';
import * as ecr from 'aws-cdk-lib/aws-ecr';
import * as ecs from 'aws-cdk-lib/aws-ecs';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as kms from 'aws-cdk-lib/aws-kms';
import * as logs from 'aws-cdk-lib/aws-logs';
import * as cloudwatch from 'aws-cdk-lib/aws-cloudwatch';
import * as cwActions from 'aws-cdk-lib/aws-cloudwatch-actions';
import * as appscaling from 'aws-cdk-lib/aws-applicationautoscaling';
import * as sns from 'aws-cdk-lib/aws-sns';
import * as ssm from 'aws-cdk-lib/aws-ssm';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import { Construct } from 'constructs';
import { NagSuppressions } from 'cdk-nag';
import { Environment, EnvConfig } from '../common/config';
import { applyTags, patternResourceName, resourceName } from '../common/tags';

export interface PatternCSqsFargateStackProps extends cdk.StackProps {
  readonly environment: Environment;
  readonly config: EnvConfig;
  readonly vpc: ec2.CfnVPC;
  readonly sgBatchC: ec2.CfnSecurityGroup;
  readonly privateBatchSubnetIds: string[];
  /** OnlineStack から渡す既存 ECS Cluster（PARAM-007 §5.2 cluster_name=helloworld-tenant-A-cluster）*/
  readonly ecsCluster: ecs.Cluster;
  readonly appCommonCmkArn: string;
  readonly tenantDataCmkArn: string;
  readonly appAlertsSnsArn: string;
}

export class PatternCSqsFargateStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: PatternCSqsFargateStackProps) {
    super(scope, id, props);

    const { environment, config: envConfig } = props;
    const tenantId = envConfig.tenantId;
    const pName = (r: string) => patternResourceName(tenantId, r, 'C');
    const name = (r: string) => resourceName(tenantId, r);

    const appCommonCmk = kms.Key.fromKeyArn(this, 'AppCommonCmk', props.appCommonCmkArn);
    const tenantDataCmk = kms.Key.fromKeyArn(this, 'TenantDataCmk', props.tenantDataCmkArn);
    const appAlertsTopic = sns.Topic.fromTopicArn(this, 'AppAlerts', props.appAlertsSnsArn);
    const alarmAction = new cwActions.SnsAction(appAlertsTopic);

    // ---------- SQS DLQ ----------
    // 対応: PARAM-007 §3
    const dlq = new sqs.Queue(this, 'Dlq', {
      queueName: pName('dlq'),
      retentionPeriod: cdk.Duration.seconds(
        envConfig.albDeletionProtection ? 1209600 : 86400,
      ),
      encryptionMasterKey: tenantDataCmk, // PARAM-007 §3 SEC-001 §9.1 DLQ CMK 必須
      receiveMessageWaitTime: cdk.Duration.seconds(20),
    });

    // ---------- SQS メインキュー ----------
    // 対応: PARAM-007 §2
    const mainQueue = new sqs.Queue(this, 'MainQueue', {
      queueName: pName('queue'),
      visibilityTimeout: cdk.Duration.seconds(300), // PARAM-007 §2
      retentionPeriod: cdk.Duration.seconds(
        envConfig.albDeletionProtection ? 1209600 : 86400,
      ),
      encryptionMasterKey: tenantDataCmk, // PARAM-007 §2 SQS CMK 必須（SEC-001 §9.1 中核）
      receiveMessageWaitTime: cdk.Duration.seconds(20),
      deadLetterQueue: {
        queue: dlq,
        maxReceiveCount: 5, // PARAM-007 §2 maxReceiveCount=5
      },
    });

    // SQS URL を SSM に出力（Worker タスクの環境変数から参照、PARAM-007 §5.1）
    new ssm.StringParameter(this, 'SqsQueueUrlParam', {
      parameterName: `/helloworld/tenant-${tenantId}/sqs-queue-url`,
      stringValue: mainQueue.queueUrl,
    });

    // ---------- Worker Logs グループ（先行作成）----------
    // 対応: PARAM-007 §9
    const workerLogGroup = new logs.LogGroup(this, 'WorkerLogGroup', {
      logGroupName: `/helloworld/worker/tenant-${tenantId}/pattern-C`,
      retention: envConfig.logsRetentionDays as logs.RetentionDays,
      encryptionKey: appCommonCmk,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
    });

    // ---------- ECR リポジトリ（パターン C Worker 専用）----------
    // 対応: PARAM-007 §4
    const workerEcr = new ecr.Repository(this, 'WorkerEcr', {
      repositoryName: 'helloworld/worker-pattern-C',
      imageScanOnPush: true,
      imageTagMutability: ecr.TagMutability.IMMUTABLE,
      encryptionKey: appCommonCmk,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
    });

    // ---------- IAM ロール ----------
    // 対応: PARAM-007 §8

    // ecsTaskExecutionRole は OnlineStack と共用（ecsTaskExecutionRole という共通ロール）
    const executionRole = iam.Role.fromRoleName(
      this, 'EcsExecutionRoleRef', 'ecsTaskExecutionRole',
    );

    // ecsTaskRole-worker-C（PARAM-007 §8.1）
    const workerTaskRole = new iam.Role(this, 'WorkerTaskRole', {
      roleName: `ecsTaskRole-worker-C-tenant-${tenantId}`,
      assumedBy: new iam.ServicePrincipal('ecs-tasks.amazonaws.com'),
    });
    workerTaskRole.addToPolicy(new iam.PolicyStatement({
      actions: [
        'sqs:ReceiveMessage', 'sqs:DeleteMessage', 'sqs:GetQueueAttributes',
      ],
      resources: [mainQueue.queueArn, dlq.queueArn],
    }));
    workerTaskRole.addToPolicy(new iam.PolicyStatement({
      actions: ['s3:PutObject'],
      resources: [`arn:aws:s3:::helloworld-tenant-${tenantId}-output/pattern-C/*`],
      conditions: { StringEquals: { 'aws:ResourceTag/tenant': tenantId } },
    }));
    tenantDataCmk.grantDecrypt(workerTaskRole);
    workerLogGroup.grantWrite(workerTaskRole);
    NagSuppressions.addResourceSuppressions(workerTaskRole, [
      { id: 'AwsSolutions-IAM5', reason: 'Scoped to tenant output bucket prefix and specific SQS queues' },
    ]);

    // autoScalingRole-C（PARAM-007 §8.2）
    const autoScalingRole = new iam.Role(this, 'AutoScalingRole', {
      roleName: `autoScalingRole-C-tenant-${tenantId}`,
      assumedBy: new iam.ServicePrincipal('application-autoscaling.amazonaws.com'),
    });
    autoScalingRole.addToPolicy(new iam.PolicyStatement({
      actions: [
        'cloudwatch:GetMetricData', 'cloudwatch:DescribeAlarms',
        'application-autoscaling:*',
        'ecs:DescribeServices', 'ecs:UpdateService',
      ],
      resources: ['*'],
      conditions: {
        StringEquals: {
          'ecs:cluster': props.ecsCluster.clusterArn,
        },
      },
    }));
    NagSuppressions.addResourceSuppressions(autoScalingRole, [
      { id: 'AwsSolutions-IAM5', reason: 'Auto Scaling role requires broad permissions scoped to ECS cluster' },
    ]);

    // ---------- ECS タスク定義（Worker）----------
    // 対応: PARAM-007 §5.1
    const workerTaskDef = new ecs.FargateTaskDefinition(this, 'WorkerTaskDef', {
      family: name('worker-C'),
      cpu: envConfig.ecsCpu,
      memoryLimitMiB: envConfig.ecsMemory,
      executionRole,
      taskRole: workerTaskRole,
    });
    workerTaskDef.addContainer('worker', {
      image: ecs.ContainerImage.fromEcrRepository(workerEcr, 'latest'),
      logging: ecs.LogDrivers.awsLogs({
        streamPrefix: 'worker',
        logGroup: workerLogGroup,
      }),
      environment: {
        TENANT_ID: tenantId,
        SQS_QUEUE_URL: mainQueue.queueUrl,
        SQS_DLQ_URL: dlq.queueUrl,
        S3_OUTPUT_BUCKET: name('output'),
        S3_OUTPUT_PREFIX: 'pattern-C/',
      },
    });

    // ---------- ECS Worker サービス ----------
    // 対応: PARAM-007 §5.2
    const workerService = new ecs.FargateService(this, 'WorkerService', {
      serviceName: name('worker-C-svc'),
      cluster: props.ecsCluster,
      taskDefinition: workerTaskDef,
      desiredCount: 1, // PARAM-007 §5.2 最小 1 タスク
      securityGroups: [
        ec2.SecurityGroup.fromSecurityGroupId(this, 'SgBatchC', props.sgBatchC.ref),
      ],
      vpcSubnets: { subnets: props.privateBatchSubnetIds.map((sid, i) =>
        ec2.Subnet.fromSubnetId(this, `BatchSubnet${i}`, sid)) },
      assignPublicIp: false,
      minHealthyPercent: 50, // PARAM-007 §5.2 スケールイン時に許可
      maxHealthyPercent: 200,
      healthCheckGracePeriod: cdk.Duration.seconds(60), // PARAM-007 §5.2
      circuitBreaker: { rollback: true },
    });

    // ---------- Application Auto Scaling（キュー深度連動）----------
    // 対応: PARAM-007 §6
    // Phase3 注意: SQS 深度連動スケール実装の肝（CDK設計書 付録B）
    if (envConfig.enableAutoScaling) {
      const maxCapacity = envConfig.albDeletionProtection ? 10 : 2; // PARAM-007 §6.1

      const scalableTarget = new appscaling.ScalableTarget(this, 'WorkerScalableTarget', {
        serviceNamespace: appscaling.ServiceNamespace.ECS,
        resourceId: `service/${props.ecsCluster.clusterName}/${workerService.serviceName}`,
        scalableDimension: 'ecs:service:DesiredCount',
        minCapacity: 1, // PARAM-007 §6.1 常時最低 1 タスク
        maxCapacity,
        role: autoScalingRole,
      });

      // SQS キュー深度連動スケーリング（TargetTracking）
      // 対応: PARAM-007 §6.2
      // SQS ApproximateNumberOfMessages / RunningTaskCount のカスタムメトリクス比率を使用
      scalableTarget.scaleToTrackMetric('QueueDepthScaling', {
        targetValue: 10.0, // PARAM-007 §6.2 1タスクあたり10メッセージをターゲット
        scaleOutCooldown: cdk.Duration.seconds(
          envConfig.albDeletionProtection ? 60 : 300
        ), // PARAM-007 §6.2 scale_out_cooldown
        scaleInCooldown: cdk.Duration.seconds(
          envConfig.albDeletionProtection ? 300 : 600
        ), // PARAM-007 §6.2 scale_in_cooldown（急減で早期終了しないよう長め）
        customMetric: new cloudwatch.MathExpression({
          expression: 'queueDepth / MAX([runningTasks, 1])',
          usingMetrics: {
            queueDepth: mainQueue.metricApproximateNumberOfMessagesVisible({
              period: cdk.Duration.minutes(1),
            }),
            runningTasks: new cloudwatch.Metric({
              namespace: 'AWS/ECS',
              metricName: 'RunningTaskCount',
              dimensionsMap: {
                ClusterName: props.ecsCluster.clusterName,
                ServiceName: workerService.serviceName,
              },
              period: cdk.Duration.minutes(1),
              statistic: 'Average',
            }),
          },
          period: cdk.Duration.minutes(1),
          label: 'SQS messages per ECS task',
        }),
      });
    }

    // ---------- CloudWatch アラーム（パターン C 固有）----------
    // 対応: PARAM-007 §11
    new cloudwatch.Alarm(this, 'WorkerCpuHigh', {
      alarmName: `${name('C-worker-cpu-high')}`,
      metric: new cloudwatch.Metric({
        namespace: 'AWS/ECS',
        metricName: 'CPUUtilization',
        dimensionsMap: {
          ClusterName: props.ecsCluster.clusterName,
          ServiceName: name('worker-C-svc'),
        },
        period: cdk.Duration.minutes(5),
        statistic: 'Average',
      }),
      threshold: 80,
      evaluationPeriods: 1,
      comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_THRESHOLD,
      treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
    }).addAlarmAction(alarmAction);

    new cloudwatch.Alarm(this, 'QueueDepthHigh', {
      alarmName: `${name('C-queue-depth-high')}`,
      metric: mainQueue.metricApproximateNumberOfMessagesVisible({ period: cdk.Duration.minutes(1) }),
      threshold: 50, // PARAM-007 §6.3
      evaluationPeriods: 1,
      comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_THRESHOLD,
      treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
    }).addAlarmAction(alarmAction);

    new cloudwatch.Alarm(this, 'DlqMessages', {
      alarmName: `${name('C-dlq-messages')}`,
      metric: dlq.metricApproximateNumberOfMessagesVisible({ period: cdk.Duration.minutes(5) }),
      threshold: 1, // PARAM-007 §11 DLQ に溜積は異常（CRITICAL）
      evaluationPeriods: 1,
      comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_OR_EQUAL_TO_THRESHOLD,
      treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
    }).addAlarmAction(alarmAction);

    new cloudwatch.Alarm(this, 'WorkerTaskCountMin', {
      alarmName: `${name('C-worker-task-count')}`,
      metric: new cloudwatch.Metric({
        namespace: 'AWS/ECS',
        metricName: 'RunningTaskCount',
        dimensionsMap: {
          ClusterName: props.ecsCluster.clusterName,
          ServiceName: name('worker-C-svc'),
        },
        period: cdk.Duration.minutes(1),
        statistic: 'Minimum',
      }),
      threshold: 1, // 0 台は障害（PARAM-007 §11 CRITICAL）
      evaluationPeriods: 1,
      comparisonOperator: cloudwatch.ComparisonOperator.LESS_THAN_THRESHOLD,
      treatMissingData: cloudwatch.TreatMissingData.BREACHING, // 0 台は異常
    }).addAlarmAction(alarmAction);

    new cloudwatch.Alarm(this, 'SqsMsgAge', {
      alarmName: `${name('C-sqs-msg-age')}`,
      metric: mainQueue.metricApproximateAgeOfOldestMessage({ period: cdk.Duration.minutes(5) }),
      threshold: 900, // PARAM-007 §11 15分超
      evaluationPeriods: 1,
      comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_THRESHOLD,
      treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
    }).addAlarmAction(alarmAction);

    // ---------- Output ----------
    new cdk.CfnOutput(this, 'MainQueueUrl', {
      value: mainQueue.queueUrl,
      exportName: `${id}-MainQueueUrl`,
    });
    new cdk.CfnOutput(this, 'MainQueueArn', {
      value: mainQueue.queueArn,
      exportName: `${id}-MainQueueArn`,
    });

    // 7 タグ適用（pattern='sqs-fargate'）
    applyTags(this, environment, tenantId, 'C');
  }
}
