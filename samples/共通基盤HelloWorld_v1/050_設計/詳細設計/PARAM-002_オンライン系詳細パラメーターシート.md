---
artifact_id: PARAM-002
title: オンライン系詳細パラメーターシート（ECS Fargate / ALB / CloudFront / WAF / ECR）
version: 1.0
status: draft
author: "[infra-iac] (iac-implementation)"
reviewer: ""
approved_by: ""
created_at: 2026-06-01
updated_at: 2026-06-01
phase: 4
dependencies:
  - artifact: GC-002
    title: GC環境・システム全体構成 基本設計書
    section: "§5.3 オンライン処理 / §7.1 共通部構成要素一覧"
    reason: "オンライン ECS Fargate 公開/非公開サービス・ALB・CloudFront・WAF・ECR の構成要素を入力"
  - artifact: NW-001
    title: ネットワーク基本設計書
    section: "§7 オンライン経路設計 / §10 SG/NACL"
    reason: "公開/プライベート経路のサブネット・SG配置・ALBタイプを継承"
  - artifact: SEC-001
    title: セキュリティ基本設計書
    section: "§4.5 サービスロール / §5 KMS暗号化 / §6.1 WAF / §6.3 SG詳細"
    reason: "タスクロール・暗号化・WAF Web ACL・SGルール詳細を継承"
---

# オンライン系詳細パラメーターシート

## 改訂履歴

| バージョン | 更新日 | 更新者 | 変更内容 | ステータス |
|-----------|--------|--------|--------|----------|
| 1.0 | 2026-06-01 | infra-iac | 初版作成。GC-002/NW-001/SEC-001 を入力に、ECS Fargate（公開・非公開）・ALB・CloudFront・WAF・ECR の CDK 実装入力レベルパラメーターを展開 | draft |

---

## 1. 凡例・環境差分の考え方

| 環境 | 主な差分点 |
|------|----------|
| dev | desiredCount=1、cpu/memory 最小、ALB は HTTP/HTTPS どちらでも可、WAF は Count モードのみ |
| stg | desiredCount=1〜2、WAF Block モード有効、ACM 証明書を用いた HTTPS |
| prod | desiredCount=2（最小）〜Auto Scaling 上限に従う、WAF Block モード、削除保護 ON |

---

## 2. ECR（Elastic Container Registry）

根拠: GC-002 §7.1 コンテナ基盤

### 2.1 ECR リポジトリ（共有 Tooling / 全パターン共通）

| パラメーター | 値 | dev差分 | 備考 |
|------------|-----|--------|------|
| repository_name | `helloworld/online-app` | — | 公開・非公開サービス共用 |
| image_tag_mutability | `IMMUTABLE` | — | タグ書き換え禁止（SEC 要件） |
| scan_on_push | `true` | — | VN-7 ECR Image Scanning 有効 |
| encryption_type | `KMS` | — | |
| kms_key (ARN) | アプリ共通 CMK ARN | — | SEC-001 §5.3 アプリ共通 CMK |
| タグ: Name | `helloworld-ecr-online` | — | |
| タグ: environment | `dev/stg/prod` | 各環境値 | |
| タグ: owner | `team-helloworld@example.go.jp` | — | |
| タグ: cost_center | `shared` | — | |
| タグ: project | `helloworld-archcmp` | — | |
| タグ: compliance | `ismap` | — | SCP 必須 |

---

## 3. ECS Cluster

根拠: GC-002 §5.3

| パラメーター | 値 | dev差分 | 備考 |
|------------|-----|--------|------|
| cluster_name | `helloworld-tenant-A-cluster` | — | テナント毎 |
| container_insights | `enabled` | — | CloudWatch Container Insights |
| タグ: Name | `helloworld-tenant-A-cluster` | — | |
| タグ: tenant | `A` | — | |
| タグ: environment | `dev/stg/prod` | 各環境値 | |
| タグ: compliance | `ismap` | — | |

---

## 4. ECS Fargate サービス／タスク定義（公開サービス）

根拠: GC-002 §5.3 パブリックサービス

### 4.1 タスク定義（公開）

| パラメーター | 値 | dev差分 | 備考 |
|------------|-----|--------|------|
| family | `helloworld-tenant-A-public` | — | |
| requires_compatibilities | `FARGATE` | — | |
| network_mode | `awsvpc` | — | |
| cpu | `512` | dev=256 | prod は要件で増量可 |
| memory | `1024` | dev=512 | |
| execution_role_arn | `arn:aws:iam::<account-id>:role/ecsTaskExecutionRole` | — | SEC-001 §4.5 |
| task_role_arn | `arn:aws:iam::<account-id>:role/ecsTaskRole-online` | — | |
| コンテナ名 | `app` | — | |
| image | `<account-id>.dkr.ecr.ap-northeast-1.amazonaws.com/helloworld/online-app:latest` | — | |
| containerPort | `8080` | — | |
| log_driver | `awslogs` | — | |
| log_group | `/helloworld/ecs/tenant-A/public` | — | |
| log_region | `ap-northeast-1` | — | |
| kms_key（Logs） | アプリ共通 CMK ARN | — | SEC-001 §5.1 No.3 |

### 4.2 ECS サービス（公開）

| パラメーター | 値 | dev差分 | 備考 |
|------------|-----|--------|------|
| service_name | `helloworld-tenant-A-public-svc` | — | |
| launch_type | `FARGATE` | — | |
| desired_count | `2` | dev=1 | |
| subnet_ids | Private-App-1a, Private-App-1c | — | NW-001 §4.2 |
| security_group_ids | sg-fargate-app | — | PARAM-001 §10 |
| assign_public_ip | `DISABLED` | — | Private Subnet |
| load_balancer_target_group_arn | 公開 ALB TG ARN | — | §5 参照 |
| container_name | `app` | — | |
| container_port | `8080` | — | |
| deployment_minimum_healthy_percent | `100` | dev=50 | |
| deployment_maximum_percent | `200` | — | |
| health_check_grace_period_seconds | `60` | dev=30 | |
| enable_execute_command | `false` | dev=true | 開発時デバッグ用 |
| タグ: tenant | `A` | — | |
| タグ: compliance | `ismap` | — | |

### 4.3 Auto Scaling（公開サービス）

| パラメーター | 値 | dev差分 | 備考 |
|------------|-----|--------|------|
| min_capacity | `2` | dev=1 | |
| max_capacity | `10` | dev=2 | |
| スケールアウトポリシー | CPU 使用率 > 60% → +1 task | — | |
| スケールインポリシー | CPU 使用率 < 30% → -1 task | — | |
| cooldown_seconds | `300` | — | |

---

## 5. ECS Fargate サービス／タスク定義（非公開サービス）

根拠: GC-002 §5.3 プライベートサービス

### 5.1 タスク定義（非公開）

| パラメーター | 値 | dev差分 | 備考 |
|------------|-----|--------|------|
| family | `helloworld-tenant-A-private` | — | |
| cpu | `512` | dev=256 | |
| memory | `1024` | dev=512 | |
| execution_role_arn | `arn:aws:iam::<account-id>:role/ecsTaskExecutionRole` | — | |
| task_role_arn | `arn:aws:iam::<account-id>:role/ecsTaskRole-online` | — | |
| コンテナ名 | `app` | — | |
| containerPort | `8080` | — | |
| log_group | `/helloworld/ecs/tenant-A/private` | — | |
| kms_key（Logs） | アプリ共通 CMK ARN | — | |

### 5.2 ECS サービス（非公開）

| パラメーター | 値 | dev差分 | 備考 |
|------------|-----|--------|------|
| service_name | `helloworld-tenant-A-private-svc` | — | |
| desired_count | `2` | dev=1 | |
| subnet_ids | Private-App-1a, Private-App-1c | — | |
| security_group_ids | sg-fargate-app | — | |
| assign_public_ip | `DISABLED` | — | |
| load_balancer_target_group_arn | 内部 ALB TG ARN | — | §6 参照 |

### 5.3 Auto Scaling（非公開サービス）

| パラメーター | 値 | dev差分 | 備考 |
|------------|-----|--------|------|
| min_capacity | `2` | dev=1 | |
| max_capacity | `6` | dev=2 | 庁内利用は公開より低上限 |
| スケールアウトポリシー | CPU > 60% | — | |
| cooldown_seconds | `300` | — | |

---

## 6. ALB（公開 / 内部）

根拠: GC-002 §5.3 / NW-001 §7

### 6.1 公開 ALB

| パラメーター | 値 | dev差分 | 備考 |
|------------|-----|--------|------|
| name | `helloworld-tenant-A-public-alb` | — | |
| load_balancer_type | `application` | — | |
| scheme | `internet-facing` | — | CloudFront Origin |
| subnets | Public-1a, Public-1c | — | NW-001 §4.2 |
| security_groups | sg-public-alb | — | |
| drop_invalid_header_fields | `true` | — | ISMAP NW-3 |
| deletion_protection | `true` | dev=false | prod のみ |
| access_logs.enabled | `true` | — | S3 + CMK |
| access_logs.bucket | `helloworld-alb-logs-tenant-A` | — | |

**リスナー（公開 ALB）**:

| リスナー | ポート | プロトコル | デフォルトアクション | 備考 |
|---------|-------|----------|------------------|------|
| HTTPS | 443 | HTTPS | Forward → TG-public | ACM 証明書 |
| HTTP | 80 | HTTP | Redirect → 443 | HTTP→HTTPS 強制 |

**ターゲットグループ（公開 ALB）**:

| パラメーター | 値 | 備考 |
|------------|-----|------|
| name | `helloworld-A-public-tg` | |
| port | `8080` | |
| protocol | `HTTP` | ALB-TG 間は内部 HTTP |
| target_type | `ip` | Fargate は ip タイプ |
| health_check_path | `/actuator/health` | Spring Boot Actuator |
| health_check_interval | `30` | |
| health_check_timeout | `5` | |
| healthy_threshold_count | `2` | |
| unhealthy_threshold_count | `3` | |
| deregistration_delay | `30` | dev=10 |

### 6.2 内部 ALB（プライベートサービス）

| パラメーター | 値 | dev差分 | 備考 |
|------------|-----|--------|------|
| name | `helloworld-tenant-A-internal-alb` | — | |
| scheme | `internal` | — | インターネット非公開 |
| subnets | Private-App-1a, Private-App-1c | — | |
| security_groups | sg-internal-alb | — | |
| deletion_protection | `true` | dev=false | |

**リスナー（内部 ALB）**:

| リスナー | ポート | プロトコル | デフォルトアクション | 備考 |
|---------|-------|----------|------------------|------|
| HTTPS | 443 | HTTPS | Forward → TG-private | ACM 証明書 (ap-northeast-1) |

**ターゲットグループ（内部 ALB）**:

| パラメーター | 値 | 備考 |
|------------|-----|------|
| name | `helloworld-A-private-tg` | |
| port | `8080` | |
| target_type | `ip` | |
| health_check_path | `/actuator/health` | |

---

## 7. CloudFront Distribution

根拠: GC-002 §7.1 公開系 / SEC-001 §6.1

| パラメーター | 値 | dev差分 | 備考 |
|------------|-----|--------|------|
| enabled | `true` | — | |
| comment | `helloworld-tenant-A-distribution` | — | |
| price_class | `PriceClass_All` | dev=PriceClass_100 | コスト考慮 |
| origin.domain_name | 公開 ALB DNS 名 | — | ALB Origin |
| origin.protocol_policy | `https-only` | — | ALB へは HTTPS |
| origin_request_policy | AWS マネージド: AllViewer | — | ヘッダ/クエリ文字列転送 |
| cache_policy | AWS マネージド: CachingDisabled | — | Hello World は No Cache でよい |
| viewer_protocol_policy | `redirect-to-https` | — | HTTP→HTTPS 強制 |
| minimum_protocol_version | `TLSv1.2_2021` | — | SEC-001 §5.5 |
| certificate_arn | ACM ARN (us-east-1) | — | CloudFront 用は us-east-1 |
| aliases | `www.helloworld-tenant-A.example.go.jp` | dev=なし | prod のみカスタムドメイン |
| web_acl_id | WAF Web ACL ARN (us-east-1) | — | §8 参照 |
| logging_config.bucket | `helloworld-cf-logs-tenant-A.s3.amazonaws.com` | — | アクセスログ |
| タグ: compliance | `ismap` | — | |

---

## 8. WAF（Web Application Firewall）

根拠: SEC-001 §6.1

### 8.1 Web ACL（CloudFront 用、scope=CLOUDFRONT、リージョン: us-east-1）

| パラメーター | 値 | dev差分 | 備考 |
|------------|-----|--------|------|
| name | `helloworld-tenant-A-cf-waf` | — | |
| scope | `CLOUDFRONT` | — | CloudFront 専用 |
| default_action | `allow` | — | ルールで明示 Block |

**マネージドルールグループ（CloudFront WAF）**:

| 優先度 | ルール名 | アクション (dev) | アクション (prod) | ISMAP |
|-------|---------|----------------|-----------------|-------|
| 1 | AWSManagedRulesCommonRuleSet | Count | Block | NW-5 |
| 2 | AWSManagedRulesKnownBadInputsRuleSet | Count | Block | NW-5 |
| 3 | AWSManagedRulesAmazonIpReputationList | Count | Block | NW-5 |
| 4 | AWSManagedRulesLinuxRuleSet | Count | Block | NW-5 |
| 5 | RateLimitRule (IP単位 1,000req/5min、QA-108) | Count | Block | DDoS |
| 6 | GeoMatchRule (対象国は QA-108 で確定) | Count | Block | — |

**WAF ログ設定**:

| パラメーター | 値 | 備考 |
|------------|-----|------|
| log_destination_type | `kinesis_data_firehose` | |
| firehose → S3 bucket | `helloworld-waf-logs-tenant-A` | CMK 暗号化 |

### 8.2 Web ACL（ALB 用、scope=REGIONAL、リージョン: ap-northeast-1）

> CloudFront WAF と同一ルールセットを REGIONAL scope で定義。ALB への直アクセスをバイパス防止のため二段適用。（SEC-001 §6.1 実装前提「CloudFront + ALB の二段」）

---

## 9. ACM 証明書

| 証明書 | リージョン | ドメイン | 用途 |
|-------|----------|--------|------|
| CloudFront 用 | us-east-1 | `*.helloworld-tenant-A.example.go.jp` | CloudFront Distribution |
| ALB 用 | ap-northeast-1 | `*.tenant-a.internal.helloworld.go.jp` | 公開 ALB / 内部 ALB |
| 検証方式 | DNS 検証 | Route53 レコード自動追加 | |

---

## 10. IAM ロール（オンライン共通）

根拠: SEC-001 §4.5

### ecsTaskExecutionRole

| 項目 | 値 |
|-----|-----|
| ロール名 | `ecsTaskExecutionRole` |
| Trusted Entity | `ecs-tasks.amazonaws.com` |
| 管理ポリシー | `AmazonECSTaskExecutionRolePolicy` |
| インラインポリシー追加 | kms:Decrypt（ECR/Logs CMK）、kms:DescribeKey |
| Permission Boundary | `PB-ServiceRole` |

### ecsTaskRole-online

| 項目 | 値 |
|-----|-----|
| ロール名 | `ecsTaskRole-online` |
| Trusted Entity | `ecs-tasks.amazonaws.com` |
| 許可 Action | s3:GetObject, s3:PutObject（テナント S3 のみ）; kms:Decrypt, kms:GenerateDataKey; sqs:SendMessage（パターン C SQS への起動用）; logs:CreateLogStream, logs:PutLogEvents |
| リソース範囲 | `arn:aws:s3:::helloworld-tenant-A-*/*`、テナント別 SQS ARN |
| テナント条件 | `aws:ResourceTag/tenant = A` |
| Permission Boundary | `PB-ServiceRole` |

---

## 11. 構築リソース種別数サマリ（オンライン共通部）

| リソース種別 | 数量（1テナント） | 見積按分備考 |
|------------|---------------|-----------|
| ECR リポジトリ | 1 | 共有 Tooling（Shared Tooling Account 側） |
| ECS Cluster | 1 | テナント毎 |
| ECS タスク定義 | 2（公開・非公開） | テナント毎 |
| ECS サービス | 2（公開・非公開） | テナント毎 |
| Application Auto Scaling | 2（公開・非公開） | |
| ALB（公開） | 1 | テナント毎 |
| ALB（内部） | 1 | テナント毎 |
| ALB リスナー | 3（公開 HTTP+HTTPS、内部 HTTPS） | |
| ターゲットグループ | 2 | |
| CloudFront Distribution | 1 | テナント毎 |
| WAF Web ACL | 2（CF 用 + ALB 用） | スコープ別 |
| ACM 証明書 | 2（us-east-1 / ap-northeast-1） | |
| IAM ロール（オンライン） | 2（ExecutionRole / TaskRole） | |
| CloudWatch Logs グループ | 2（public / private） | |

**合計: オンライン系リソース種別 約 14 種 / テナント**
