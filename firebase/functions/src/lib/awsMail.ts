import { SESv2Client, SendEmailCommand } from "@aws-sdk/client-sesv2";
import { AssumeRoleWithWebIdentityCommand, STSClient } from "@aws-sdk/client-sts";
import type { WelcomeDeps, WelcomeMessage } from "./welcomeEmail";

/**
 * Sends mail through Amazon SES without any stored AWS key: the function's own Google identity (an ID token from the
 * metadata server) is exchanged for short-lived credentials of the AWS role `AWS_ROLE_ARN`, which trusts only this
 * function's service account (infra/aws). Configured by Terraform (infra/gcp/functions.tf).
 */
export interface AwsMailConfig {
  roleArn: string;
  region: string;
  /** Audience of the Google ID token; listed on the AWS identity provider. */
  audience: string;
  from: string;
  configurationSet: string;
}

export function readAwsMailConfig(env: NodeJS.ProcessEnv): AwsMailConfig {
  const need = (name: string): string => {
    const value = env[name];
    if (value === undefined || value === "") throw new Error(`missing configuration ${name}`);
    return value;
  };
  return {
    roleArn: need("AWS_ROLE_ARN"),
    region: need("AWS_REGION_SES"),
    audience: need("AWS_WEB_IDENTITY_AUDIENCE"),
    from: need("MAIL_FROM"),
    configurationSet: need("SES_CONFIGURATION_SET"),
  };
}

const METADATA_IDENTITY_URL = "http://metadata.google.internal/computeMetadata/v1/instance/service-accounts/default/identity";

async function googleIdToken(audience: string): Promise<string> {
  const response = await fetch(`${METADATA_IDENTITY_URL}?audience=${encodeURIComponent(audience)}&format=full`, {
    headers: { "Metadata-Flavor": "Google" },
  });
  if (!response.ok) throw new Error(`metadata server answered ${response.status}`);
  return response.text();
}

interface Credentials {
  accessKeyId: string;
  secretAccessKey: string;
  sessionToken: string;
  expiresAt: number;
}

let cached: Credentials | undefined;

async function credentials(config: AwsMailConfig): Promise<Credentials> {
  // Reuse until five minutes before expiry.
  if (cached !== undefined && cached.expiresAt - Date.now() > 5 * 60_000) return cached;
  const sts = new STSClient({ region: config.region });
  const { Credentials: c } = await sts.send(
    new AssumeRoleWithWebIdentityCommand({
      RoleArn: config.roleArn,
      RoleSessionName: "vesper-welcome-email",
      WebIdentityToken: await googleIdToken(config.audience),
      DurationSeconds: 900,
    }),
  );
  if (!c?.AccessKeyId || !c.SecretAccessKey || !c.SessionToken || !c.Expiration) {
    throw new Error("AWS returned no credentials");
  }
  cached = {
    accessKeyId: c.AccessKeyId,
    secretAccessKey: c.SecretAccessKey,
    sessionToken: c.SessionToken,
    expiresAt: c.Expiration.getTime(),
  };
  return cached;
}

export function sesSender(env: NodeJS.ProcessEnv = process.env): Pick<WelcomeDeps, "send"> {
  return {
    async send(message: WelcomeMessage): Promise<void> {
      const config = readAwsMailConfig(env);
      const ses = new SESv2Client({ region: config.region, credentials: () => credentials(config) });
      await ses.send(
        new SendEmailCommand({
          FromEmailAddress: `Vesper <${config.from}>`,
          Destination: { ToAddresses: [message.to] },
          ConfigurationSetName: config.configurationSet,
          Content: {
            Simple: {
              Subject: { Data: message.subject, Charset: "UTF-8" },
              Body: {
                Text: { Data: message.text, Charset: "UTF-8" },
                Html: { Data: message.html, Charset: "UTF-8" },
              },
            },
          },
        }),
      );
    },
  };
}
