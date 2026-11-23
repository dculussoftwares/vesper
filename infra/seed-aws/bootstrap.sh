#!/usr/bin/env bash
# One-time AWS bootstrap: keyless GitHub Actions login for infra/aws (docs/INFRASTRUCTURE.md).
#
# Creates, idempotently, in the AWS account the CLI is logged in to:
#   - the GitHub OIDC identity provider,
#   - vesper-tf-deploy: assumed only by jobs of this repository in the GitHub environment `prod` (merge to main),
#   - vesper-tf-plan:   read-only, assumed by any job of this repository (fork PRs get no OIDC token).
# Everything else in AWS is Terraform (infra/aws). Nothing here is secret. Run with an admin identity, then delete any
# long-lived access key you used:   infra/seed-aws/bootstrap.sh
set -euo pipefail

GITHUB_SUBJECT_PREFIX="${GITHUB_SUBJECT_PREFIX:-repo:dculussoftwares@98706461/vesper@1406642781}"
# Check yours: gh api repos/OWNER/NAME/actions/oidc/customization/sub --jq .sub_claim_prefix
DEPLOY_ENVIRONMENT="${DEPLOY_ENVIRONMENT:-prod}"
PROVIDER_HOST="token.actions.githubusercontent.com"

ACCOUNT_ID="$(aws sts get-caller-identity --query Account --output text)"
PROVIDER_ARN="arn:aws:iam::${ACCOUNT_ID}:oidc-provider/${PROVIDER_HOST}"
WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT

echo "Account ${ACCOUNT_ID}, subject prefix ${GITHUB_SUBJECT_PREFIX}"

if aws iam get-open-id-connect-provider --open-id-connect-provider-arn "$PROVIDER_ARN" >/dev/null 2>&1; then
  echo "OIDC provider exists"
else
  aws iam create-open-id-connect-provider --url "https://${PROVIDER_HOST}" --client-id-list sts.amazonaws.com >/dev/null
  echo "OIDC provider created"
fi

trust() { # $1 = exact|pattern, $2 = subject
  local sub_condition
  if [ "$1" = exact ]; then
    sub_condition="\"StringEquals\":{\"${PROVIDER_HOST}:aud\":\"sts.amazonaws.com\",\"${PROVIDER_HOST}:sub\":\"$2\"}"
  else
    sub_condition="\"StringEquals\":{\"${PROVIDER_HOST}:aud\":\"sts.amazonaws.com\"},\"StringLike\":{\"${PROVIDER_HOST}:sub\":\"$2\"}"
  fi
  cat <<JSON
{"Version":"2012-10-17","Statement":[{"Effect":"Allow","Principal":{"Federated":"${PROVIDER_ARN}"},"Action":"sts:AssumeRoleWithWebIdentity",
"Condition":{${sub_condition}}}]}
JSON
}

ensure_role() { # $1 = name, $2 = trust file, $3 = description
  if aws iam get-role --role-name "$1" >/dev/null 2>&1; then
    aws iam update-assume-role-policy --role-name "$1" --policy-document "file://$2"
    echo "role $1 updated"
  else
    aws iam create-role --role-name "$1" --description "$3" --max-session-duration 3600 \
      --assume-role-policy-document "file://$2" >/dev/null
    echo "role $1 created"
  fi
}

# Deploy: only the `prod` environment of this repository.
trust exact "${GITHUB_SUBJECT_PREFIX}:environment:${DEPLOY_ENVIRONMENT}" >"$WORK/trust-deploy.json"
ensure_role vesper-tf-deploy "$WORK/trust-deploy.json" "Terraform apply for infra/aws (GitHub environment ${DEPLOY_ENVIRONMENT})"

# Plan: any job of this repository.
trust pattern "${GITHUB_SUBJECT_PREFIX}:*" >"$WORK/trust-plan.json"
ensure_role vesper-tf-plan "$WORK/trust-plan.json" "Terraform plan for infra/aws (read-only)"
aws iam attach-role-policy --role-name vesper-tf-plan --policy-arn arn:aws:iam::aws:policy/ReadOnlyAccess

# Deploy permissions: SES and budgets, plus IAM only for resources named vesper-* and the Google OIDC provider
# (the Cloud Function signs in to AWS through it). No AdministratorAccess.
cat >"$WORK/deploy-policy.json" <<JSON
{"Version":"2012-10-17","Statement":[
 {"Sid":"Ses","Effect":"Allow","Action":["ses:*"],"Resource":"*"},
 {"Sid":"Budgets","Effect":"Allow","Action":["budgets:*"],"Resource":"*"},
 {"Sid":"IamRolesAndPolicies","Effect":"Allow","Action":[
   "iam:CreateRole","iam:DeleteRole","iam:GetRole","iam:UpdateRole","iam:UpdateAssumeRolePolicy","iam:TagRole","iam:UntagRole",
   "iam:PutRolePolicy","iam:GetRolePolicy","iam:DeleteRolePolicy","iam:ListRolePolicies","iam:ListAttachedRolePolicies",
   "iam:ListInstanceProfilesForRole","iam:CreatePolicy","iam:DeletePolicy","iam:GetPolicy","iam:GetPolicyVersion",
   "iam:CreatePolicyVersion","iam:DeletePolicyVersion","iam:ListPolicyVersions","iam:TagPolicy","iam:UntagPolicy"],
  "Resource":["arn:aws:iam::${ACCOUNT_ID}:role/vesper-*","arn:aws:iam::${ACCOUNT_ID}:policy/vesper-*"]},
 {"Sid":"IamGoogleOidc","Effect":"Allow","Action":[
   "iam:CreateOpenIDConnectProvider","iam:DeleteOpenIDConnectProvider","iam:GetOpenIDConnectProvider",
   "iam:UpdateOpenIDConnectProviderThumbprint","iam:AddClientIDToOpenIDConnectProvider","iam:RemoveClientIDFromOpenIDConnectProvider",
   "iam:TagOpenIDConnectProvider","iam:UntagOpenIDConnectProvider"],
  "Resource":"arn:aws:iam::${ACCOUNT_ID}:oidc-provider/accounts.google.com"},
 {"Sid":"IamRead","Effect":"Allow","Action":["iam:ListOpenIDConnectProviders","iam:ListRoles","iam:ListPolicies"],"Resource":"*"}
]}
JSON
aws iam put-role-policy --role-name vesper-tf-deploy --policy-name vesper-tf-deploy --policy-document "file://$WORK/deploy-policy.json"

cat <<EOF

Done. Public values for infra/prod.env (not secrets):
  AWS_ACCOUNT_ID=${ACCOUNT_ID}
  AWS_DEPLOY_ROLE_ARN=arn:aws:iam::${ACCOUNT_ID}:role/vesper-tf-deploy
  AWS_PLAN_ROLE_ARN=arn:aws:iam::${ACCOUNT_ID}:role/vesper-tf-plan
Now delete the long-lived access key you ran this with (IAM console, or: aws iam delete-access-key).
EOF
