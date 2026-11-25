import { deleteApp, getApps, initializeApp } from "firebase-admin/app";
import { ensureDefaultApp } from "../src/lib/adminApp";

afterEach(async () => {
  await Promise.all(getApps().map((app) => deleteApp(app)));
});

describe("ensureDefaultApp", () => {
  it("creates the default app when none exists", () => {
    ensureDefaultApp();
    expect(getApps().map((app) => app.name)).toEqual(["[DEFAULT]"]);
  });

  it("still creates the default app when only another app exists (the Functions SDK's own)", () => {
    initializeApp({ projectId: "demo" }, "__FIREBASE_FUNCTIONS_SDK__");
    ensureDefaultApp();
    expect(
      getApps()
        .map((app) => app.name)
        .sort(),
    ).toEqual(["[DEFAULT]", "__FIREBASE_FUNCTIONS_SDK__"]);
  });

  it("is idempotent", () => {
    ensureDefaultApp();
    ensureDefaultApp();
    expect(getApps()).toHaveLength(1);
  });
});
