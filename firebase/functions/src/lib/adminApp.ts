import { getApps, initializeApp } from "firebase-admin/app";

/**
 * Makes sure the default Admin app exists (credentials come from the function's runtime service account). Checks the
 * default app by name: the Functions SDK creates its own `__FIREBASE_FUNCTIONS_SDK__` app to build Firestore event
 * snapshots, so "no apps yet" is not the same as "no default app".
 */
export function ensureDefaultApp(): void {
  if (!getApps().some((app) => app.name === "[DEFAULT]")) initializeApp();
}
