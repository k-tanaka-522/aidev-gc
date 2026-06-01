/**
 * lib/stacks/online-stack.ts
 * OnlineStack — ECR / ECS Cluster+Service (public/private) / ALB (公開/内部) / Route53
 *
 * 対応 PARAM: PARAM-002 §2〜6, §9〜10
 * 作成: infra-iac
 * 作成日: 2026-06-01
 *
 * WAF は WafRegionalStack / WafCloudFrontStack で別途定義。
 * CloudFront Distribution は WafCloudFrontStack（us-east-1）で定義。
 */

import * as cdk from 'aws-cdk-lib';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as ecs from 'aws-cdk-lib/aws-ecs';
import * as ecr from 'aws-cdk-lib/aws-ecr';
import * as elbv2 from 'aws-cdk-lib/aws-elasticloadbalancingv2';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as kms from 'aws-cdk-lib/aws-kms';
import * as logs from 'aws-cdk-lib/aws-logs';
import * as appscaling from 'aws-cdk-lib/aws-applicationautoscaling';
import { Construct } from 'constructs';
import { NagSuppressions } from 'cdk-nag';
import { Environment, EnvConfig } from '../common/config';
import { applyTags, resourceName } from '../common/tags';

export interface OnlineStackProps extends cdk.StackProps {
  readonly environment: Environment;
  readonly config: EnvConfig;
  readonly vpc: ec2.CfnVPC;
  readonly sgPublicAlb: ec2.CfnSecurityGroup;
  readonly sgInternalAlb: ec2.CfnSecurityGroup;
  readonly sgFargateApp: ec2.CfnSecurityGroup;
  readonly publicSubnetIds: string[];
  readonly privateAppSubnetIds: string[];
  readonly appCommonCmkArn: string;
}

export class OnlineStack extends cdk.Stack {
  /** ECS Cluster（パターン C Worker が参照）*/
  public readonly ecsCluster: ecs.Cluster;
  /** ECS Cluster 名 */
  public readonly ecsClusterName: string;
  /** 公開 ALB DNS 名（CloudFront Origin）*/
  public readonly publicAlbDnsName: string;
  /** 公開 ALB Full Name（Alarm ディメンション用）*/
  public readonly publicAlbFullName: string;
  /** 内部 ALB Full Name */
  public readonly internalAlbFullName: string;
  /** 公開 TG Full Name */
  public readonly publicTargetGroupFullName: string;
  /** 非公開 TG Full Name */
  public readonly privateTargetGroupFullName: string;

  constructor(scope: Construct, id: string, props: OnlineStackProps) {
    super(scope, id, props);

    const { environment, config: envConfig, appCommonCmkArn } = props;
    const tenantId = envConfig.tenantId;
    const name = (suffix: string) => resourceName(tenantId, suffix);
    const appCommonCmk = kms.Key.fromKeyArn(this, 'AppCommonCmk', appCommonCmkArn);

    // VPC 参照（L2 Vpc として Import）
    // CfnVPC からではなく、Vpc.fromLookup を使用するか、VPC ID で fromVpcAttributes で参照
    // スケルトンでは ec2.Vpc.fromVpcAttributes を使用
    const vpc = ec2.Vpc.fromVpcAttributes(this, 'Vpc', {
      vpcId: props.vpc.ref,
      availabilityZones: ['ap-northeast-1a', 'ap-northeast-1c'],
      publicSubnetIds: props.publicSubnetIds,
      privateSubnetIds: props.privateAppSubnetIds,
    });

    // ---------- ECR リポジトリ ----------
    // 対応: PARAM-002 §2
    const ecrRepo = new ecr.Repository(this, 'EcrOnline', {
      repositoryName: 'helloworld/online-app',
      imageScanOnPush: true,                      // PARAM-002 §2.1 scan_on_push=true
      imageTagMutability: ecr.TagMutability.IMMUTABLE, // PARAM-002 §2.1 IMMUTABLE
      encryptionKey: appCommonCmk,                // PARAM-002 §2.1 encryption_type=KMS
      removalPolicy: cdk.RemovalPolicy.RETAIN,
    });

    // ---------- ECS Cluster ----------
    // 対応: PARAM-002 §3
    this.ecsCluster = new ecs.Cluster(this, 'EcsCluster', {
      clusterName: name('cluster'),
      vpc,
      containerInsights: true, // PARAM-002 §3 container_insights=enabled
    });
    this.ecsClusterName = this.ecsCluster.clusterName;

    // ---------- CloudWatch Logs グループ（先行作成）----------
    // 対応: PARAM-004 §2.1（ECS public/private ログ）
    const publicLogsGroup = new logs.LogGroup(this, 'PublicLogsGroup', {
      logGroupName: `/helloworld/ecs/tenant-${tenantId}/public`,
      retention: envConfig.logsRetentionDays as logs.RetentionDays,
      encryptionKey: appCommonCmk,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
    });
    const privateLogsGroup = new logs.LogGroup(this, 'PrivateLogsGroup', {
      logGroupName: `/helloworld/ecs/tenant-${tenantId}/private`,
      retention: envConfig.logsRetentionDays as logs.RetentionDays,
      encryptionKey: appCommonCmk,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
    });

    // ---------- IAM ロール ----------
    // 対応: PARAM-002 §10
    // ecsTaskExecutionRole
    const executionRole = new iam.Role(this, 'EcsTaskExecutionRole', {
      roleName: 'ecsTaskExecutionRole',
      assumedBy: new iam.ServicePrincipal('ecs-tasks.amazonaws.com'),
      managedPolicies: [
        iam.ManagedPolicy.fromAwsManagedPolicyName('service-role/AmazonECSTaskExecutionRolePolicy'),
      ],
    });
    // CMK 復号権限追加（PARAM-002 §10）
    appCommonCmk.grantDecrypt(executionRole);

    // ecsTaskRole-online
    const taskRoleOnline = new iam.Role(this, 'EcsTaskRoleOnline', {
      roleName: 'ecsTaskRole-online',
      assumedBy: new iam.ServicePrincipal('ecs-tasks.amazonaws.com'),
    });
    taskRoleOnline.addToPolicy(
      new iam.PolicyStatement({
        actions: ['s3:GetObject', 's3:PutObject'],
        resources: [`arn:aws:s3:::helloworld-tenant-${tenantId}-*/*`],
        conditions: { StringEquals: { 'aws:ResourceTag/tenant': tenantId } },
      }),
    );
    appCommonCmk.grantDecrypt(taskRoleOnline);

    NagSuppressions.addResourceSuppressions(taskRoleOnline, [
      { id: 'AwsSolutions-IAM5', reason: 'Wildcard scoped to tenant prefix for S3' },
    ]);

    // ---------- 公開 ALB ----------
    // 対応: PARAM-002 §6.1
    const publicAlb = new elbv2.ApplicationLoadBalancer(this, 'PublicAlb', {
      loadBalancerName: name('public-alb'),
      vpc,
      internetFacing: true,
      securityGroup: ec2.SecurityGroup.fromSecurityGroupId(
        this, 'SgPublicAlbRef', props.sgPublicAlb.ref,
      ),
      vpcSubnets: { subnets: props.publicSubnetIds.map((sid, i) =>
        ec2.Subnet.fromSubnetId(this, `PubSubnet${i}`, sid)) },
      deletionProtection: envConfig.albDeletionProtection, // PARAM-002 §6.1
      dropInvalidHeaderFields: true, // PARAM-002 §6.1 drop_invalid_header_fields=true（ISMAP NW-3）
    });

    // アクセスログ（PARAM-002 §6.1）
    // publicAlb.logAccessLogs(s3Bucket); // S3 バケットは MonitoringStack でセット（スケルトン省略）

    this.publicAlbDnsName = publicAlb.loadBalancerDnsName;
    this.publicAlbFullName = publicAlb.loadBalancerFullName;

    // 公開 ALB ターゲットグループ（PARAM-002 §6.1）
    const publicTg = new elbv2.ApplicationTargetGroup(this, 'PublicTg', {
      targetGroupName: name('A-public-tg'),
      vpc,
      port: 8080,
      protocol: elbv2.ApplicationProtocol.HTTP,
      targetType: elbv2.TargetType.IP,
      healthCheck: {
        path: '/actuator/health',    // PARAM-002 §6.1
        interval: cdk.Duration.seconds(30),
        timeout: cdk.Duration.seconds(5),
        healthyThresholdCount: 2,
        unhealthyThresholdCount: 3,
      },
      deregistrationDelay: cdk.Duration.seconds(
        envConfig.albDeletionProtection ? 30 : 10,  // dev=10, prod=30（PARAM-002 §6.1）
      ),
    });
    this.publicTargetGroupFullName = publicTg.targetGroupFullName;

    // HTTP リスナー（→ HTTPS リダイレクト）
    publicAlb.addListener('HttpListener', {
      port: 80,
      defaultAction: elbv2.ListenerAction.redirect({
        protocol: 'HTTPS', port: '443', permanent: true,
      }),
    });
    // HTTPS リスナー（ACM 証明書はプレースホルダ）
    // 実際の証明書 ARN は SSM or Secrets Manager から取得
    // publicAlb.addListener('HttpsListener', {
    //   port: 443, protocol: elbv2.ApplicationProtocol.HTTPS,
    //   certificates: [elbv2.ListenerCertificate.fromArn('ACM_CERT_ARN')],
    //   defaultTargetGroups: [publicTg],
    // });

    // ---------- 内部 ALB ----------
    // 対応: PARAM-002 §6.2
    const internalAlb = new elbv2.ApplicationLoadBalancer(this, 'InternalAlb', {
      loadBalancerName: name('internal-alb'),
      vpc,
      internetFacing: false, // PARAM-002 §6.2 scheme=internal
      securityGroup: ec2.SecurityGroup.fromSecurityGroupId(
        this, 'SgInternalAlbRef', props.sgInternalAlb.ref,
      ),
      vpcSubnets: { subnets: props.privateAppSubnetIds.map((sid, i) =>
        ec2.Subnet.fromSubnetId(this, `PrivAppSubnet${i}`, sid)) },
      deletionProtection: envConfig.albDeletionProtection,
      dropInvalidHeaderFields: true,
    });
    this.internalAlbFullName = internalAlb.loadBalancerFullName;

    const privateTg = new elbv2.ApplicationTargetGroup(this, 'PrivateTg', {
      targetGroupName: name('A-private-tg'),
      vpc,
      port: 8080,
      protocol: elbv2.ApplicationProtocol.HTTP,
      targetType: elbv2.TargetType.IP,
      healthCheck: { path: '/actuator/health' },
    });
    this.privateTargetGroupFullName = privateTg.targetGroupFullName;

    // ---------- ECS タスク定義（公開サービス）----------
    // 対応: PARAM-002 §4.1
    const publicTaskDef = new ecs.FargateTaskDefinition(this, 'PublicTaskDef', {
      family: name('public'),
      cpu: envConfig.ecsCpu,       // PARAM-002 §4.1 dev=256, prod=512
      memoryLimitMiB: envConfig.ecsMemory, // PARAM-002 §4.1 dev=512, prod=1024
      executionRole,
      taskRole: taskRoleOnline,
    });
    publicTaskDef.addContainer('app', {
      image: ecs.ContainerImage.fromEcrRepository(
        ecrRepo,
        'latest', // プレースホルダ。実際はイメージタグ固定推奨（PARAM-002 §2.1 IMMUTABLE）
      ),
      portMappings: [{ containerPort: 8080 }],
      logging: ecs.LogDrivers.awsLogs({
        streamPrefix: 'ecs',
        logGroup: publicLogsGroup,
      }),
      environment: {
        TENANT_ID: tenantId,
      },
    });

    // ---------- ECS Fargate サービス（公開）----------
    // 対応: PARAM-002 §4.2
    const publicService = new ecs.FargateService(this, 'PublicService', {
      serviceName: name('public-svc'),
      cluster: this.ecsCluster,
      taskDefinition: publicTaskDef,
      desiredCount: envConfig.ecsDesiredCount,
      securityGroups: [
        ec2.SecurityGroup.fromSecurityGroupId(this, 'SgFargateAppRef', props.sgFargateApp.ref),
      ],
      vpcSubnets: { subnets: props.privateAppSubnetIds.map((sid, i) =>
        ec2.Subnet.fromSubnetId(this, `PrivAppServiceSubnet${i}`, sid)) },
      assignPublicIp: false,
      minHealthyPercent: envConfig.albDeletionProtection ? 100 : 50, // PARAM-002 §4.2
      maxHealthyPercent: 200,
      healthCheckGracePeriod: cdk.Duration.seconds(envConfig.albDeletionProtection ? 60 : 30),
      enableExecuteCommand: !envConfig.albDeletionProtection, // dev のみ有効（PARAM-002 §4.2）
      circuitBreaker: { rollback: true },
    });

    // ---------- Auto Scaling（公開サービス）----------
    // 対応: PARAM-002 §4.3
    if (envConfig.enableAutoScaling) {
      const publicScaling = publicService.autoScaleTaskCount({
        minCapacity: envConfig.albDeletionProtection ? 2 : 1,
        maxCapacity: envConfig.albDeletionProtection ? 10 : 2,
      });
      publicScaling.scaleOnCpuUtilization('PublicCpuScaling', {
        targetUtilizationPercent: 60, // PARAM-002 §4.3
        scaleInCooldown: cdk.Duration.seconds(300),
        scaleOutCooldown: cdk.Duration.seconds(300),
      });
    }

    // ---------- ECS タスク定義（非公開サービス）----------
    // 対応: PARAM-002 §5.1
    const privateTaskDef = new ecs.FargateTaskDefinition(this, 'PrivateTaskDef', {
      family: name('private'),
      cpu: envConfig.ecsCpu,
      memoryLimitMiB: envConfig.ecsMemory,
      executionRole,
      taskRole: taskRoleOnline,
    });
    privateTaskDef.addContainer('app', {
      image: ecs.ContainerImage.fromEcrRepository(ecrRepo, 'latest'),
      portMappings: [{ containerPort: 8080 }],
      logging: ecs.LogDrivers.awsLogs({
        streamPrefix: 'ecs',
        logGroup: privateLogsGroup,
      }),
      environment: { TENANT_ID: tenantId },
    });

    // ---------- ECS Fargate サービス（非公開）----------
    // 対応: PARAM-002 §5.2
    const privateService = new ecs.FargateService(this, 'PrivateService', {
      serviceName: name('private-svc'),
      cluster: this.ecsCluster,
      taskDefinition: privateTaskDef,
      desiredCount: envConfig.ecsDesiredCount,
      securityGroups: [
        ec2.SecurityGroup.fromSecurityGroupId(this, 'SgFargateAppPrivRef', props.sgFargateApp.ref),
      ],
      vpcSubnets: { subnets: props.privateAppSubnetIds.map((sid, i) =>
        ec2.Subnet.fromSubnetId(this, `PrivAppPrivSvcSubnet${i}`, sid)) },
      assignPublicIp: false,
      minHealthyPercent: envConfig.albDeletionProtection ? 100 : 50,
      maxHealthyPercent: 200,
      circuitBreaker: { rollback: true },
    });

    // Auto Scaling（非公開）
    if (envConfig.enableAutoScaling) {
      const privateScaling = privateService.autoScaleTaskCount({
        minCapacity: envConfig.albDeletionProtection ? 2 : 1,
        maxCapacity: envConfig.albDeletionProtection ? 6 : 2, // PARAM-002 §5.3
      });
      privateScaling.scaleOnCpuUtilization('PrivateCpuScaling', {
        targetUtilizationPercent: 60,
        scaleInCooldown: cdk.Duration.seconds(300),
        scaleOutCooldown: cdk.Duration.seconds(300),
      });
    }

    // ---------- Output ----------
    new cdk.CfnOutput(this, 'PublicAlbDns', {
      value: this.publicAlbDnsName,
      exportName: `${id}-PublicAlbDns`,
    });
    new cdk.CfnOutput(this, 'EcsClusterName', {
      value: this.ecsClusterName,
      exportName: `${id}-EcsClusterName`,
    });

    // 7 タグ適用
    applyTags(this, environment, tenantId);
  }
}
