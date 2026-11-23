variable "aws_region" {
  description = "AWS region for SES. Sandbox and production access are per region; this account has production access here."
  type        = string
  default     = "ap-south-1"
}

variable "mail_domain" {
  description = "Sending subdomain, verified in SES (DKIM + custom MAIL FROM). Kept apart from the rest of dculus.com so its reputation is its own."
  type        = string
  default     = "mail.vesper.dculus.com"
}

variable "mail_from_local_part" {
  description = "Local part of the sender address (<local part>@<mail_domain>)."
  type        = string
  default     = "hello"
}

variable "zone_id" {
  description = "ID of the existing dculus.com Cloudflare zone. Records are added to it; the zone itself is never changed."
  type        = string
}

variable "gcp_state_bucket" {
  description = "State bucket of infra/seed. The gcp module's state is read for the Cloud Function's service account ID."
  type        = string
}

variable "web_identity_audience" {
  description = "Audience of the Google ID token the Cloud Function exchanges for AWS credentials. Must match infra/gcp (aws_web_identity_audience)."
  type        = string
  default     = "vesper-ses-sender"
}

variable "alert_email" {
  description = "Where the AWS budget alert goes. Empty disables the budget."
  type        = string
  default     = ""
}

variable "budget_usd" {
  description = "Monthly AWS spend (all services) that triggers the alert at 80% actual and 100% forecast."
  type        = number
  default     = 5
}
