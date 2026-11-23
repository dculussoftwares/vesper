# The Cloud Function sendWelcomeEmail signs in to AWS without a stored key: it presents a Google ID token for its own
# service account and assumes this role (AssumeRoleWithWebIdentity). Only that service account can; the role may only
# send from the sender address through this domain's identity.

data "terraform_remote_state" "gcp" {
  backend = "gcs"
  config = {
    bucket = var.gcp_state_bucket
    prefix = "gcp"
  }
}

locals {
  # Numeric unique ID of the function's service account (output of infra/gcp). apply-aws runs after apply-gcp; the
  # placeholder only lets a PR plan run before the first gcp apply and can never match a real token.
  function_sa_unique_id = try(data.terraform_remote_state.gcp.outputs.welcome_email_service_account_unique_id, "pending-gcp-apply")
}

resource "aws_iam_openid_connect_provider" "google" {
  url            = "https://accounts.google.com"
  client_id_list = [var.web_identity_audience]
}

resource "aws_iam_role" "welcome_sender" {
  name                 = "vesper-welcome-email-sender"
  description          = "Assumed by the sendWelcomeEmail Cloud Function (Google identity) to send mail through SES"
  max_session_duration = 3600

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect    = "Allow"
      Principal = { Federated = aws_iam_openid_connect_provider.google.arn }
      Action    = "sts:AssumeRoleWithWebIdentity"
      Condition = {
        StringEquals = {
          "accounts.google.com:sub" = local.function_sa_unique_id
        }
      }
    }]
  })
}

resource "aws_iam_role_policy" "welcome_sender" {
  name = "send-welcome-email"
  role = aws_iam_role.welcome_sender.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect = "Allow"
      Action = ["ses:SendEmail"]
      Resource = [
        aws_sesv2_email_identity.mail.arn,
        aws_sesv2_configuration_set.main.arn,
      ]
      Condition = {
        StringEquals = { "ses:FromAddress" = local.sender_address }
      }
    }]
  })
}
