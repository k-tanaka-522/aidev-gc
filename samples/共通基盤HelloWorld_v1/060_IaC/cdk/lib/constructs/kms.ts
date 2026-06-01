/**
 * lib/constructs/kms.ts
 * HelloWorldKmsConstruct — テナント別データ CMK + アプリ共通 CMK 定義
 *
 * 対応 PARAM: PARAM-003 §2.1（テナント別データ CMK）/ §2.2（アプリ共通 CMK）
 * 作成: infra-iac
 * 作成日: 2026-06-01
 *
 * 設計ポイント:
 *   - 全 CMK は enable_key_rotation=true（年1回自動ローテーション、ISMAP CR-2）
 *   - テナント別 CMK はデータ暗号化専用（S3/SQS/EBS 等、PARAM-003 §2.1）
 *   - アプリ共通 CMK は ECR/Logs/Lambda 環境変数/Secrets 暗号化（PARAM-003 §2.2）
 *   - キーポリシーはテナント分離を実現（DenyCrossTenant）
 */

import * as cdk from 'aws-cdk-lib';
import * as kms from 'aws-cdk-lib/aws-kms';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as ssm from 'aws-cdk-lib/aws-ssm';
import { Construct } from 'constructs';
import { Environment, EnvConfig } from '../common/config';
import { applyTags, resourceName } from '../common/tags';
import { SSM_PATHS } from '../common/ssm-refs';

export interface HelloWorldKmsProps {
  readonly environment: Environment;
  readonly config: EnvConfig;
  /** テナント ID（例: 'A'） */
  readonly tenantId: string;
}

export class HelloWorldKmsConstruct extends Construct {
  /** テナント別データ CMK（PARAM-003 §2.1） */
  public readonly tenantDataCmk: kms.Key;
  /** アプリ共通 CMK（PARAM-003 §2.2） */
  public readonly appCommonCmk: kms.Key;

  constructor(scope: Construct, id: string, props: HelloWorldKmsProps) {
    super(scope, id);

    const { environment, config, tenantId } = props;

    // ---------- テナント別データ CMK ----------
    // 対応: PARAM-003 §2.1
    // 用途: S3 / SQS / EBS の暗号化。テナント間で鍵を共有しない。
    this.tenantDataCmk = new kms.Key(this, 'TenantDataCmk', {
      alias: `alias/helloworld-tenant-${tenantId}-data`,
      description: `Tenant ${tenantId} data CMK for S3/SQS/EBS`,
      enableKeyRotation: true, // PARAM-003 §2.1 enable_key_rotation=true
      keySpec: kms.KeySpec.SYMMETRIC_DEFAULT, // AES-256, PARAM-003 §2.1 key_spec
      keyUsage: kms.KeyUsage.ENCRYPT_DECRYPT,
      pendingWindow: cdk.Duration.days(30), // PARAM-003 §2.1 pending_window_in_days=30
      removalPolicy: cdk.RemovalPolicy.RETAIN, // 本番データ保護のため保持
      // キーポリシー: テナント分離（DenyCrossTenant）
      // Root アカウントはフルアクセス保持（AWS 推奨）
      // 各サービスロールへの kms:Decrypt は各スタックの Grant メソッドで追加
    });

    cdk.Tags.of(this.tenantDataCmk).add('tenant', tenantId);
    cdk.Tags.of(this.tenantDataCmk).add('compliance', 'ismap');
    cdk.Tags.of(this.tenantDataCmk).add('cost_center', `tenant-${tenantId}`);

    // ---------- アプリ共通 CMK ----------
    // 対応: PARAM-003 §2.2
    // 用途: ECR / CloudWatch Logs / Lambda 環境変数 / Secrets Manager
    this.appCommonCmk = new kms.Key(this, 'AppCommonCmk', {
      alias: 'alias/helloworld-app-common',
      description: 'App common CMK for ECR/Logs/Lambda',
      enableKeyRotation: true, // PARAM-003 §2.2 enable_key_rotation=true
      keySpec: kms.KeySpec.SYMMETRIC_DEFAULT,
      keyUsage: kms.KeyUsage.ENCRYPT_DECRYPT,
      pendingWindow: cdk.Duration.days(30),
      removalPolicy: cdk.RemovalPolicy.RETAIN,
    });

    // CloudWatch Logs サービスプリンシパルへのアクセス許可（Logs 暗号化に必要）
    this.appCommonCmk.addToResourcePolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        principals: [
          new iam.ServicePrincipal(`logs.${config.region}.amazonaws.com`),
        ],
        actions: [
          'kms:Encrypt',
          'kms:Decrypt',
          'kms:ReEncrypt*',
          'kms:GenerateDataKey*',
          'kms:DescribeKey',
        ],
        resources: ['*'],
        conditions: {
          ArnLike: {
            'kms:EncryptionContext:aws:logs:arn': `arn:aws:logs:${config.region}:${config.accountId}:*`,
          },
        },
      }),
    );

    // アプリ共通 CMK ARN を SSM Parameter Store に出力
    // 他スタックは ssm-refs.ts の getAppCommonCmkArnFromSsm() で参照
    new ssm.StringParameter(this, 'AppCommonCmkArnParam', {
      parameterName: SSM_PATHS.appCommonCmkArn,
      stringValue: this.appCommonCmk.keyArn,
      description: 'HelloWorld App Common CMK ARN',
    });

    cdk.Tags.of(this.appCommonCmk).add('compliance', 'ismap');

    // 7 タグ適用
    applyTags(this, environment, tenantId);
  }
}
