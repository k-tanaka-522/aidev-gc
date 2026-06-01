/**
 * lib/stacks/waf-cloudfront-stack.ts
 * WafCloudFrontStack — CloudFront Distribution + WAF Web ACL (us-east-1)
 *
 * 対応 PARAM: PARAM-002 §7（CloudFront）/ §8.1（WAF CLOUDFRONT scope）
 * 作成: infra-iac
 * 作成日: 2026-06-01
 *
 * 重要: CloudFront WAF は scope=CLOUDFRONT のため、us-east-1 にデプロイする必要がある。
 *       bin/app.ts で `env: { region: 'us-east-1' }` を指定している（CDK設計書 §5.2）。
 *
 * Phase3 引き継ぎ注意:
 *   WAF us-east-1 分離（CDK設計書 付録B）
 *   CloudFront に ACM 証明書を紐付ける際も us-east-1 の証明書 ARN が必要
 */

import * as cdk from 'aws-cdk-lib';
import * as cloudfront from 'aws-cdk-lib/aws-cloudfront';
import * as origins from 'aws-cdk-lib/aws-cloudfront-origins';
import * as wafv2 from 'aws-cdk-lib/aws-wafv2';
import { Construct } from 'constructs';
import { Environment, EnvConfig } from '../common/config';
import { applyTags, resourceName } from '../common/tags';

export interface WafCloudFrontStackProps extends cdk.StackProps {
  readonly environment: Environment;
  readonly config: EnvConfig;
  /** 公開 ALB DNS 名（CloudFront Origin）*/
  readonly publicAlbDnsName: string;
}

export class WafCloudFrontStack extends cdk.Stack {
  /** CloudFront Distribution ID */
  public readonly distributionId: string;

  constructor(scope: Construct, id: string, props: WafCloudFrontStackProps) {
    super(scope, id, props);

    const { environment, config: envConfig, publicAlbDnsName } = props;
    const tenantId = envConfig.tenantId;
    const name = (suffix: string) => resourceName(tenantId, suffix);

    // ---------- WAF Web ACL（CLOUDFRONT scope）----------
    // 対応: PARAM-002 §8.1
    // 注意: scope=CLOUDFRONT は us-east-1 のみ有効。本スタックは us-east-1 デプロイ前提。
    const cfWafWebAcl = new wafv2.CfnWebACL(this, 'CfWebAcl', {
      name: name('cf-waf'),
      scope: 'CLOUDFRONT', // PARAM-002 §8.1 scope=CLOUDFRONT
      defaultAction: { allow: {} },
      visibilityConfig: {
        cloudWatchMetricsEnabled: true,
        metricName: name('cf-waf'),
        sampledRequestsEnabled: true,
      },
      rules: [
        // 優先度 1: AWSManagedRulesCommonRuleSet（PARAM-002 §8.1）
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
        // 優先度 3: AWSManagedRulesAmazonIpReputationList
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
        // 優先度 5: レートリミット（PARAM-002 §8.1）
        {
          name: 'RateLimitRule',
          priority: 5,
          action: envConfig.wafMode === 'count' ? { count: {} } : { block: {} },
          statement: {
            rateBasedStatement: {
              limit: 1000,
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

    // ---------- CloudFront Distribution ----------
    // 対応: PARAM-002 §7
    // Hello World 相当のため No Cache ポリシー使用（PARAM-002 §7 CachingDisabled）
    const distribution = new cloudfront.Distribution(this, 'Distribution', {
      comment: name('distribution'), // PARAM-002 §7 comment
      defaultBehavior: {
        origin: new origins.HttpOrigin(publicAlbDnsName, {
          protocolPolicy: cloudfront.OriginProtocolPolicy.HTTPS_ONLY, // PARAM-002 §7 https-only
          httpPort: 80,
          httpsPort: 443,
        }),
        viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS, // PARAM-002 §7
        cachePolicy: cloudfront.CachePolicy.CACHING_DISABLED, // PARAM-002 §7 CachingDisabled
        originRequestPolicy: cloudfront.OriginRequestPolicy.ALL_VIEWER, // PARAM-002 §7
        allowedMethods: cloudfront.AllowedMethods.ALLOW_ALL,
      },
      priceClass: envConfig.albDeletionProtection
        ? cloudfront.PriceClass.PRICE_CLASS_ALL  // prod: PriceClass_All（PARAM-002 §7）
        : cloudfront.PriceClass.PRICE_CLASS_100, // dev: PriceClass_100（コスト考慮）
      minimumProtocolVersion: cloudfront.SecurityPolicyProtocol.TLS_V1_2_2021, // PARAM-002 §7 SEC-001 §5.5
      webAclId: cfWafWebAcl.attrArn, // PARAM-002 §7 web_acl_id
      // ACM 証明書（prod のみカスタムドメイン、PARAM-002 §7）
      // domainNames: envConfig.albDeletionProtection
      //   ? [`www.helloworld-tenant-${tenantId}.example.go.jp`]
      //   : undefined,
      // certificate: envConfig.albDeletionProtection
      //   ? acm.Certificate.fromCertificateArn(this, 'Cert', 'ACM_CERT_ARN_US_EAST_1')
      //   : undefined,
      enableLogging: false, // スケルトン: S3 ログバケット設定は省略（MonitoringStack で管理）
    });

    this.distributionId = distribution.distributionId;

    new cdk.CfnOutput(this, 'DistributionId', {
      value: this.distributionId,
      exportName: `${id}-DistributionId`,
    });
    new cdk.CfnOutput(this, 'DistributionDomain', {
      value: distribution.distributionDomainName,
      exportName: `${id}-DistributionDomain`,
    });

    // 7 タグ適用
    applyTags(this, environment, tenantId);
  }
}
