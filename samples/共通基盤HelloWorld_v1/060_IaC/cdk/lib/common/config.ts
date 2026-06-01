/**
 * lib/common/config.ts
 * 環境別設定の型定義とコンテキスト読み込みヘルパー
 *
 * 対応 PARAM: PARAM-001〜007 全般（環境差分列）
 * 作成: infra-iac
 * 作成日: 2026-06-01
 */

import * as cdk from 'aws-cdk-lib';

/** デプロイ対象パターン。-c pattern=A|B|C で選択 */
export type BatchPattern = 'A' | 'B' | 'C';

/** 環境識別子 */
export type Environment = 'dev' | 'stg' | 'prod';

/** WAF ルール動作モード（PARAM-002 §8.1） */
export type WafMode = 'count' | 'block';

/**
 * 環境別設定スキーマ
 * cdk.json の context.<env> セクションと対応する。
 * any 型禁止（IaC規約 §3 変数型定義）
 */
export interface EnvConfig {
  /** AWS Account ID */
  readonly accountId: string;
  /** デプロイリージョン（基本は ap-northeast-1） */
  readonly region: string;
  /** テナント識別子（PARAM-001 §2.1） */
  readonly tenantId: string;
  /** テナント VPC CIDR（PARAM-001 §2.1） */
  readonly vpcCidr: string;
  /** NAT Gateway 数。dev=1, stg/prod=2（PARAM-001 §5） */
  readonly natGateways: number;
  /** VPC Flow Logs 保持日数（PARAM-001 §8） */
  readonly flowLogsRetentionDays: number;
  /** CloudWatch Logs 保持日数（PARAM-004 §2.2） */
  readonly logsRetentionDays: number;
  /** ECS Fargate desiredCount（PARAM-002 §4.2） */
  readonly ecsDesiredCount: number;
  /** ECS タスク CPU（dev=256, prod=512 vCPU unit）（PARAM-002 §4.1） */
  readonly ecsCpu: number;
  /** ECS タスクメモリ（dev=512, prod=1024 MB）（PARAM-002 §4.1） */
  readonly ecsMemory: number;
  /** ALB 削除保護（prod=true）（PARAM-002 §6.1） */
  readonly albDeletionProtection: boolean;
  /** WAF ルールモード（PARAM-002 §8.1） */
  readonly wafMode: WafMode;
  /** TGW アタッチ有無（prod のみ接続）（PARAM-001 §7） */
  readonly tgwAttach: boolean;
  /** Auto Scaling 有効（dev=false）（PARAM-002 §4.3） */
  readonly enableAutoScaling: boolean;
}

/**
 * CDK Context からアプリ設定を読み込む。
 * -c environment=dev|stg|prod で切り替え（デフォルト: dev）
 */
export function loadEnvConfig(app: cdk.App): { env: Environment; config: EnvConfig } {
  const environment = (app.node.tryGetContext('environment') ?? 'dev') as Environment;
  const raw = app.node.tryGetContext(environment);
  if (!raw) {
    throw new Error(`cdk.json に context.${environment} が定義されていません`);
  }
  const config = raw as EnvConfig;
  return { env: environment, config };
}

/**
 * デプロイ対象バッチパターンを Context から読み込む。
 * -c pattern=A|B|C（未指定時は undefined = 全スタック対象）
 */
export function loadBatchPattern(app: cdk.App): BatchPattern | undefined {
  const raw = app.node.tryGetContext('pattern') as string | undefined;
  if (!raw) return undefined;
  const upper = raw.toUpperCase() as BatchPattern;
  if (!['A', 'B', 'C'].includes(upper)) {
    throw new Error(`-c pattern=A|B|C のいずれかを指定してください。入力値: ${raw}`);
  }
  return upper;
}

/** CDK Env オブジェクトを生成する */
export function cdkEnv(config: EnvConfig): cdk.Environment {
  return {
    account: config.accountId,
    region: config.region,
  };
}
