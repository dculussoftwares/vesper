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
}

const profileSchema = z.object({
  email: z.string().trim().max(254).pipe(z.email()),
  displayName: z.string().trim().max(100).optional(),
});

const escapeHtml = (value: string): string =>
  value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");

/** Draft copy: needs the owner's approval before it ships to real users. */
export function buildWelcomeEmail(email: string, displayName: string | undefined): WelcomeMessage {
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
 * email or Google sign-in). Returns true when an email was sent. A profile without a usable address is skipped; a
 * provider failure is logged without the address and rethrown so it shows up as a failed invocation.
 */
export async function handleProfileCreated(
  deps: WelcomeDeps,
  data: Record<string, unknown> | undefined,
): Promise<boolean> {
  const parsed = profileSchema.safeParse(data);
  if (!parsed.success) {
    logWarn("skipped a profile without a usable email address", { fn: "sendWelcomeEmail", outcome: "no-email" });
    return false;
  }
  try {
    await deps.send(buildWelcomeEmail(parsed.data.email, parsed.data.displayName));
  } catch (e) {
    logWarn("the welcome email could not be sent", {
      fn: "sendWelcomeEmail",
      outcome: "send-failed",
      code: e instanceof Error ? e.name : "unknown",
    });
    throw e;
  }
  logInfo("sent a welcome email", { fn: "sendWelcomeEmail", outcome: "sent" });
  return true;
}
