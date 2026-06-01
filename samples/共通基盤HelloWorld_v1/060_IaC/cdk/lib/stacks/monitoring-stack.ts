/**
 * lib/stacks/monitoring-stack.ts
 * MonitoringStack — CloudWatch Alarms / Dashboard / SNS Topics
 *
 * 対応 PARAM: PARAM-004 §2〜6
 * 作成: infra-iac
 * 作成日: 2026-06-01
 */

import * as cdk from 'aws-cdk-lib';
import * as cloudwatch from 'aws-cdk-lib/aws-cloudwatch';
import * as cwActions from 'aws-cdk-lib/aws-cloudwatch-actions';
import * as sns from 'aws-cdk-lib/aws-sns';
import * as snsSubscriptions from 'aws-cdk-lib/aws-sns-subscriptions';
import * as kms from 'aws-cdk-lib/aws-kms';
import { Construct } from 'constructs';
import { Environment, EnvConfig } from '../common/config';
import { applyTags, resourceName } from '../common/tags';

export interface MonitoringStackProps extends cdk.StackProps {
  readonly environment: Environment;
  readonly config: EnvConfig;
  readonly appCommonCmkArn: string;
  readonly ecsClusterName: string;
  readonly publicAlbFullName: string;
  readonly internalAlbFullName: string;
  readonly publicTargetGroupFullName: string;
  readonly privateTargetGroupFullName: string;
}

export class MonitoringStack extends cdk.Stack {
  /** アプリアラート SNS ARN（パターンスタックが参照）*/
  public readonly appAlertsSnsArn: string;

  constructor(scope: Construct, id: string, props: MonitoringStackProps) {
    super(scope, id, props);

    const { environment, config: envConfig } = props;
    const tenantId = envConfig.tenantId;
    const name = (suffix: string) => resourceName(tenantId, suffix);
    const appCommonCmk = kms.Key.fromKeyArn(this, 'AppCommonCmk', props.appCommonCmkArn);

    // ---------- SNS トピック（アプリアラート）----------
    // 対応: PARAM-004 §5
    const appAlertsTopic = new sns.Topic(this, 'AppAlertsTopic', {
      topicName: 'helloworld-app-alerts',
      masterKey: appCommonCmk, // PARAM-004 §5
      displayName: 'HelloWorld App Alerts',
    });
    appAlertsTopic.addSubscription(
      new snsSubscriptions.EmailSubscription('ops@example.go.jp'), // PARAM-004 §5
    );
    this.appAlertsSnsArn = appAlertsTopic.topicArn;

    const alarmAction = new cwActions.SnsAction(appAlertsTopic);

    // ---------- CloudWatch アラーム（共通）----------
    // 対応: PARAM-004 §4.1
    const svcName = name('public-svc');

    // ECS 公開サービス CPU 高（WARNING）
    new cloudwatch.Alarm(this, 'PublicCpuHigh', {
      alarmName: `${name('A-public-cpu-high')}`,
      metric: new cloudwatch.Metric({
        namespace: 'AWS/ECS',
        metricName: 'CPUUtilization',
        dimensionsMap: { ClusterName: props.ecsClusterName, ServiceName: svcName },
        period: cdk.Duration.minutes(5),
        statistic: 'Average',
      }),
      threshold: 80, // PARAM-004 §4.1
      evaluationPeriods: 1,
      comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_THRESHOLD,
      treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING, // PARAM-004 §4.2
      alarmDescription: 'Public ECS CPU > 80%',
    }).addAlarmAction(alarmAction);

    // ALB 5xx エラー（CRITICAL）
    new cloudwatch.Alarm(this, 'PublicAlb5xx', {
      alarmName: `${name('A-public-alb-5xx')}`,
      metric: new cloudwatch.Metric({
        namespace: 'AWS/ApplicationELB',
        metricName: 'HTTPCode_ELB_5XX_Count',
        dimensionsMap: { LoadBalancer: props.publicAlbFullName },
        period: cdk.Duration.minutes(1),
        statistic: 'Sum',
      }),
      threshold: 10, // PARAM-004 §4.1
      evaluationPeriods: 1,
      comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_THRESHOLD,
      treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
      alarmDescription: 'Public ALB 5xx > 10',
    }).addAlarmAction(alarmAction);

    // ALB 非健全ホスト数（CRITICAL）
    new cloudwatch.Alarm(this, 'PublicAlbUnhealthy', {
      alarmName: `${name('A-public-unhealthy')}`,
      metric: new cloudwatch.Metric({
        namespace: 'AWS/ApplicationELB',
        metricName: 'UnHealthyHostCount',
        dimensionsMap: {
          LoadBalancer: props.publicAlbFullName,
          TargetGroup: props.publicTargetGroupFullName,
        },
        period: cdk.Duration.minutes(1),
        statistic: 'Sum',
      }),
      threshold: 1,
      evaluationPeriods: 1,
      comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_OR_EQUAL_TO_THRESHOLD,
      treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
      alarmDescription: 'Public ALB UnhealthyHostCount >= 1',
    }).addAlarmAction(alarmAction);

    // KMS 復号失敗（CRITICAL）
    new cloudwatch.Alarm(this, 'KmsDecryptFail', {
      alarmName: `${name('kms-decrypt-fail')}`,
      metric: new cloudwatch.Metric({
        namespace: 'AWS/KMS',
        metricName: 'NumberOfRequestsFailedWithKeyError',
        period: cdk.Duration.minutes(1),
        statistic: 'Sum',
      }),
      threshold: 5, // PARAM-004 §4.1
      evaluationPeriods: 1,
      comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_THRESHOLD,
      treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
      alarmDescription: 'KMS decrypt failures > 5',
    }).addAlarmAction(alarmAction);

    // ---------- CloudWatch ダッシュボード ----------
    // 対応: PARAM-004 §6
    // dev は概要ダッシュボードのみ、prod は全ダッシュボード（PARAM-004 §6.1）
    const overviewDashboard = new cloudwatch.Dashboard(this, 'OverviewDashboard', {
      dashboardName: 'helloworld-overview',
      defaultInterval: cdk.Duration.hours(3), // PARAM-004 §6.2
    });

    overviewDashboard.addWidgets(
      new cloudwatch.GraphWidget({
        title: 'Public ALB Request Count',
        left: [new cloudwatch.Metric({
          namespace: 'AWS/ApplicationELB',
          metricName: 'RequestCount',
          dimensionsMap: { LoadBalancer: props.publicAlbFullName },
        })],
      }),
      new cloudwatch.GraphWidget({
        title: 'ECS Running Tasks',
        left: [new cloudwatch.Metric({
          namespace: 'AWS/ECS',
          metricName: 'RunningTaskCount',
          dimensionsMap: { ClusterName: props.ecsClusterName },
        })],
      }),
    );

    // prod のみ詳細ダッシュボード（PARAM-004 §6.1）
    if (environment === 'prod') {
      new cloudwatch.Dashboard(this, 'EcsTenantDashboard', {
        dashboardName: `helloworld-ecs-tenant-${tenantId}`,
        defaultInterval: cdk.Duration.hours(3),
      });
      new cloudwatch.Dashboard(this, 'BatchPatternDashboard', {
        dashboardName: 'helloworld-batch-pattern',
        defaultInterval: cdk.Duration.hours(3),
      });
    }

    new cdk.CfnOutput(this, 'AppAlertsSnsArn', {
      value: this.appAlertsSnsArn,
      exportName: `${id}-AppAlertsSnsArn`,
    });

    // 7 タグ適用
    applyTags(this, environment, tenantId);
  }
}
