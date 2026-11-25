import { readAwsMailConfig } from "../src/lib/awsMail";
import {
    buildWelcomeEmail,
    handleProfileCreated,
    eventProfileUid,
    profileUid,
    type WelcomeDeps,
    type WelcomeMessage,
} from "../src/lib/welcomeEmail";

function fakeDeps(
    opts: { fail?: boolean; authEmail?: string | undefined } = {},
) {
    const fail = opts.fail ?? false;
    const authEmail = "authEmail" in opts ? opts.authEmail : "ada@example.com";
    const sent: WelcomeMessage[] = [];
    const deps: WelcomeDeps = {
        authEmail: () => Promise.resolve(authEmail),
        send: (message) => {
            if (fail) return Promise.reject(new Error("ses down"));
            sent.push(message);
            return Promise.resolve();
        },
    };
    return { deps, sent };
}

describe("handleProfileCreated", () => {
    it("sends one welcome email to the Auth account's address", async () => {
        const { deps, sent } = fakeDeps({ authEmail: "  ada@example.com " });
        const result = await handleProfileCreated(deps, "u1", {
            email: "ignored@example.com",
            displayName: "Ada",
        });
        expect(result).toBe(true);
        expect(sent).toHaveLength(1);
        expect(sent[0]?.to).toBe("ada@example.com");
        expect(sent[0]?.subject).toBe("Welcome to Vesper");
        expect(sent[0]?.text).toContain("Hi Ada,");
    });

    it("never sends to the profile's client-written email", async () => {
        const { deps, sent } = fakeDeps({ authEmail: "me@example.com" });
        await handleProfileCreated(deps, "u1", {
            email: "victim@example.com",
            displayName: "Me",
        });
        expect(sent.map((m) => m.to)).toEqual(["me@example.com"]);
    });

    it.each([undefined, "", "not-an-email"])(
        "skips an account whose Auth email is %j",
        async (authEmail) => {
            const { deps, sent } = fakeDeps({ authEmail });
            expect(
                await handleProfileCreated(deps, "u1", { email: "a@b.co" }),
            ).toBe(false);
            expect(sent).toHaveLength(0);
        },
    );

    it("greets generically when the profile has no usable name", async () => {
        const { deps, sent } = fakeDeps();
        await handleProfileCreated(deps, "u1", undefined);
        await handleProfileCreated(deps, "u1", { displayName: 42 });
        expect(sent.map((m) => m.text.split("\n")[0])).toEqual([
            "Hi there,",
            "Hi there,",
        ]);
    });

    it("rethrows a provider failure so the invocation fails", async () => {
        const { deps } = fakeDeps({ fail: true });
        await expect(handleProfileCreated(deps, "u1", {})).rejects.toThrow(
            "ses down",
        );
    });
});

describe("buildWelcomeEmail", () => {
    it("greets by name and falls back to 'there'", () => {
        expect(buildWelcomeEmail("a@b.co", "Ada").text).toContain("Hi Ada,");
        expect(buildWelcomeEmail("a@b.co", undefined).text).toContain(
            "Hi there,",
        );
        expect(buildWelcomeEmail("a@b.co", "").text).toContain("Hi there,");
    });

    it("escapes the name in the HTML body", () => {
        const { html } = buildWelcomeEmail(
            "a@b.co",
            `<script>alert("x")</script>`,
        );
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
        expect(() => readAwsMailConfig({ ...env, MAIL_FROM: "" })).toThrow(
            "MAIL_FROM",
        );
    });
});

describe("profileUid", () => {
    it("reads the uid of a profile document, with or without the full resource prefix", () => {
        expect(profileUid("users/abc123")).toBe("abc123");
        expect(
            profileUid("projects/p/databases/(default)/documents/users/abc123"),
        ).toBe("abc123");
    });

    it.each([
        undefined,
        "",
        "users",
        "users/",
        "users/abc/fcmTokens/tok",
        "devices/abc",
        "users/documents/users/abc123",
        "projects/p/databases/(default)/documents/users/abc/fcmTokens/tok",
        `users/${"x".repeat(129)}`,
    ])("ignores %j", (path) => {
        expect(profileUid(path)).toBeUndefined();
    });
});

describe("eventProfileUid", () => {
    it("uses the document attribute when set", () => {
        expect(eventProfileUid({ document: "users/a1" })).toBe("a1");
    });

    it("falls back to the CloudEvent subject, then the snapshot path", () => {
        expect(eventProfileUid({ subject: "documents/users/b2" })).toBe("b2");
        expect(eventProfileUid({ data: { ref: { path: "users/c3" } } })).toBe(
            "c3",
        );
    });

    it("ignores events with no profile path", () => {
        expect(eventProfileUid({})).toBeUndefined();
        expect(
            eventProfileUid({
                document: "users/a/devices/d",
                subject: "documents/users/a/devices/d",
            }),
        ).toBeUndefined();
    });
});
