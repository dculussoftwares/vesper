# Public configuration of the prod project. Secrets (billing account, OAuth client secret, App Check debug tokens)
# come from GitHub secrets as TF_VAR_* in .github/workflows/infra.yml.

project_id = "vesper-prod-31275"

# Signing-certificate fingerprints per app (public values, not secrets). Google sign-in only works for a build whose
# signing certificate is registered here, so every key that can sign an installed build must be listed:
#   1. the debug key (local and CI debug builds),
#   2. the Play upload key (what CI signs the release AAB with; sideloaded/GitHub-release builds),
#   3. every Play App Signing key, including "Previous app signing keys" (Play Console > Test and release > App integrity > App signing; what Play installs).
sha1_fingerprints = {
  app = [
    "69:38:3E:14:D2:26:49:38:FB:B2:74:BE:31:64:2F:42:E6:33:B7:A7", # debug
    "13:E4:C4:54:46:3D:FE:E0:37:E1:18:ED:5A:27:88:E0:FF:C1:07:71", # Play upload key
    "11:0B:74:17:80:DC:20:A4:8A:45:F7:22:8B:F6:C3:F6:9F:06:6E:46", # Play App Signing (classic)
    "A1:60:48:88:B5:B8:17:EC:3C:7D:84:90:5A:59:EE:C1:96:A2:26:26", # Play App Signing (post-quantum)
    "AE:C4:3A:B8:45:1E:1A:C0:7A:52:0D:1D:EE:E0:66:A3:FF:30:3E:35", # Play App Signing (previous key, first used 2026-11-05; SHA-256 is the E1:BD:... below)
  ]
  kids = [
    "69:38:3E:14:D2:26:49:38:FB:B2:74:BE:31:64:2F:42:E6:33:B7:A7", # debug
    "13:E4:C4:54:46:3D:FE:E0:37:E1:18:ED:5A:27:88:E0:FF:C1:07:71", # upload key (the Kids release is signed with it too)
    "22:46:36:5B:44:CF:EC:FF:A3:30:96:0A:B4:51:2D:63:9F:17:6C:5E", # Play App Signing (classic)
    "D8:C4:3C:7D:E4:6E:C3:6F:63:45:71:FE:1C:51:93:95:45:0A:CB:EC", # Play App Signing (post-quantum)
    "53:64:FB:FA:A8:68:45:25:EA:57:21:99:2D:BB:F9:BD:90:0C:79:10", # Play App Signing (previous key, first used 2026-11-26)
  ]
}
sha256_fingerprints = {
  app = [
    "0D:1D:88:64:D6:26:6C:14:AD:D4:7E:64:6D:C4:98:80:3B:17:68:3E:F5:9F:A4:D3:9F:26:E1:1D:92:71:1E:9D", # debug
    "CF:3F:B7:CD:B3:EE:51:DD:31:B5:74:4C:21:0D:40:C8:4A:D8:76:1A:18:BA:07:AD:CB:9B:A8:93:9A:E3:64:BE", # Play upload key
    "C2:C2:2B:D3:7D:CB:31:54:A8:4C:66:FA:85:3A:4A:53:92:8F:3F:95:86:46:16:9F:65:5D:C1:EA:B7:CB:40:B1", # Play App Signing (classic)
    "6A:86:99:78:DA:74:79:EE:4C:F0:34:35:FC:A6:7A:46:15:49:87:CA:07:B4:BF:D8:86:E4:77:8D:F0:3F:F5:08", # Play App Signing (post-quantum)
    "E1:BD:90:84:BF:C8:FE:A6:38:BF:6E:B6:38:07:3E:7B:83:84:D3:D8:A0:D3:3C:04:03:8F:2F:2E:0A:18:0B:7A", # listed in Play's Digital Asset Links snippet
  ]
  kids = [
    "0D:1D:88:64:D6:26:6C:14:AD:D4:7E:64:6D:C4:98:80:3B:17:68:3E:F5:9F:A4:D3:9F:26:E1:1D:92:71:1E:9D", # debug
    "CF:3F:B7:CD:B3:EE:51:DD:31:B5:74:4C:21:0D:40:C8:4A:D8:76:1A:18:BA:07:AD:CB:9B:A8:93:9A:E3:64:BE", # upload key
    "7B:6D:0E:36:C3:25:DB:4C:9F:E6:8D:78:31:44:1E:71:16:4D:17:FC:DD:73:B7:4D:75:FA:11:DB:1C:2A:86:32", # Play App Signing (classic)
    "0D:35:5D:8C:14:BB:3D:CE:58:7A:73:57:77:37:E1:E1:1A:59:D7:7D:59:28:36:9D:BC:D0:F2:2E:00:63:F4:C0", # Play App Signing (post-quantum)
    "E8:7D:CE:16:F0:0F:13:C7:2E:31:42:F1:B2:48:F2:05:F6:91:54:5E:C2:99:96:67:32:8D:95:4D:64:8E:5C:F2", # listed in Play's Digital Asset Links snippet
  ]
}

# On: the debug key was regenerated on 2026-11-05, so its SHA-1 is not held by the deleted StayFocus project.
register_sha1_on_firebase_apps = true

# ENFORCED rejects requests without a valid App Check token; UNENFORCED only records metrics.
app_check_enforcement = "ENFORCED"

budget_amount        = 20
gemini_budget_amount = 5

# Gemini request caps, e.g. [{ metric = "generativelanguage.googleapis.com/generate_content_requests", unit = "/min/project", limit = 60 }].
gemini_quota_overrides = []

# Amazon SES (infra/aws) sends the welcome email; the function signs in to AWS through Google identity federation.
aws_account_id = "652693263457"
aws_region     = "ap-south-1"
