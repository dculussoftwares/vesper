terraform {
  required_version = ">= 1.9"

  # State in the bucket created by infra/seed (terraform init -backend-config=bucket=$TF_STATE_BUCKET).
  backend "gcs" {
    prefix = "aws"
  }

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 6.0"
    }
    cloudflare = {
      source  = "cloudflare/cloudflare"
      version = "~> 5.28"
    }
  }
}

provider "aws" {
  region = var.aws_region
  # Credentials come from the environment: the workflow assumes vesper-tf-deploy / vesper-tf-plan through GitHub OIDC
  # (infra/seed-aws/bootstrap.sh), no stored keys.

  default_tags {
    tags = {
      project = "vesper"
      managed = "terraform"
    }
  }
}

provider "cloudflare" {
  # Token is read from the CLOUDFLARE_API_TOKEN environment variable (edit token on apply, read-only on plan).
}
