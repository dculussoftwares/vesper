import { z } from "zod";
import { logInfo, logWarn } from "./log";

export interface WelcomeMessage {
    to: string;
    subject: string;
    text: string;
    html: string;
}

export interface WelcomeDeps {
    /** Sends one email. Throws when the provider refuses it. */
    send(message: WelcomeMessage): Promise<void>;
    /**
     * The email address of the Firebase Auth account `uid`, or undefined when the account is gone or has none. The
     * recipient always comes from here: the profile document's `email` field is client-written (firestore.rules only
     * checks its shape), so using it would let a signed-in user make us email any address.
     */
    authEmail(uid: string): Promise<string | undefined>;
}

// A parent profile is exactly `users/<uid>`; the path may come with or without the `projects/.../documents/` prefix.
// A CloudEvent `subject` looks like `documents/users/<uid>`.
const PROFILE_PATH =
    /^(?:(?:projects\/[^/]+\/databases\/[^/]+\/)?documents\/)?users\/([^/]+)$/;

/** The uid of the profile document at `documentPath`, or undefined when the path is not a profile (e.g. a sub-collection). */
export function profileUid(
    documentPath: string | undefined,
): string | undefined {
    const uid =
        documentPath === undefined
            ? undefined
            : PROFILE_PATH.exec(documentPath)?.[1];
    return uid !== undefined && uid.length <= 128 ? uid : undefined;
}

/**
 * The document path of a Firestore event. Eventarc does not always fill the `document` attribute, so fall back to the
 * CloudEvent `subject` and then to the snapshot's own path. Returns the first candidate that is a profile path.
 */
export function eventProfileUid(event: {
    document?: unknown;
    subject?: unknown;
    data?: { ref?: { path?: unknown } };
}): string | undefined {
    for (const candidate of [
        event.document,
        event.subject,
        event.data?.ref?.path,
    ]) {
        const uid =
            typeof candidate === "string" ? profileUid(candidate) : undefined;
        if (uid !== undefined) return uid;
    }
    return undefined;
}

const emailSchema = z.string().trim().max(254).pipe(z.email());
const nameSchema = z.string().trim().max(100);

const escapeHtml = (value: string): string =>
    value
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");

/** Draft copy: needs the owner's approval before it ships to real users. */
export function buildWelcomeEmail(
    email: string,
    displayName: string | undefined,
): WelcomeMessage {
    const name = displayName && displayName.length > 0 ? displayName : "there";
    const text = [
        `Hi ${name},`,
        "",
        "Welcome to Vesper, a free, open-source app blocker that helps you stay focused.",
        "",
        "To get started, open Vesper and create your first block: pick the apps that pull you away and choose when they close.",
        "",
        "If you did not create this account, you can ignore this email.",
        "",
        "The Vesper team",
    ].join("\n");
    const html = [
        `<p>Hi ${escapeHtml(name)},</p>`,
        "<p>Welcome to Vesper, a free, open-source app blocker that helps you stay focused.</p>",
        "<p>To get started, open Vesper and create your first block: pick the apps that pull you away and choose when they close.</p>",
        "<p>If you did not create this account, you can ignore this email.</p>",
        "<p>The Vesper team</p>",
    ].join("\n");
    return { to: email, subject: "Welcome to Vesper", text, html };
}

/**
 * Sends the welcome email for a newly created `users/{uid}` profile (created once, on the first sign-up, by either
 * email or Google sign-in). Returns true when an email was sent. The recipient is the Auth account's own address; an
 * account without a usable one is skipped. A provider failure is logged without the address and rethrown so it shows
 * up as a failed invocation.
 */
export async function handleProfileCreated(
    deps: WelcomeDeps,
    uid: string,
    data: Record<string, unknown> | undefined,
): Promise<boolean> {
    const email = emailSchema.safeParse(await deps.authEmail(uid));
    if (!email.success) {
        logWarn("skipped an account without a usable email address", {
            fn: "sendWelcomeEmail",
            outcome: "no-email",
        });
        return false;
    }
    const name = nameSchema.safeParse(data?.displayName);
    try {
        await deps.send(
            buildWelcomeEmail(email.data, name.success ? name.data : undefined),
        );
    } catch (e) {
        logWarn("the welcome email could not be sent", {
            fn: "sendWelcomeEmail",
            outcome: "send-failed",
            code: e instanceof Error ? e.name : "unknown",
        });
        throw e;
    }
    logInfo("sent a welcome email", {
        fn: "sendWelcomeEmail",
        outcome: "sent",
    });
    return true;
}
