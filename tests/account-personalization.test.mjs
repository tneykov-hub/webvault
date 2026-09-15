import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

test("personalizes account names and keeps the dark settings menu readable", async () => {
  const [authGate, dashboard, styles, upgradeModal] = await Promise.all([
    readFile(new URL("../components/auth-gate.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
    readFile(new URL("../components/upgrade-modal.tsx", import.meta.url), "utf8"),
  ]);

  assert.match(authGate, /data: \{ full_name: normalizedName \}/);
  assert.match(authGate, /function AuthLanguageProvider/);
  assert.match(authGate, /onStart=\{\(\) => beginAuth\("sign-up"\)\}/);
  assert.match(authGate, /initialMode=\{authMode\}/);
  assert.match(dashboard, /function avatarInitials/);
  assert.match(dashboard, /onSaveDisplayName=\{saveDisplayName\}/);
  assert.doesNotMatch(dashboard, />TN</);
  assert.match(upgradeModal, /href=\{`\/pricing\?lang=\$\{language\}`\}/);
  assert.match(styles, /\.site-dark \.header-menu/);
  assert.match(styles, /\.site-dark \.header-menu \[role="menuitem"\] \{\s*color: #edf1fb;/);
});
