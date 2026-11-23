output "sender_address" {
  description = "From address the SES identity allows."
  value       = local.sender_address
}

output "welcome_sender_role_arn" {
  description = "AWS role the sendWelcomeEmail function assumes."
  value       = aws_iam_role.welcome_sender.arn
}

output "ses_configuration_set" {
  description = "SES configuration set the function sends with."
  value       = aws_sesv2_configuration_set.main.configuration_set_name
}
