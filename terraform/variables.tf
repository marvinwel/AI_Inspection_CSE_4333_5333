# ------------------------------------------------------------
# Variables
# ------------------------------------------------------------

variable "aws_region" {
  description = "AWS region for SageMaker Canvas"
  type        = string
  default     = "us-east-2"
}

variable "domain_name" {
  description = "SageMaker AI domain name"
  type        = string
  default     = "ai-inspector-domain"
}

variable "user_profile_name" {
  description = "SageMaker user profile name"
  type        = string
  default     = "ai-inspector-user"
}