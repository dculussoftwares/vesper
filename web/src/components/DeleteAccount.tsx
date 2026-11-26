// Account deletion for the web (Play requirement). Signs the user in with the Firebase JS SDK, then calls the
// `deleteAccount` callable, which deletes the user's data and Auth account (M6-06).
// The callable enforces App Check, which the page passes with reCAPTCHA Enterprise (infra/gcp/web.tf).
// The Firebase web config is public by design; web.yml writes it to firebase-config.json at deploy time. Without it
// the page tells people to delete the account in the app.
import { type FormEvent, useEffect, useRef, useState } from "react";
import { type FirebaseOptions, initializeApp } from "firebase/app";
import { type AppCheck, ReCaptchaEnterpriseProvider, getToken, initializeAppCheck } from "firebase/app-check";
import {
  type Auth,
  type User,
  GoogleAuthProvider,
  getAuth,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
} from "firebase/auth";
import { type Firestore, collection, getCountFromServer, getDocs, getFirestore } from "firebase/firestore";
import { type HttpsCallable, getFunctions, httpsCallable } from "firebase/functions";

type Config = FirebaseOptions & { functionsRegion?: string; recaptchaSiteKey?: string };
type Step = "loading" | "unconfigured" | "signin" | "confirm" | "done";

interface Firebase {
  auth: Auth;
  appCheck: AppCheck;
  db: Firestore;
  deleteAccount: HttpsCallable;
}

// How long to wait for an App Check token. A content blocker can stop reCAPTCHA from loading; without a limit the
// page would stay on "Deleting..." forever.
const APP_CHECK_TIMEOUT_MS = 15_000;

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("timeout")), ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error: unknown) => {
        clearTimeout(timer);
        reject(error instanceof Error ? error : new Error(String(error)));
      },
    );
  });
}

interface Summary {
  devices: { name: string; blocks: number }[];
  blocks: number;
  notificationTokens: number;
}

// What the account holds right now, read with the signed-in user's own permissions (the Firestore rules let a parent
// read everything under users/{uid}). Failures are not fatal: deletion works without the summary.
async function loadSummary(db: Firestore, uid: string): Promise<Summary> {
  const base = ["users", uid] as const;
  const [devices, tokens] = await Promise.all([
    getDocs(collection(db, ...base, "devices")),
    getCountFromServer(collection(db, ...base, "fcmTokens")),
  ]);
  const rows = await Promise.all(
    devices.docs.map(async (doc) => {
      const data = doc.data() as { name?: unknown; model?: unknown };
      const counted = await getCountFromServer(collection(db, ...base, "devices", doc.id, "blocks"));
      const label = [data.name, data.model].find((v): v is string => typeof v === "string" && v.length > 0);
      return { name: label ?? "Linked device", blocks: counted.data().count };
    }),
  );
  return {
    devices: rows,
    blocks: rows.reduce((sum, row) => sum + row.blocks, 0),
    notificationTokens: tokens.data().count,
  };
}

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

async function loadConfig(): Promise<Config | null> {
  try {
    const response = await fetch("/firebase-config.json", { cache: "no-store" });
    if (!response.ok) return null;
    const config = (await response.json()) as Config | null;
    // The callables enforce App Check, so deletion can't work without the reCAPTCHA site key.
    return config?.apiKey && config.recaptchaSiteKey ? config : null;
  } catch {
    return null;
  }
}

function describe(error: unknown): string {
  const code = (error as { code?: string } | null)?.code;
  switch (code) {
    case "auth/invalid-credential":
    case "auth/wrong-password":
    case "auth/user-not-found":
      return "Wrong email or password.";
    case "auth/popup-closed-by-user":
    case "auth/cancelled-popup-request":
      return "Sign-in was cancelled.";
    case "auth/popup-blocked":
      return "Your browser blocked the sign-in window. Allow pop-ups for this site, or sign in with email.";
    case "functions/unauthenticated":
    case "functions/permission-denied":
      return "Please sign in again and retry.";
    default:
      return "Something went wrong. Please try again.";
  }
}

export default function DeleteAccount() {
  const [firebase, setFirebase] = useState<Firebase | null>(null);
  const [step, setStep] = useState<Step>("loading");
  const [who, setWho] = useState("");
  const [status, setStatus] = useState({ message: "", error: false });
  const [deleting, setDeleting] = useState(false);
  const [summary, setSummary] = useState<Summary | "loading" | "failed">("loading");
  const dialog = useRef<HTMLDialogElement>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  // The account the user confirmed. If the signed-in user changes (another tab, expiry), the confirmation is dropped.
  const confirmedUid = useRef<string | null>(null);

  const say = (message: string, error = false) => setStatus({ message, error });

  useEffect(() => {
    let unsubscribe: (() => void) | undefined;
    let cancelled = false;
    void loadConfig().then((config) => {
      if (cancelled) return;
      if (!config) {
        setStep("unconfigured");
        return;
      }
      const { functionsRegion, recaptchaSiteKey, ...options } = config;
      const app = initializeApp(options);
      const appCheck = initializeAppCheck(app, {
        provider: new ReCaptchaEnterpriseProvider(recaptchaSiteKey as string),
        isTokenAutoRefreshEnabled: true,
      });
      const auth = getAuth(app);
      const deleteAccount = httpsCallable(getFunctions(app, functionsRegion || "europe-west1"), "deleteAccount");
      setFirebase({ auth, appCheck, db: getFirestore(app), deleteAccount });
      setStep("signin");
      unsubscribe = onAuthStateChanged(auth, (user) => {
        if (confirmedUid.current && (!user || user.uid !== confirmedUid.current)) {
          confirmedUid.current = null;
          setStep((current) => (current === "confirm" ? "signin" : current));
        }
      });
    });
    return () => {
      cancelled = true;
      unsubscribe?.();
    };
  }, []);

  function afterSignIn(user: User) {
    confirmedUid.current = user.uid;
    setWho(user.email || user.displayName || "your account");
    setStep("confirm");
    setSummary("loading");
    if (firebase) {
      loadSummary(firebase.db, user.uid).then(
        (loaded) => confirmedUid.current === user.uid && setSummary(loaded),
        () => confirmedUid.current === user.uid && setSummary("failed"),
      );
    }
  }

  async function signInWithGoogle() {
    if (!firebase) return;
    say("");
    try {
      afterSignIn((await signInWithPopup(firebase.auth, new GoogleAuthProvider())).user);
    } catch (error) {
      say(describe(error), true);
    }
  }

  async function signInWithEmail(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!firebase) return;
    say("");
    try {
      const result = await signInWithEmailAndPassword(firebase.auth, email, password);
      setPassword("");
      afterSignIn(result.user);
    } catch (error) {
      say(describe(error), true);
    }
  }

  async function cancel() {
    if (!firebase) return;
    confirmedUid.current = null;
    await signOut(firebase.auth);
    setStep("signin");
    say("");
  }

  async function deleteEverything() {
    if (!firebase) return;
    dialog.current?.close();
    const current = firebase.auth.currentUser;
    if (!confirmedUid.current || !current || current.uid !== confirmedUid.current) {
      confirmedUid.current = null;
      setStep("signin");
      say("The signed-in account changed. Please sign in again.", true);
      return;
    }
    setDeleting(true);
    say("Deleting...");
    try {
      await withTimeout(getToken(firebase.appCheck), APP_CHECK_TIMEOUT_MS);
    } catch {
      setDeleting(false);
      say("This page could not verify your browser. Turn off content blockers for this site, reload the page and try again.", true);
      return;
    }
    // The signed-in user can change while waiting (sign-in in another tab): check again before deleting.
    if (!confirmedUid.current || firebase.auth.currentUser?.uid !== confirmedUid.current) {
      setDeleting(false);
      confirmedUid.current = null;
      setStep("signin");
      say("The signed-in account changed. Please sign in again.", true);
      return;
    }
    try {
      // The callable's input schema is an empty object; no argument would be sent as null and rejected.
      await firebase.deleteAccount({});
      confirmedUid.current = null;
      await signOut(firebase.auth).catch(() => {});
      setStep("done");
      say("Account and all data deleted.");
    } catch (error) {
      say(describe(error), true);
    } finally {
      setDeleting(false);
    }
  }

  return (
    <>
      {step === "unconfigured" && (
        <p className="del-note">
          Account deletion is not available on this site yet. Delete your account in the app instead (Profile, Delete
          account and all data).
        </p>
      )}

      {step === "signin" && (
        <section className="del-step">
          <h2>Sign in to the account</h2>
          <button type="button" className="button white del-google" onClick={signInWithGoogle}>
            <span className="g" aria-hidden="true">G</span>
            Continue with Google
          </button>
          <p className="del-or">or with email</p>
          <form className="del-form" onSubmit={signInWithEmail}>
            <label htmlFor="email">Email</label>
            <input
              id="email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />
            <label htmlFor="password">Password</label>
            <input
              id="password"
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
            <button type="submit" className="button">
              Sign in with email
            </button>
          </form>
        </section>
      )}

      {step === "confirm" && (
        <section className="del-step">
          <h2>Delete everything?</h2>
          <p>
            Signed in as <strong>{who}</strong>.
          </p>

          <div className="del-summary" aria-live="polite">
            <h3>Stored with this account</h3>
            {summary === "loading" && <p className="del-muted">Checking what is stored...</p>}
            {summary === "failed" && (
              <p className="del-muted">We could not list your data. Deleting still removes all of it.</p>
            )}
            {typeof summary === "object" && (
              <>
                <ul>
                  <li>
                    <strong>{plural(summary.devices.length, "linked device", "linked devices")}</strong>
                    {summary.devices.length > 0 && (
                      <span className="del-muted"> ({summary.devices.map((d) => d.name).join(", ")})</span>
                    )}
                  </li>
                  <li>
                    <strong>{plural(summary.blocks, "block rule", "block rules")}</strong>
                  </li>
                  <li>
                    <strong>{plural(summary.notificationTokens, "notification token", "notification tokens")}</strong>
                  </li>
                  <li>Your sign-in account, requests, alerts and usage history</li>
                </ul>
              </>
            )}
          </div>

          <div className="del-actions">
            <button type="button" className="button danger" onClick={() => dialog.current?.showModal()} disabled={deleting}>
              Delete account and all data
            </button>
            <button type="button" className="button quiet" onClick={cancel} disabled={deleting}>
              Sign out
            </button>
          </div>

          <dialog
            ref={dialog}
            className="del-dialog"
            aria-labelledby="del-dialog-title"
            onClick={(event) => event.target === dialog.current && dialog.current?.close()}
          >
            <h2 id="del-dialog-title">Delete your account?</h2>
            <p>
              <strong>{who}</strong> and everything stored with it will be removed
              {typeof summary === "object" && summary.devices.length > 0
                ? `, including ${plural(summary.devices.length, "linked device", "linked devices")}, which will reset`
                : ""}
              . This cannot be undone.
            </p>
            <div className="del-actions">
              <button type="button" className="button danger" onClick={deleteEverything}>
                Yes, delete everything
              </button>
              <button type="button" className="button quiet" autoFocus onClick={() => dialog.current?.close()}>
                Keep my account
              </button>
            </div>
          </dialog>
        </section>
      )}

      <p id="status" role="status" aria-live="polite" className={status.error ? "del-status error" : "del-status"}>
        {status.message}
      </p>
    </>
  );
}
