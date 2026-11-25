import { getAuth } from "firebase-admin/auth";
import { onDocumentCreated } from "firebase-functions/v2/firestore";
import { ensureDefaultApp } from "../lib/adminApp";
import { sesSender } from "../lib/awsMail";
import { logInfo } from "../lib/log";
import { eventProfileUid, handleProfileCreated, type WelcomeDeps } from "../lib/welcomeEmail";

/** Amazon SES for sending, Firebase Auth for the recipient (never the client-written profile field). */
function defaultWelcomeDeps(): WelcomeDeps {
  ensureDefaultApp();
  return {
    ...sesSender(),
    authEmail: async (uid) => {
      try {
        return (await getAuth().getUser(uid)).email;
      } catch (e) {
        // Deleted between sign-up and now: nobody to welcome.
        if ((e as { code?: string }).code === "auth/user-not-found") return undefined;
        throw e;
      }
    },
  };
}

/**
 * Event trigger: the app created the parent's profile `users/{uid}` (right after the first sign-up, by email or by
 * Google). Sends one welcome email through Amazon SES to the Auth account's own address. Deployed by Terraform with an
 * Eventarc trigger on the same path (infra/gcp/functions.tf); the AWS side is infra/aws. Not retried: a missed welcome
 * email is not worth a duplicate. Only a document at exactly `users/<uid>` counts; anything else is ignored.
 */
export const sendWelcomeEmail = onDocumentCreated(
  { document: "users/{uid}", region: "europe-west1" },
  async (event) => {
    const uid = eventProfileUid(event);
    if (uid === undefined) {
      // Only attribute names are logged (no ids), enough to see which fields Eventarc filled in.
      logInfo("ignored a document that is not a parent profile", {
        fn: "sendWelcomeEmail",
        outcome: "not-a-profile",
        code: `keys:${Object.keys(event).sort().join(",")}`,
      });
      return;
    }
    await handleProfileCreated(defaultWelcomeDeps(), uid, event.data?.data());
  },
);
