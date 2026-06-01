/**
 * lib/common/tags.ts
 * タグ統制ヘルパー（7 必須タグ）
 *
 * 対応 PARAM: PARAM-001 §2.1 タグ列（GC-002 §4.6 タグ統制規約）
 * 作成: infra-iac
 * 作成日: 2026-06-01
 *
 * GC タグ統制 7 キー:
 *   environment / owner / cost_center / project / tenant / compliance / pattern
 * IaC 規約: 全リソースに 7 タグを付与。SCP で compliance=ismap を必須化。
 */

import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { Environment, BatchPattern } from './config';

/** タグ 7 キーの型定義（any 禁止） */
export interface HelloWorldTags {
  readonly environment: Environment;
  readonly owner: string;
  readonly cost_center: string;
  readonly project: string;
  readonly tenant: string;
  readonly compliance: string;
  readonly pattern?: string;
}

/** デフォルトタグセット（PARAM-001 §2.1 タグ列より） */
const DEFAULT_OWNER = 'team-helloworld@example.go.jp';
const DEFAULT_PROJECT = 'helloworld-archcmp';
const DEFAULT_COMPLIANCE = 'ismap';

/**
 * スコープ配下の全リソースに 7 タグを適用する。
 * Construct/Stack の constructor 内で呼び出す。
 */
export function applyTags(
  scope: Construct,
  env: Environment,
  tenantId: string,
  pattern?: BatchPattern,
): void {
  const costCenter = `tenant-${tenantId}`;
  const patternValue = pattern ? patternTagValue(pattern) : 'common';

  cdk.Tags.of(scope).add('environment', env);
  cdk.Tags.of(scope).add('owner', DEFAULT_OWNER);
  cdk.Tags.of(scope).add('cost_center', costCenter);
  cdk.Tags.of(scope).add('project', DEFAULT_PROJECT);
  cdk.Tags.of(scope).add('tenant', tenantId);
  cdk.Tags.of(scope).add('compliance', DEFAULT_COMPLIANCE);
  cdk.Tags.of(scope).add('pattern', patternValue);
}

/** パターン A/B/C → タグ値変換（GC-002 §4.6） */
function patternTagValue(pattern: BatchPattern): string {
  const map: Record<BatchPattern, string> = {
    A: 'lambda',
    B: 'batch',
    C: 'sqs-fargate',
  };
  return map[pattern];
}

/**
 * リソース命名ヘルパー。
 * 命名規則: helloworld-tenant-{T}-{resource}  (snake_case)
 * 例: helloworld-tenant-A-vpc
 */
export function resourceName(tenantId: string, resource: string): string {
  return `helloworld-tenant-${tenantId}-${resource}`;
}

/**
 * パターン固有リソース命名。
 * 例: helloworld-tenant-A-batch-pattern-A
 */
export function patternResourceName(
  tenantId: string,
  resource: string,
  pattern: BatchPattern,
): string {
  return `helloworld-tenant-${tenantId}-${resource}-pattern-${pattern}`;
}
