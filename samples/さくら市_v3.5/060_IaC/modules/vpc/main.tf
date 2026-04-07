# さくら市マイナンバー基盤 - vpc - main.tf
# 作成日: 2026-04-06
# 概要: VPC、サブネット（4層×2AZ）、IGW、NAT GW（各AZ）、VPC Endpoints、VPC Flow Logs、Route Tables

resource "aws_vpc" "main" {
  cidr_block           = var.vpc_cidr
  enable_dns_hostnames = true
  enable_dns_support   = true

  tags = merge(
    var.tags,
    {
      Name = "${var.environment}-sakura-vpc"
    }
  )
}

# ---------------------------------------------------------------------------
# Internet Gateway
# ---------------------------------------------------------------------------
resource "aws_internet_gateway" "main" {
  vpc_id = aws_vpc.main.id

  tags = merge(
    var.tags,
    {
      Name = "${var.environment}-sakura-igw"
    }
  )
}

# ---------------------------------------------------------------------------
# Subnets（4層 × 2AZ）
# 層: public / app / db / mgmt
# ---------------------------------------------------------------------------
resource "aws_subnet" "public" {
  for_each = {
    for idx, az in var.az_list :
    "public-${az}" => {
      az   = az
      cidr = var.subnet_cidrs.public[idx]
    }
  }

  vpc_id                  = aws_vpc.main.id
  cidr_block              = each.value.cidr
  availability_zone       = each.value.az
  map_public_ip_on_launch = false

  tags = merge(
    var.tags,
    {
      Name = "${var.environment}-sakura-subnet-${each.key}"
      Tier = "public"
    }
  )
}

resource "aws_subnet" "app" {
  for_each = {
    for idx, az in var.az_list :
    "app-${az}" => {
      az   = az
      cidr = var.subnet_cidrs.app[idx]
    }
  }

  vpc_id            = aws_vpc.main.id
  cidr_block        = each.value.cidr
  availability_zone = each.value.az

  tags = merge(
    var.tags,
    {
      Name = "${var.environment}-sakura-subnet-${each.key}"
      Tier = "app"
    }
  )
}

resource "aws_subnet" "db" {
  for_each = {
    for idx, az in var.az_list :
    "db-${az}" => {
      az   = az
      cidr = var.subnet_cidrs.db[idx]
    }
  }

  vpc_id            = aws_vpc.main.id
  cidr_block        = each.value.cidr
  availability_zone = each.value.az

  tags = merge(
    var.tags,
    {
      Name = "${var.environment}-sakura-subnet-${each.key}"
      Tier = "db"
    }
  )
}

resource "aws_subnet" "mgmt" {
  for_each = {
    for idx, az in var.az_list :
    "mgmt-${az}" => {
      az   = az
      cidr = var.subnet_cidrs.mgmt[idx]
    }
  }

  vpc_id            = aws_vpc.main.id
  cidr_block        = each.value.cidr
  availability_zone = each.value.az

  tags = merge(
    var.tags,
    {
      Name = "${var.environment}-sakura-subnet-${each.key}"
      Tier = "mgmt"
    }
  )
}

# ---------------------------------------------------------------------------
# Elastic IP for NAT Gateways
# ---------------------------------------------------------------------------
resource "aws_eip" "nat" {
  for_each = toset(var.az_list)

  domain = "vpc"

  tags = merge(
    var.tags,
    {
      Name = "${var.environment}-sakura-eip-nat-${each.key}"
    }
  )

  depends_on = [aws_internet_gateway.main]
}

# ---------------------------------------------------------------------------
# NAT Gateways（各AZに1つ）
# ---------------------------------------------------------------------------
resource "aws_nat_gateway" "main" {
  for_each = toset(var.az_list)

  allocation_id = aws_eip.nat[each.key].id
  subnet_id     = aws_subnet.public["public-${each.key}"].id

  tags = merge(
    var.tags,
    {
      Name = "${var.environment}-sakura-nat-${each.key}"
    }
  )

  depends_on = [aws_internet_gateway.main]
}

# ---------------------------------------------------------------------------
# Route Tables
# ---------------------------------------------------------------------------

# Public Route Table（共通）
resource "aws_route_table" "public" {
  vpc_id = aws_vpc.main.id

  route {
    cidr_block = "0.0.0.0/0"
    gateway_id = aws_internet_gateway.main.id
  }

  tags = merge(
    var.tags,
    {
      Name = "${var.environment}-sakura-rt-public"
    }
  )
}

resource "aws_route_table_association" "public" {
  for_each = aws_subnet.public

  subnet_id      = each.value.id
  route_table_id = aws_route_table.public.id
}

# App Route Tables（AZごと、NAT GW経由）
resource "aws_route_table" "app" {
  for_each = toset(var.az_list)

  vpc_id = aws_vpc.main.id

  route {
    cidr_block     = "0.0.0.0/0"
    nat_gateway_id = aws_nat_gateway.main[each.key].id
  }

  tags = merge(
    var.tags,
    {
      Name = "${var.environment}-sakura-rt-app-${each.key}"
    }
  )
}

resource "aws_route_table_association" "app" {
  for_each = {
    for idx, az in var.az_list :
    "app-${az}" => az
  }

  subnet_id      = aws_subnet.app["app-${each.value}"].id
  route_table_id = aws_route_table.app[each.value].id
}

# DB Route Tables（AZごと、NAT GW経由）
resource "aws_route_table" "db" {
  for_each = toset(var.az_list)

  vpc_id = aws_vpc.main.id

  route {
    cidr_block     = "0.0.0.0/0"
    nat_gateway_id = aws_nat_gateway.main[each.key].id
  }

  tags = merge(
    var.tags,
    {
      Name = "${var.environment}-sakura-rt-db-${each.key}"
    }
  )
}

resource "aws_route_table_association" "db" {
  for_each = {
    for idx, az in var.az_list :
    "db-${az}" => az
  }

  subnet_id      = aws_subnet.db["db-${each.value}"].id
  route_table_id = aws_route_table.db[each.value].id
}

# Mgmt Route Tables（AZごと、NAT GW経由）
resource "aws_route_table" "mgmt" {
  for_each = toset(var.az_list)

  vpc_id = aws_vpc.main.id

  route {
    cidr_block     = "0.0.0.0/0"
    nat_gateway_id = aws_nat_gateway.main[each.key].id
  }

  tags = merge(
    var.tags,
    {
      Name = "${var.environment}-sakura-rt-mgmt-${each.key}"
    }
  )
}

resource "aws_route_table_association" "mgmt" {
  for_each = {
    for idx, az in var.az_list :
    "mgmt-${az}" => az
  }

  subnet_id      = aws_subnet.mgmt["mgmt-${each.value}"].id
  route_table_id = aws_route_table.mgmt[each.value].id
}

# ---------------------------------------------------------------------------
# VPC Endpoints
# ---------------------------------------------------------------------------

# S3 Gateway Endpoint
resource "aws_vpc_endpoint" "s3" {
  vpc_id            = aws_vpc.main.id
  service_name      = "com.amazonaws.${data.aws_region.current.name}.s3"
  vpc_endpoint_type = "Gateway"

  route_table_ids = concat(
    [for rt in aws_route_table.app : rt.id],
    [for rt in aws_route_table.db : rt.id],
    [for rt in aws_route_table.mgmt : rt.id]
  )

  tags = merge(
    var.tags,
    {
      Name = "${var.environment}-sakura-vpce-s3"
    }
  )
}

# ECR API Interface Endpoint
resource "aws_vpc_endpoint" "ecr_api" {
  vpc_id              = aws_vpc.main.id
  service_name        = "com.amazonaws.${data.aws_region.current.name}.ecr.api"
  vpc_endpoint_type   = "Interface"
  private_dns_enabled = true
  subnet_ids          = [for s in aws_subnet.app : s.id]
  security_group_ids  = [aws_security_group.vpce.id]

  tags = merge(
    var.tags,
    {
      Name = "${var.environment}-sakura-vpce-ecr-api"
    }
  )
}

# ECR DKR Interface Endpoint
resource "aws_vpc_endpoint" "ecr_dkr" {
  vpc_id              = aws_vpc.main.id
  service_name        = "com.amazonaws.${data.aws_region.current.name}.ecr.dkr"
  vpc_endpoint_type   = "Interface"
  private_dns_enabled = true
  subnet_ids          = [for s in aws_subnet.app : s.id]
  security_group_ids  = [aws_security_group.vpce.id]

  tags = merge(
    var.tags,
    {
      Name = "${var.environment}-sakura-vpce-ecr-dkr"
    }
  )
}

# SSM Interface Endpoint
resource "aws_vpc_endpoint" "ssm" {
  vpc_id              = aws_vpc.main.id
  service_name        = "com.amazonaws.${data.aws_region.current.name}.ssm"
  vpc_endpoint_type   = "Interface"
  private_dns_enabled = true
  subnet_ids          = [for s in aws_subnet.mgmt : s.id]
  security_group_ids  = [aws_security_group.vpce.id]

  tags = merge(
    var.tags,
    {
      Name = "${var.environment}-sakura-vpce-ssm"
    }
  )
}

resource "aws_vpc_endpoint" "ssmmessages" {
  vpc_id              = aws_vpc.main.id
  service_name        = "com.amazonaws.${data.aws_region.current.name}.ssmmessages"
  vpc_endpoint_type   = "Interface"
  private_dns_enabled = true
  subnet_ids          = [for s in aws_subnet.mgmt : s.id]
  security_group_ids  = [aws_security_group.vpce.id]

  tags = merge(
    var.tags,
    {
      Name = "${var.environment}-sakura-vpce-ssmmessages"
    }
  )
}

resource "aws_vpc_endpoint" "ec2messages" {
  vpc_id              = aws_vpc.main.id
  service_name        = "com.amazonaws.${data.aws_region.current.name}.ec2messages"
  vpc_endpoint_type   = "Interface"
  private_dns_enabled = true
  subnet_ids          = [for s in aws_subnet.mgmt : s.id]
  security_group_ids  = [aws_security_group.vpce.id]

  tags = merge(
    var.tags,
    {
      Name = "${var.environment}-sakura-vpce-ec2messages"
    }
  )
}

# Secrets Manager Interface Endpoint
resource "aws_vpc_endpoint" "secrets_manager" {
  vpc_id              = aws_vpc.main.id
  service_name        = "com.amazonaws.${data.aws_region.current.name}.secretsmanager"
  vpc_endpoint_type   = "Interface"
  private_dns_enabled = true
  subnet_ids          = [for s in aws_subnet.app : s.id]
  security_group_ids  = [aws_security_group.vpce.id]

  tags = merge(
    var.tags,
    {
      Name = "${var.environment}-sakura-vpce-secretsmanager"
    }
  )
}

# VPC Endpoint 用 Security Group
resource "aws_security_group" "vpce" {
  name        = "${var.environment}-sakura-sg-vpce"
  description = "Security group for VPC Interface Endpoints"
  vpc_id      = aws_vpc.main.id

  ingress {
    description = "HTTPS from VPC"
    from_port   = 443
    to_port     = 443
    protocol    = "tcp"
    cidr_blocks = [var.vpc_cidr]
  }

  egress {
    description = "Allow all outbound"
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = merge(
    var.tags,
    {
      Name = "${var.environment}-sakura-sg-vpce"
    }
  )
}

# ---------------------------------------------------------------------------
# VPC Flow Logs
# ---------------------------------------------------------------------------
resource "aws_cloudwatch_log_group" "vpc_flow_logs" {
  name              = "/aws/vpc/${var.environment}-sakura/flow-logs"
  retention_in_days = var.flow_logs_retention_days

  tags = merge(
    var.tags,
    {
      Name = "${var.environment}-sakura-vpc-flow-logs"
    }
  )
}

resource "aws_iam_role" "vpc_flow_logs" {
  name = "${var.environment}-sakura-role-vpc-flow-logs"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "vpc-flow-logs.amazonaws.com"
        }
      }
    ]
  })

  tags = merge(
    var.tags,
    {
      Name = "${var.environment}-sakura-role-vpc-flow-logs"
    }
  )
}

resource "aws_iam_role_policy" "vpc_flow_logs" {
  name = "${var.environment}-sakura-policy-vpc-flow-logs"
  role = aws_iam_role.vpc_flow_logs.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "logs:CreateLogGroup",
          "logs:CreateLogStream",
          "logs:PutLogEvents",
          "logs:DescribeLogGroups",
          "logs:DescribeLogStreams"
        ]
        Resource = "*"
      }
    ]
  })
}

resource "aws_flow_log" "main" {
  iam_role_arn    = aws_iam_role.vpc_flow_logs.arn
  log_destination = aws_cloudwatch_log_group.vpc_flow_logs.arn
  traffic_type    = "ALL"
  vpc_id          = aws_vpc.main.id

  tags = merge(
    var.tags,
    {
      Name = "${var.environment}-sakura-flow-log"
    }
  )
}

# ---------------------------------------------------------------------------
# Data Sources
# ---------------------------------------------------------------------------
data "aws_region" "current" {}
