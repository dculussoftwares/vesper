import { onDocumentCreated } from "firebase-functions/v2/firestore";
import { sesWelcomeDeps } from "../lib/awsMail";
import { handleProfileCreated } from "../lib/welcomeEmail";

/**
 * Event trigger: the app created the parent's profile `users/{uid}` (right after the first sign-up, by email or by
 * Google). Sends one welcome email through Amazon SES. Deployed by Terraform with an Eventarc trigger on the same path
 * (infra/gcp/functions.tf); the AWS side is infra/aws. Not retried: a missed welcome email is not worth a duplicate.
 */
export const sendWelcomeEmail = onDocumentCreated({ document: "users/{uid}", region: "europe-west1" }, async (event) => {
  await handleProfileCreated(sesWelcomeDeps(), event.data?.data());
});
