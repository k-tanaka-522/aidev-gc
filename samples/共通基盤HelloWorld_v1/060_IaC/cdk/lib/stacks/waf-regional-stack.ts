/**
 * lib/stacks/waf-regional-stack.ts
 * WafRegionalStack — ALB 用 WAF Web ACL (scope=REGIONAL, ap-northeast-1)
 *
 * 対応 PARAM: PARAM-002 §8.2
 * 作成: infra-iac
 * 作成日: 2026-06-01
 *
 * 設計ポイント:
 *   - WAFv2 に対応する CDK L2 Construct は存在しないため、L1 (CfnWebACL) を使用（CDK設計書 §3.2）
 *   - dev は Count モード、stg/prod は Block モード（PARAM-002 §8.1 wafMode）
 *   - ALB への直アクセスバイパス防止のため CloudFront WAF と同一ルールセットを適用（SEC-001 §6.1）
 */

import * as cdk from 'aws-cdk-lib';
import * as wafv2 from 'aws-cdk-lib/aws-wafv2';
import { Construct } from 'constructs';
import { NagSuppressions } from 'cdk-nag';
import { Environment, EnvConfig } from '../common/config';
import { applyTags, resourceName } from '../common/tags';

export interface WafRegionalStackProps extends cdk.StackProps {
  readonly environment: Environment;
  readonly config: EnvConfig;
}

export class WafRegionalStack extends cdk.Stack {
  /** ALB 用 WAF Web ACL ARN */
  public readonly webAclArn: string;

  constructor(scope: Construct, id: string, props: WafRegionalStackProps) {
    super(scope, id, props);

    const { environment, config: envConfig } = props;
    const tenantId = envConfig.tenantId;
    const name = (suffix: string) => resourceName(tenantId, suffix);

    // WAF ルールのアクション: dev=Count, stg/prod=Block（PARAM-002 §8.1 wafMode）
    const ruleAction = (ruleOverride?: string): wafv2.CfnWebACL.RuleActionProperty => {
      if (envConfig.wafMode === 'count') {
        return { count: {} };
      }
      return { block: {} };
    };

    // ---------- WAF Web ACL（REGIONAL scope）----------
    // 対応: PARAM-002 §8.2（CloudFront WAF と同一ルールセット）
    const webAcl = new wafv2.CfnWebACL(this, 'WebAclRegional', {
      name: name('alb-waf'),
      scope: 'REGIONAL',          // ALB 用（ap-northeast-1）
      defaultAction: { allow: {} }, // PARAM-002 §8.1 default_action=allow
      visibilityConfig: {
        cloudWatchMetricsEnabled: true,
        metricName: name('alb-waf'),
        sampledRequestsEnabled: true,
      },
      rules: [
        // 優先度 1: AWSManagedRulesCommonRuleSet（PARAM-002 §8.1 ISMAP NW-5）
        {
          name: 'AWSManagedRulesCommonRuleSet',
          priority: 1,
          overrideAction: envConfig.wafMode === 'count' ? { count: {} } : { none: {} },
          statement: {
            managedRuleGroupStatement: {
              vendorName: 'AWS',
              name: 'AWSManagedRulesCommonRuleSet',
            },
          },
          visibilityConfig: {
            cloudWatchMetricsEnabled: true,
            metricName: 'AWSManagedRulesCommonRuleSet',
            sampledRequestsEnabled: true,
          },
        },
        // 優先度 2: AWSManagedRulesKnownBadInputsRuleSet
        {
          name: 'AWSManagedRulesKnownBadInputsRuleSet',
          priority: 2,
          overrideAction: envConfig.wafMode === 'count' ? { count: {} } : { none: {} },
          statement: {
            managedRuleGroupStatement: {
              vendorName: 'AWS',
              name: 'AWSManagedRulesKnownBadInputsRuleSet',
            },
          },
          visibilityConfig: {
            cloudWatchMetricsEnabled: true,
            metricName: 'AWSManagedRulesKnownBadInputsRuleSet',
            sampledRequestsEnabled: true,
          },
        },
        // 優先度 3: AWSManagedRulesAmazonIpReputationList（PARAM-002 §8.1）
        {
          name: 'AWSManagedRulesAmazonIpReputationList',
          priority: 3,
          overrideAction: envConfig.wafMode === 'count' ? { count: {} } : { none: {} },
          statement: {
            managedRuleGroupStatement: {
              vendorName: 'AWS',
              name: 'AWSManagedRulesAmazonIpReputationList',
            },
          },
          visibilityConfig: {
            cloudWatchMetricsEnabled: true,
            metricName: 'AWSManagedRulesAmazonIpReputationList',
            sampledRequestsEnabled: true,
          },
        },
        // 優先度 4: AWSManagedRulesLinuxRuleSet
        {
          name: 'AWSManagedRulesLinuxRuleSet',
          priority: 4,
          overrideAction: envConfig.wafMode === 'count' ? { count: {} } : { none: {} },
          statement: {
            managedRuleGroupStatement: {
              vendorName: 'AWS',
              name: 'AWSManagedRulesLinuxRuleSet',
            },
          },
          visibilityConfig: {
            cloudWatchMetricsEnabled: true,
            metricName: 'AWSManagedRulesLinuxRuleSet',
            sampledRequestsEnabled: true,
          },
        },
        // 優先度 5: レートリミット（PARAM-002 §8.1 1000req/5min）
        {
          name: 'RateLimitRule',
          priority: 5,
          action: ruleAction(),
          statement: {
            rateBasedStatement: {
              limit: 1000, // PARAM-002 §8.1 QA-108 1000req/5min
              aggregateKeyType: 'IP',
            },
          },
          visibilityConfig: {
            cloudWatchMetricsEnabled: true,
            metricName: 'RateLimitRule',
            sampledRequestsEnabled: true,
          },
        },
      ],
    });

    this.webAclArn = webAcl.attrArn;

    // ---------- WAF ログ設定 ----------
    // 対応: PARAM-002 §8.1（Firehose → S3、本スタックはスケルトン。実際は Firehose / S3 リソースも必要）
    // スケルトン: WAF ログ設定はコメントアウト（Firehose は MonitoringStack または独立スタックで定義推奨）
    // new wafv2.CfnLoggingConfiguration(this, 'WafLogging', {
    //   resourceArn: webAcl.attrArn,
    //   logDestinationConfigs: [`arn:aws:firehose:${this.region}:${this.account}:deliverystream/aws-waf-logs-helloworld`],
    // });

    new cdk.CfnOutput(this, 'WebAclArn', {
      value: this.webAclArn,
      exportName: `${id}-WebAclArn`,
    });

    // 7 タグ適用
    applyTags(this, environment, tenantId);
  }
}
