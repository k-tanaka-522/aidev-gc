#!/usr/bin/env node
/**
 * bin/app.ts
 * CDK App エントリポイント
 *
 * 対応 PARAM: PARAM-001〜007 全般
 * 作成: infra-iac
 * 作成日: 2026-06-01
 *
 * 使用方法:
 *   cdk deploy --all -c environment=dev              # 全スタック（dev）
 *   cdk deploy --all -c environment=prod -c pattern=A # パターン A のみ（prod）
 *   cdk deploy --all -c environment=stg -c pattern=C  # パターン C のみ（stg）
 *
 * スタック登録順（依存関係に沿って順序管理）:
 *   1. SecurityStack      → CMK / IAM PB / Config / GuardDuty 参照
 *   2. NetworkStack       → VPC / SG / Endpoint / TGW Attach
 *   3. OnlineStack        → ECR / ECS / ALB / Route53
 *   4. WafRegionalStack   → ALB 用 WAF (ap-northeast-1)
 *   5. WafCloudFrontStack → CF + WAF (us-east-1)
 *   6. MonitoringStack    → CW Logs / Alarms / Dashboard
 *   7. PatternXxxStack    → パターン A/B/C（-c pattern で選択）
 */

import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { Aspects } from 'aws-cdk-lib';
import { AwsSolutionsChecks } from 'cdk-nag';

import { loadEnvConfig, loadBatchPattern, cdkEnv } from '../lib/common/config';
import { SecurityStack } from '../lib/stacks/security-stack';
import { NetworkStack } from '../lib/stacks/network-stack';
import { OnlineStack } from '../lib/stacks/online-stack';
import { WafRegionalStack } from '../lib/stacks/waf-regional-stack';
import { WafCloudFrontStack } from '../lib/stacks/waf-cloudfront-stack';
import { MonitoringStack } from '../lib/stacks/monitoring-stack';
import { PatternALambdaStack } from '../lib/stacks/pattern-a-lambda-stack';
import { PatternBBatchStack } from '../lib/stacks/pattern-b-batch-stack';
import { PatternCSqsFargateStack } from '../lib/stacks/pattern-c-sqs-fargate-stack';

const app = new cdk.App();

// cdk-nag: 全スタックに AwsSolutionsChecks を適用（ISMAP / GC ガードレール準拠確認）
// CDK設計書 §6.3 参照
Aspects.of(app).add(new AwsSolutionsChecks({ verbose: true }));

// Context 読み込み
const { env: environment, config } = loadEnvConfig(app);
const batchPattern = loadBatchPattern(app); // undefined = 全パターン対象

const stackPrefix = `HelloWorld-${environment}`;
const mainEnv = cdkEnv(config);

// ---------- 共通スタック ----------

// 1. SecurityStack: KMS CMK / IAM Permission Boundary / Config Rules / GuardDuty / SecurityHub
//    PARAM-003 §2〜10 対応
const securityStack = new SecurityStack(app, `${stackPrefix}-SecurityStack`, {
  env: mainEnv,
  environment,
  config,
});

// 2. NetworkStack: VPC / Subnet / Route Table / IGW / NAT GW / TGW Attach / VPC Endpoint / SG / NACL / Flow Logs
//    PARAM-001 §2〜12 対応
const networkStack = new NetworkStack(app, `${stackPrefix}-NetworkStack`, {
  env: mainEnv,
  environment,
  config,
  appCommonCmkArn: securityStack.appCommonCmkArn,
});
networkStack.addDependency(securityStack);

// 3. OnlineStack: ECR / ECS Cluster + Service (public/private) / ALB (公開/内部) / Route53 PHZ
//    PARAM-002 §2〜6, §9〜10 対応
const onlineStack = new OnlineStack(app, `${stackPrefix}-OnlineStack`, {
  env: mainEnv,
  environment,
  config,
  vpc: networkStack.vpc,
  sgPublicAlb: networkStack.sgPublicAlb,
  sgInternalAlb: networkStack.sgInternalAlb,
  sgFargateApp: networkStack.sgFargateApp,
  publicSubnetIds: networkStack.publicSubnetIds,
  privateAppSubnetIds: networkStack.privateAppSubnetIds,
  appCommonCmkArn: securityStack.appCommonCmkArn,
});
onlineStack.addDependency(networkStack);

// 4. WafRegionalStack: ALB 用 WAF (scope=REGIONAL, ap-northeast-1)
//    PARAM-002 §8.2 対応
const wafRegionalStack = new WafRegionalStack(app, `${stackPrefix}-WafRegionalStack`, {
  env: mainEnv,
  environment,
  config,
});
wafRegionalStack.addDependency(networkStack);

// 5. WafCloudFrontStack: CloudFront Distribution + WAF (scope=CLOUDFRONT, us-east-1)
//    PARAM-002 §7〜8.1 対応
//    注意: CloudFront WAF は us-east-1 必須（CDK設計書 §5.2）
const wafCloudFrontStack = new WafCloudFrontStack(app, `${stackPrefix}-WafCloudFrontStack`, {
  env: { account: config.accountId, region: 'us-east-1' },
  environment,
  config,
  publicAlbDnsName: onlineStack.publicAlbDnsName,
});
wafCloudFrontStack.addDependency(onlineStack);

// 6. MonitoringStack: CloudWatch Logs / Alarms / Dashboard / SNS Topics
//    PARAM-004 §2〜6 対応
const monitoringStack = new MonitoringStack(app, `${stackPrefix}-MonitoringStack`, {
  env: mainEnv,
  environment,
  config,
  appCommonCmkArn: securityStack.appCommonCmkArn,
  ecsClusterName: onlineStack.ecsClusterName,
  publicAlbFullName: onlineStack.publicAlbFullName,
  internalAlbFullName: onlineStack.internalAlbFullName,
  publicTargetGroupFullName: onlineStack.publicTargetGroupFullName,
  privateTargetGroupFullName: onlineStack.privateTargetGroupFullName,
});
monitoringStack.addDependency(onlineStack);

// ---------- パターン固有スタック ----------
// -c pattern=A|B|C で選択デプロイ可能（未指定時は全パターン）

// 7. PatternALambdaStack: Lambda / EventBridge スケジュール / SQS DLQ / S3 / Alarms
//    PARAM-005 §2〜9 対応
if (!batchPattern || batchPattern === 'A') {
  const patternAStack = new PatternALambdaStack(app, `${stackPrefix}-PatternALambdaStack`, {
    env: mainEnv,
    environment,
    config,
    vpc: networkStack.vpc,
    sgBatchA: networkStack.sgBatchA,
    privateBatchSubnetIds: networkStack.privateBatchSubnetIds,
    appCommonCmkArn: securityStack.appCommonCmkArn,
    tenantDataCmkArn: securityStack.tenantDataCmkArn,
    appAlertsSnsArn: monitoringStack.appAlertsSnsArn,
  });
  patternAStack.addDependency(monitoringStack);
}

// 8. PatternBBatchStack: AWS Batch CE / Job Queue / Job Definition / ECR / Alarms
//    PARAM-006 §2〜12 対応（Batch CE は L1 使用: CDK設計書 付録B）
if (!batchPattern || batchPattern === 'B') {
  const patternBStack = new PatternBBatchStack(app, `${stackPrefix}-PatternBBatchStack`, {
    env: mainEnv,
    environment,
    config,
    vpc: networkStack.vpc,
    sgBatchB: networkStack.sgBatchB,
    privateBatchSubnetIds: networkStack.privateBatchSubnetIds,
    appCommonCmkArn: securityStack.appCommonCmkArn,
    tenantDataCmkArn: securityStack.tenantDataCmkArn,
    appAlertsSnsArn: monitoringStack.appAlertsSnsArn,
  });
  patternBStack.addDependency(monitoringStack);
}

// 9. PatternCSqsFargateStack: SQS / DLQ / ECR / ECS Worker / Auto Scaling (キュー深度連動) / Alarms
//    PARAM-007 §2〜12 対応
if (!batchPattern || batchPattern === 'C') {
  const patternCStack = new PatternCSqsFargateStack(
    app,
    `${stackPrefix}-PatternCSqsFargateStack`,
    {
      env: mainEnv,
      environment,
      config,
      vpc: networkStack.vpc,
      sgBatchC: networkStack.sgBatchC,
      privateBatchSubnetIds: networkStack.privateBatchSubnetIds,
      ecsCluster: onlineStack.ecsCluster,
      appCommonCmkArn: securityStack.appCommonCmkArn,
      tenantDataCmkArn: securityStack.tenantDataCmkArn,
      appAlertsSnsArn: monitoringStack.appAlertsSnsArn,
    },
  );
  patternCStack.addDependency(monitoringStack);
}

app.synth();
