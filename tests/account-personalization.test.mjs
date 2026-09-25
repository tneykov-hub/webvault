import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

test("personalizes account names and keeps the dark settings menu readable", async () => {
  const [authGate, dashboard, styles, privacy, deletionPage, deletionRoute, nativeApi] = await Promise.all([
    readFile(new URL("../components/auth-gate.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
    readFile(new URL("../app/privacy/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/delete-account/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/api/account/delete/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../lib/native-api.ts", import.meta.url), "utf8"),
  ]);

  assert.match(authGate, /data: \{ full_name: normalizedName \}/);
  assert.match(authGate, /function AuthLanguageProvider/);
  assert.match(dashboard, /function avatarInitials/);
  assert.match(dashboard, /Имейл: "Email"/);
  assert.match(dashboard, /Медиа: "Media"/);
  assert.match(dashboard, /Тенор: "Coach"/);
  assert.match(dashboard, /Тенис: "Tennis"/);
  assert.match(dashboard, /categoryDisplayName\(category\.name, language\)/);
  assert.match(dashboard, /onSaveDisplayName=\{saveDisplayName\}/);
  assert.doesNotMatch(dashboard, />TN</);
  assert.match(styles, /\.site-dark \.header-menu/);
  assert.match(styles, /\.site-dark \.header-menu \[role="menuitem"\] \{\s*color: #edf1fb;/);
  assert.match(dashboard, /\/api\/account\/delete/);
  assert.match(dashboard, /Изтриване на акаунта/);
  assert.match(privacy, /tneykov@gmail\.com/);
  assert.match(privacy, /\/delete-account/);
  assert.doesNotMatch(privacy, /Microsoft Store/);
  assert.match(deletionPage, /Email WebVault to request account deletion/);
  assert.match(deletionRoute, /authenticateStripeRequest/);
  assert.match(deletionRoute, /storage\.from\(iconBucket\)/);
  assert.match(deletionRoute, /auth\.admin\.deleteUser/);
  assert.match(nativeApi, /Authorization, Content-Type/);
});
