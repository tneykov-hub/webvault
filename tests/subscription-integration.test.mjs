import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));

async function source(relativePath) {
  return readFile(path.join(root, relativePath), "utf8");
}

test("enforces the FREE plan limits in the database migration", async () => {
  const migration = await source("supabase/migrations/0004_freemium_stripe_subscriptions.sql");

  assert.match(migration, /count\(\*\).*public\.sites[\s\S]*>= 30/);
  assert.match(migration, /count\(\*\).*public\.categories[\s\S]*>= 3/);
  assert.match(migration, /register_webvault_device/);
  assert.match(migration, /revoke update on table public\.profiles from authenticated/i);
});

test("uses signed Stripe webhooks and hosted subscription checkout", async () => {
  const [checkout, webhook, portal] = await Promise.all([
    source("app/api/stripe/create-checkout/route.ts"),
    source("app/api/stripe/webhook/route.ts"),
    source("app/api/stripe/portal/route.ts"),
  ]);

  assert.match(checkout, /mode:\s*"subscription"/);
  assert.match(checkout, /locale:\s*language/);
  assert.match(checkout, /integration_identifier/);
  assert.match(checkout, /isConfiguredStripePrice/);
  assert.match(webhook, /request\.text\(\)/);
  assert.match(webhook, /constructEvent/);
  assert.match(webhook, /customer\.subscription\.deleted/);
  assert.match(portal, /billingPortal\.sessions\.create/);
});

test("records privacy-conscious acquisition and activation events", async () => {
  const [telemetry, migration, privacy] = await Promise.all([
    source("lib/telemetry.ts"),
    source("supabase/migrations/0005_marketing_events.sql"),
    source("app/privacy/page.tsx"),
  ]);

  assert.match(telemetry, /utm_source/);
  assert.match(telemetry, /trackWebVaultVisit/);
  assert.match(migration, /create table if not exists public\.marketing_events/);
  assert.match(migration, /event_name in \([\s\S]*'site_added'/);
  assert.match(migration, /for insert to anon/);
  assert.match(migration, /for insert to authenticated/);
  assert.match(privacy, /Product usage events/);
});

test("keeps bookmark portability in FREE and applies import limits", async () => {
  const dashboard = await source("app/page.tsx");

  assert.match(dashboard, /function exportBrowserBookmarks\(\)/);
  assert.match(dashboard, /NETSCAPE-Bookmark-file-1/);
  assert.match(dashboard, /source: "sample"/);
  assert.match(dashboard, /FREE_SITE_LIMIT - siteItems\.length/);
  assert.match(dashboard, /const missingCategories = subscription\.isPro/);
  assert.doesNotMatch(
    dashboard,
    /function openBackupManager\(\) \{\s*if \(!subscription\.isPro\)/,
  );
});
