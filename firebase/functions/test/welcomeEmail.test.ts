import { readAwsMailConfig } from "../src/lib/awsMail";
import { buildWelcomeEmail, handleProfileCreated, type WelcomeDeps, type WelcomeMessage } from "../src/lib/welcomeEmail";

function fakeDeps(fail = false) {
  const sent: WelcomeMessage[] = [];
  const deps: WelcomeDeps = {
    send: (message) => {
      if (fail) return Promise.reject(new Error("ses down"));
      sent.push(message);
      return Promise.resolve();
    },
  };
  return { deps, sent };
}

describe("handleProfileCreated", () => {
  it("sends one welcome email to the profile's address", async () => {
    const { deps, sent } = fakeDeps();
    const result = await handleProfileCreated(deps, { email: "  ada@example.com ", displayName: "Ada" });
    expect(result).toBe(true);
    expect(sent).toHaveLength(1);
    expect(sent[0]?.to).toBe("ada@example.com");
    expect(sent[0]?.subject).toBe("Welcome to Vesper");
    expect(sent[0]?.text).toContain("Hi Ada,");
  });

  it.each([undefined, {}, { email: "" }, { email: "not-an-email" }, { email: 42 }])("skips %j", async (data) => {
    const { deps, sent } = fakeDeps();
    expect(await handleProfileCreated(deps, data as never)).toBe(false);
    expect(sent).toHaveLength(0);
  });

  it("rethrows a provider failure so the invocation fails", async () => {
    const { deps } = fakeDeps(true);
    await expect(handleProfileCreated(deps, { email: "ada@example.com" })).rejects.toThrow("ses down");
  });
});

describe("buildWelcomeEmail", () => {
  it("greets by name and falls back to 'there'", () => {
    expect(buildWelcomeEmail("a@b.co", "Ada").text).toContain("Hi Ada,");
    expect(buildWelcomeEmail("a@b.co", undefined).text).toContain("Hi there,");
    expect(buildWelcomeEmail("a@b.co", "").text).toContain("Hi there,");
  });

  it("escapes the name in the HTML body", () => {
    const { html } = buildWelcomeEmail("a@b.co", `<script>alert("x")</script>`);
    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;script&gt;");
  });
});

describe("readAwsMailConfig", () => {
  const env = {
    AWS_ROLE_ARN: "arn:aws:iam::1:role/r",
    AWS_REGION_SES: "ap-south-1",
    AWS_WEB_IDENTITY_AUDIENCE: "aud",
    MAIL_FROM: "hello@mail.example.com",
    SES_CONFIGURATION_SET: "cs",
  };

  it("reads the five settings", () => {
    expect(readAwsMailConfig(env).from).toBe("hello@mail.example.com");
  });

  it("names the missing setting", () => {
    expect(() => readAwsMailConfig({ ...env, MAIL_FROM: "" })).toThrow("MAIL_FROM");
  });
});
