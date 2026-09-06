
# ------------------------------------------------------------
# Account information
# ------------------------------------------------------------

data "aws_caller_identity" "current" {}

data "aws_region" "current" {}

# ------------------------------------------------------------
# Networking for the SageMaker Domain
# ------------------------------------------------------------

resource "aws_vpc" "sagemaker" {
  cidr_block           = "10.20.0.0/16"
  enable_dns_support   = true
  enable_dns_hostnames = true

  tags = {
    Name = "ai-inspector-sagemaker-vpc"
  }
}

resource "aws_subnet" "sagemaker" {
  vpc_id                  = aws_vpc.sagemaker.id
  cidr_block              = "10.20.1.0/24"
  map_public_ip_on_launch = true

  tags = {
    Name = "ai-inspector-sagemaker-subnet"
  }
}

resource "aws_internet_gateway" "sagemaker" {
  vpc_id = aws_vpc.sagemaker.id

  tags = {
    Name = "ai-inspector-sagemaker-igw"
  }
}

resource "aws_route_table" "sagemaker" {
  vpc_id = aws_vpc.sagemaker.id

  route {
    cidr_block = "0.0.0.0/0"
    gateway_id = aws_internet_gateway.sagemaker.id
  }

  tags = {
    Name = "ai-inspector-sagemaker-routes"
  }
}

resource "aws_route_table_association" "sagemaker" {
  subnet_id      = aws_subnet.sagemaker.id
  route_table_id = aws_route_table.sagemaker.id
}

# ------------------------------------------------------------
# S3 bucket for Canvas datasets and artifacts
#
# The "sagemaker-" prefix is intentional. The AWS-managed
# SageMaker policy commonly grants S3 access to SageMaker-named
# buckets.
# ------------------------------------------------------------

resource "aws_s3_bucket" "canvas" {
  bucket = "sagemaker-canvas-${data.aws_caller_identity.current.account_id}-${var.aws_region}"
}

resource "aws_s3_bucket_public_access_block" "canvas" {
  bucket = aws_s3_bucket.canvas.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_s3_bucket_versioning" "canvas" {
  bucket = aws_s3_bucket.canvas.id

  versioning_configuration {
    status = "Enabled"
  }
}

resource "aws_s3_bucket_server_side_encryption_configuration" "canvas" {
  bucket = aws_s3_bucket.canvas.id

  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
  }
}

# Optional folders to keep your image dataset organized.
resource "aws_s3_object" "training_ok_folder" {
  bucket  = aws_s3_bucket.canvas.id
  key     = "datasets/boxes/ok/"
  content = ""
}

resource "aws_s3_object" "training_damaged_folder" {
  bucket  = aws_s3_bucket.canvas.id
  key     = "datasets/boxes/damaged/"
  content = ""
}

# ------------------------------------------------------------
# IAM role assumed by SageMaker / Canvas
# ------------------------------------------------------------

data "aws_iam_policy_document" "sagemaker_assume_role" {
  statement {
    effect = "Allow"

    actions = [
      "sts:AssumeRole"
    ]

    principals {
      type = "Service"
      identifiers = [
        "sagemaker.amazonaws.com"
      ]
    }
  }
}

resource "aws_iam_role" "sagemaker_execution" {
  name               = "ai-inspector-sagemaker-execution-role"
  assume_role_policy = data.aws_iam_policy_document.sagemaker_assume_role.json
}

# Simple setup for a class/project environment.
# For production, replace this broad managed policy with least-privilege policies.
resource "aws_iam_role_policy_attachment" "sagemaker_full_access" {
  role       = aws_iam_role.sagemaker_execution.name
  policy_arn = "arn:aws:iam::aws:policy/AmazonSageMakerFullAccess"
}

# Explicit permission to the project's Canvas S3 bucket.
data "aws_iam_policy_document" "canvas_s3" {
  statement {
    sid    = "ListCanvasBucket"
    effect = "Allow"

    actions = [
      "s3:ListBucket",
      "s3:GetBucketLocation"
    ]

    resources = [
      aws_s3_bucket.canvas.arn
    ]
  }

  statement {
    sid    = "UseCanvasObjects"
    effect = "Allow"

    actions = [
      "s3:GetObject",
      "s3:PutObject",
      "s3:DeleteObject"
    ]

    resources = [
      "${aws_s3_bucket.canvas.arn}/*"
    ]
  }
}

resource "aws_iam_role_policy" "canvas_s3" {
  name   = "ai-inspector-canvas-s3-access"
  role   = aws_iam_role.sagemaker_execution.id
  policy = data.aws_iam_policy_document.canvas_s3.json
}

# ------------------------------------------------------------
# SageMaker AI Domain
# ------------------------------------------------------------

resource "aws_sagemaker_domain" "canvas" {
  domain_name = var.domain_name
  auth_mode   = "IAM"

  vpc_id     = aws_vpc.sagemaker.id
  subnet_ids = [aws_subnet.sagemaker.id]

  # PublicInternetOnly is the simpler configuration for a class/demo.
  # A production environment would commonly use VpcOnly plus endpoints/NAT.
  app_network_access_type = "PublicInternetOnly"

  default_user_settings {
    execution_role = aws_iam_role.sagemaker_execution.arn

    # Enables access to the Studio web portal.
    studio_web_portal = "ENABLED"

    canvas_app_settings {
      # Allows models created in Canvas to be deployed directly
      # when the execution role has the needed SageMaker permissions.
      direct_deploy_settings {
        status = "ENABLED"
      }
    }
  }

  depends_on = [
    aws_iam_role_policy_attachment.sagemaker_full_access,
    aws_iam_role_policy.canvas_s3
  ]
}

# ------------------------------------------------------------
# SageMaker user profile
# ------------------------------------------------------------

resource "aws_sagemaker_user_profile" "canvas" {
  domain_id         = aws_sagemaker_domain.canvas.id
  user_profile_name = var.user_profile_name

  user_settings {
    execution_role = aws_iam_role.sagemaker_execution.arn
  }
}

# ------------------------------------------------------------
# SageMaker Canvas application
# ------------------------------------------------------------

resource "aws_sagemaker_app" "canvas" {
  domain_id         = aws_sagemaker_domain.canvas.id
  user_profile_name = aws_sagemaker_user_profile.canvas.user_profile_name

  app_name = "default"
  app_type = "Canvas"
}