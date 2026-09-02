# ------------------------------------------------------------
# Outputs
# ------------------------------------------------------------

output "canvas_bucket_name" {
  description = "S3 bucket for training images and Canvas artifacts"
  value       = aws_s3_bucket.canvas.bucket
}

output "training_ok_s3_uri" {
  value = "s3://${aws_s3_bucket.canvas.bucket}/datasets/boxes/ok/"
}

output "training_damaged_s3_uri" {
  value = "s3://${aws_s3_bucket.canvas.bucket}/datasets/boxes/damaged/"
}

output "sagemaker_domain_id" {
  value = aws_sagemaker_domain.canvas.id
}

output "sagemaker_user_profile" {
  value = aws_sagemaker_user_profile.canvas.user_profile_name
}

output "sagemaker_execution_role_arn" {
  value = aws_iam_role.sagemaker_execution.arn
}