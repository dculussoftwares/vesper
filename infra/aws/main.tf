# Amazon SES for transactional email (the welcome email, sent by the Cloud Function sendWelcomeEmail), and the
# Cloudflare DNS records it needs. Sender: <mail_from_local_part>@<mail_domain>.
#
# Authentication: DKIM (3 CNAMEs, signed by SES), a custom MAIL FROM domain (SPF-aligned bounce domain: MX + SPF), and
# DMARC. The dculus.com zone itself is not managed here; this module only adds records under mail.vesper.dculus.com.

locals {
  mail_from_domain = "bounce.${var.mail_domain}"
  sender_address   = "${var.mail_from_local_part}@${var.mail_domain}"
}

resource "aws_sesv2_configuration_set" "main" {
  configuration_set_name = "vesper"

  delivery_options {
    tls_policy = "REQUIRE"
  }

  reputation_options {
    reputation_metrics_enabled = true
  }

  sending_options {
    sending_enabled = true
  }

  suppression_options {
    suppressed_reasons = ["BOUNCE", "COMPLAINT"]
  }
}

resource "aws_sesv2_email_identity" "mail" {
  email_identity         = var.mail_domain
  configuration_set_name = aws_sesv2_configuration_set.main.configuration_set_name

  dkim_signing_attributes {
    next_signing_key_length = "RSA_2048_BIT"
  }
}

resource "aws_sesv2_email_identity_mail_from_attributes" "mail" {
  email_identity         = aws_sesv2_email_identity.mail.email_identity
  mail_from_domain       = local.mail_from_domain
  behavior_on_mx_failure = "USE_DEFAULT_VALUE"
}

# ---------- DNS (Cloudflare) ----------

resource "cloudflare_dns_record" "dkim" {
  count = 3

  zone_id = var.zone_id
  name    = "${aws_sesv2_email_identity.mail.dkim_signing_attributes[0].tokens[count.index]}._domainkey.${var.mail_domain}"
  type    = "CNAME"
  content = "${aws_sesv2_email_identity.mail.dkim_signing_attributes[0].tokens[count.index]}.dkim.amazonses.com"
  ttl     = 1
  proxied = false
  comment = "Amazon SES DKIM (terraform infra/aws)"

  lifecycle {
    prevent_destroy = true
  }
}

resource "cloudflare_dns_record" "mail_from_mx" {
  zone_id  = var.zone_id
  name     = local.mail_from_domain
  type     = "MX"
  content  = "feedback-smtp.${var.aws_region}.amazonses.com"
  priority = 10
  ttl      = 1
  comment  = "Amazon SES custom MAIL FROM (terraform infra/aws)"

  lifecycle {
    prevent_destroy = true
  }
}

resource "cloudflare_dns_record" "mail_from_spf" {
  zone_id = var.zone_id
  name    = local.mail_from_domain
  type    = "TXT"
  content = "\"v=spf1 include:amazonses.com ~all\""
  ttl     = 1
  comment = "SPF for the SES MAIL FROM domain (terraform infra/aws)"

  lifecycle {
    prevent_destroy = true
  }
}

resource "cloudflare_dns_record" "dmarc" {
  zone_id = var.zone_id
  name    = "_dmarc.${var.mail_domain}"
  type    = "TXT"
  content = "\"v=DMARC1; p=quarantine\""
  ttl     = 1
  comment = "DMARC for the sending subdomain (terraform infra/aws)"

  lifecycle {
    prevent_destroy = true
  }
}
