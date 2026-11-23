import { getApps, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { onDocumentCreated } from "firebase-functions/v2/firestore";
import { sesSender } from "../lib/awsMail";
import { handleProfileCreated, type WelcomeDeps } from "../lib/welcomeEmail";

/** Amazon SES for sending, Firebase Auth for the recipient (never the client-written profile field). */
function defaultWelcomeDeps(): WelcomeDeps {
  if (getApps().length === 0) initializeApp();
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
 * email is not worth a duplicate.
 */
export const sendWelcomeEmail = onDocumentCreated({ document: "users/{uid}", region: "europe-west1" }, async (event) => {
  await handleProfileCreated(defaultWelcomeDeps(), event.params.uid, event.data?.data());
});
