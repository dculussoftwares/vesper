#!/usr/bin/env bash
# Fails when Google sign-in cannot work in the build about to be released. Run after fetch-google-services.sh.
#   1. google-services.json has a web OAuth client (client_type 3): it becomes `default_web_client_id`, which the
#      app needs to ask for a Google ID token. Missing = the Google provider is not set up (docs/INFRASTRUCTURE.md).
#   2. If KEYSTORE_FILE/KEY_ALIAS/KEYSTORE_PASS are set: the upload key's SHA-1 has an Android OAuth client for the
#      file's package in google-services.json, i.e. its fingerprint is in infra/gcp/terraform.tfvars. Otherwise Google
#      sign-in fails with "no credentials available" in every build signed with that key.
# Usage: check-google-signin.sh [google-services.json ...]   (default: app/ and kids/)
# Only public values are read or printed (certificate fingerprints), never the keystore or its passwords.
set -euo pipefail
root="$(cd "$(dirname "$0")/../.." && pwd)"
if [ "$#" -eq 0 ]; then set -- "$root/app/google-services.json" "$root/kids/google-services.json"; fi
fail=0

sha1=""
if [ -n "${KEYSTORE_FILE:-}" ]; then
  sha1="$(keytool -list -v -keystore "$KEYSTORE_FILE" -alias "$KEY_ALIAS" -storepass:env KEYSTORE_PASS 2> /dev/null |
    awk -F': ' '/SHA1:/ {print $2; exit}' | tr -d ':' | tr 'A-F' 'a-f')"
  if [ -z "$sha1" ]; then
    echo "::error title=Google sign-in::Could not read the upload key fingerprint."
    exit 1
  fi
fi

for cfg in "$@"; do
  if ! jq -e '[.client[]?.oauth_client[]? | select(.client_type == 3)] | length > 0' "$cfg" > /dev/null; then
    echo "::error title=Google sign-in::$cfg has no web OAuth client. Set GOOGLE_OAUTH_WEB_CLIENT_ID/SECRET and re-run infra (docs/INFRASTRUCTURE.md)."
    fail=1
  fi
  [ -n "$sha1" ] || continue
  # The Android OAuth client is keyed by package name AND certificate, so match both.
  pkg="$(jq -r '.client[0].client_info.android_client_info.package_name' "$cfg")"
  if jq -e --arg h "$sha1" --arg p "$pkg" '[.client[]?.oauth_client[]? | select(.client_type == 1 and .android_info.certificate_hash == $h and .android_info.package_name == $p)] | length > 0' "$cfg" > /dev/null; then
    echo "$pkg: upload key SHA-1 $sha1 is registered."
  else
    echo "::error title=Google sign-in::The upload key (SHA-1 $sha1) is not registered for $pkg. Add it to sha1_fingerprints in infra/gcp/terraform.tfvars and merge, then re-run."
    fail=1
  fi
done
exit "$fail"
