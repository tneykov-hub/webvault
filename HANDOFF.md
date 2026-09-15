# WebVault — HANDOFF

## 15 September 2026 — Microsoft Store certification test account

- The Microsoft Store certification report completed on 15 September 2026 returned **Attention needed** under policies `10.12.10 Functionality` and `10.3.1 App Is Testable – Test Account`.
- A dedicated review account was registered with `tneykov@mail.bg`; Supabase sent the confirmation email. The account has the normal three categories and three harmless public example sites so the tester can open the dashboard immediately.
- The first confirmation link opened `localhost` because it came from an older local signup. A fresh confirmation email was resent with `https://webvault.site` as the redirect; use only the newest message.
- `components/auth-gate.tsx` now uses the canonical public HTTPS redirect for signup, confirmation resend and password recovery, with `NEXT_PUBLIC_AUTH_REDIRECT_URL` available for an intentional override. Local TypeScript/build checks and all 11 tests pass; production deployment `dpl_3X2x1vpirBXyY1douByBLL6KvANK` reached **READY** and is aliased to `https://webvault.site`.
- The verified source is published at `https://github.com/tneykov-hub/webvault` on the `main` branch. The Vercel project still needs its Git repository connection enabled in Project Settings before pushes can trigger deployments automatically.
- The account password is intentionally not stored in source control. Do not resubmit until the email is confirmed and a real production sign-in test succeeds.
- Certification notes must include the account email/password and steps to sign in, view the examples, add/edit/favourite/search/open a site. The demo account is intentionally kept within the Free-plan limits.
- An earlier placeholder record for `store-review@webvault.site` was not login-valid and should be removed from Supabase Auth if it remains.

## 12 September 2026 — growth readiness, localized checkout, telemetry and SEO

- The public landing page now renders during the initial server/client shell while the Supabase session check is pending, so crawlers and first-time visitors receive the product presentation immediately instead of an auth loading screen.
- The primary **Start for free** and **Create your account** actions open registration directly. The header **Log in** action still opens sign-in, and `?auth=signup` / `?auth=signin` links select the matching form.
- `/pricing` now follows the stored EN/BG preference or an explicit `?lang=en|bg` value. It has its own language switch, localized plan copy and localized success/cancel/error states. Checkout and the Stripe Customer Portal receive the selected locale; success and cancel URLs preserve it.
- Limit dialogs on the dashboard are localized too, and their PRO link carries the active `?lang=` value into pricing. An explicit language query is also applied when the dashboard mounts.
- `app/api/stripe/create-checkout/route.ts` records the selected locale in Checkout metadata, passes `locale` and an `integration_identifier`, and preserves the language through the hosted payment return.
- Added `lib/telemetry.ts` and `supabase/migrations/0005_marketing_events.sql`. First-party events record UTM/referrer attribution, landing/pricing/dashboard visits, return visits, registration, added/opened sites and Checkout milestones. Event rows use pseudonymous browser/session IDs and counts; bookmark URLs and titles are not sent to analytics. The client fails silently if the migration has not yet been applied.
- Added Open Graph/Twitter metadata, a generated `public/webvault-social.png`, `app/robots.ts` and `app/sitemap.ts`. The public metadata points to `https://webvault.site`.
- Updated the privacy policy to disclose the limited first-party product usage events.
- Verification: `npx tsc --noEmit`, `npm run vercel-build`, `npm run lint` (0 errors, six non-blocking existing warnings) and `npm test` (11/11) complete successfully.
- The `marketing_events` migration and its `user_id` index have been applied to the connected Supabase project. Redeploy the current source before expecting production event rows. Do not add service-role keys to client variables.

## 11 September 2026 — account personalization and dark-menu readability

- The sign-up flow now asks for a name and sends it to Supabase as full_name; the profile trigger uses it for profiles.display_name.
- Signed-in users can edit their display name in **Profile & settings**. The greeting and avatar are derived from that value, so the prior hard-coded TN is removed.
- The sign-in, registration, recovery and setup screens now respect the EN/BG preference. English is the default, and the language choice persists in webvault-language.
- The header settings dropdown was unreadable in dark mode because Radix renders it in a portal outside the dashboard CSS variable scope. app/globals.css now gives .site-dark .header-menu explicit background, text, icon and hover colors.
- Live Supabase inspection confirmed the owner profile is email-confirmed and marked as PRO; no access or subscription data was modified in this transfer.
- Local verification passed: npm test **9/9** and npm run vercel-build both completed successfully.
- Production deployment completed on 11 September 2026: Vercel deployment `dpl_EoJLGP64QwiHv5YvSksWKh7SkQHf` reached **READY** and is aliased to `https://webvault.site` (build completed in 32s).
- Post-deploy smoke check returned HTTP 200; the deployed CSS contains the dark-menu readability rules and the EN/BG auth language styles. Vercel reported no runtime errors in the last hour.

## 9 September 2026 — Microsoft Store/PWA preparation

- PWABuilder's public report for `https://webvault.site/` found that the production icon URLs currently return 404 and did not detect the service worker during its scan.
- `public/manifest.webmanifest` was enriched with a stable `id`, language direction, categories, `display_override`, `prefer_related_applications` and a shortcut entry for better Windows/PWA packaging.
- Local verification passed: `npm run vercel-build` and `npm test` (7/7).
- The manifest change still needs a new production deployment before rerunning PWABuilder and generating the Microsoft Store package. Do not submit the Store listing until the public icon URLs and service-worker detection are rechecked.

## 9 September 2026 — live Checkout Managed Payments compatibility

- Production Stripe is now using the live account and live recurring Prices.
- The first live Checkout attempt was blocked because Stripe Managed Payments required a product tax code, while this launch intentionally skipped Stripe Tax.
- `app/api/stripe/create-checkout/route.ts` now passes `managed_payments: { enabled: false }` for the WebVault subscription Checkout Session, keeping this integration on standard Stripe Billing without enabling automatic tax.
- Run `npm run vercel-build` and redeploy production before testing Checkout again.

> **Copy this whole file into a new AI chat before continuing work.**
>
> You are continuing an existing personal bookmark manager called **WebVault**. Preserve the approved visual design and all working functionality. Work in small, verified changes; do not replace working architecture with mock data or weaken Supabase security. Read this file and the referenced source files first, then implement only the next agreed milestone.
>
> **Mandatory continuity rule:** after every completed change, update this exact `HANDOFF.md` before handing the project back. It is the single current source of truth for starting a new chat or transferring the project to another AI.

## 🟣 LATEST TRANSFER STATUS — 8 September 2026

- **Freemium + Stripe subscription milestone is implemented in source but not deployed or connected to a live Stripe account.** The user-facing plan is enforced as Free: 30 sites, 3 categories and 1 registered browser device; Pro removes these limits and unlocks backup/import/export, cross-device sync, custom category appearance and PWA controls.
- New server routes are `app/api/stripe/create-checkout/route.ts`, `app/api/stripe/webhook/route.ts` and `app/api/stripe/portal/route.ts`. They use the Stripe secret only on the server, bind checkout and portal requests to the authenticated Supabase user, validate allowed price IDs on the server and verify the webhook from its raw signed body.
- `supabase/migrations/0004_freemium_stripe_subscriptions.sql` is mandatory before deploying this milestone. It adds subscription fields, database-enforced Free limits and device registration, prevents browser clients from updating plan fields, and reserves custom category appearance/storage uploads for Pro.
- The dashboard now exposes a purple **Go Pro** link for Free accounts and a **PRO** badge for active/trialing subscriptions. It blocks upgrades at the site/category/customisation gates, and `/pricing` provides monthly/yearly checkout plus the Stripe Customer Portal. The pricing success state polls the profile briefly so the UI changes to Pro as soon as Stripe has delivered the webhook.
- Copy `.env.example` to the deployment environment, create the two recurring EUR Prices in Stripe, configure the webhook and enable the Customer Portal as documented in `STRIPE_SETUP.md`. Do not put `SUPABASE_SERVICE_ROLE_KEY`, `STRIPE_SECRET_KEY` or `STRIPE_WEBHOOK_SECRET` in client-side variables.
- Verification completed locally: `npx tsc --noEmit`, `npm test` (7/7) and `npm run vercel-build` all pass. Lint has zero errors and four pre-existing non-blocking warnings. A real paid checkout/webhook/portal test still needs the owner’s Stripe dashboard and production environment values.
- No Stripe products, subscriptions, external settings, deployment or production data were changed in this transfer.

## 🔵 LATEST TRANSFER STATUS — 7 September 2026

- The requested WebVault dashboard UX milestone is implemented in `app/page.tsx`, `app/globals.css`, `app/layout.tsx` and `app/api/metadata/route.ts`.
- Site descriptions are normalized and omitted when empty or legacy placeholder text would otherwise appear. New sites fetch title, Open Graph description and favicon through the server metadata route, with a domain-title fallback.
- Cards are clickable, keyboard accessible, hoverable and draggable; favorites, external-link affordances, matched search text and new-site focus/pulse feedback are included.
- The header now keeps the brand, EN/BG switch, profile avatar and a gear menu; secondary actions live in the menu with tooltips. Search includes live filtering, grouped results, filter chips and Cmd/Ctrl+K focus.
- Categories support collapse/expand, menu actions, icon/color editing, category drag reorder, and persistence. Sites can move within and between categories with persistence.
- The add-site form supports metadata autofill, domain-based category suggestions, inline category creation, favorites and bookmark HTML import.
- Verification completed locally: `npm test` passed 5/5 (including the verified build), `npx tsc --noEmit` passed, and `npm run lint` passed with only the existing `img` optimization warnings.
- No deployment or production data was changed in this transfer. The browser verification CLI was unavailable in the runtime, so visual verification should be performed after opening the app in a browser.

## Product and current status

**Purpose:** a modern, private, responsive bookmark dashboard for adding, organising and opening favourite websites.

**Vercel production site:** https://webvault.site

**Vercel fallback URL:** https://my-sites-bookmark-manager.vercel.app

**Previous ChatGPT Sites deployment (kept as a fallback):** https://my-sites-bookmark-manager.tneykov.chatgpt.site

The product is already connected to Supabase. It has working authentication and real database-backed CRUD for websites and categories. The current version was published on 31 August 2026.

## Approved design direction

- Minimal, premium, spacious dashboard; rounded cards and subtle motion.
- Desktop, tablet and mobile are equally important. Mobile uses two cards per row when space allows, then one on very narrow screens.
- Light/dark mode is available; the theme preference is currently stored only on the device.
- The dashboard now defaults to English and has a persistent EN/BG switch in the header. The selected language is stored on the device and applies across the main dashboard labels and interactions.
- Keep the existing page layout and switch to Bulgarian from the header or Profile & settings when preferred.

## Technology

- React 19 + TypeScript
- Vinext/Vite project using the `app/` structure
- Tailwind utilities and the existing vendored Shadcn UI primitives
- Supabase PostgreSQL + Supabase Auth
- `@supabase/supabase-js`
- Vercel production deployment, with the earlier ChatGPT Sites version retained as a fallback.

## Important locations

| Location | Responsibility |
| --- | --- |
| `app/page.tsx` | Dashboard UI, Supabase data loading, sites/category CRUD, search, favorites and favicon behaviour. |
| `app/globals.css` | All current visual styling and responsive rules. |
| `components/auth-gate.tsx` | Email/password sign-up, sign-in, sign-out, session restoration and account bootstrap. |
| `lib/supabase.ts` | Browser Supabase client. |
| `supabase/migrations/0001_my_sites_schema.sql` | Authoritative initial database schema, RLS, functions and triggers. |
| `supabase/migrations/0002_enable_realtime.sql` | Enables database change events for instant cross-device sync. |
| `supabase/migrations/0003_site_icons_storage.sql` | Creates the custom-icon bucket and owner-only upload/delete policies. |
| `supabase/migrations/0004_freemium_stripe_subscriptions.sql` | Adds plan fields, hard Free limits, one-device registration and Pro-only data protections. Run after the first three migrations. |
| `app/api/stripe/` | Secure checkout, verified webhook and Customer Portal route handlers. |
| `app/pricing/page.tsx`, `components/pricing-client.tsx`, `components/upgrade-modal.tsx` | Pricing, checkout/portal client flow and upgrade-limit dialog. |
| `STRIPE_SETUP.md`, `.env.example` | Stripe Dashboard, webhook, Portal and deployment environment setup. |

## Environment setup

Never put a database password or a `service_role`/secret key in browser code, a prompt, or a public repository.

Create `.env.local` from `.env.example` and set:

```env
VITE_SUPABASE_URL=https://<your-project-ref>.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=<your-publishable-or-anon-key>
SUPABASE_SERVICE_ROLE_KEY=<server-only-service-role-key>
STRIPE_SECRET_KEY=sk_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_PRICE_MONTHLY=price_...
STRIPE_PRICE_YEARLY=price_...
NEXT_PUBLIC_STRIPE_PRICE_MONTHLY=price_...
NEXT_PUBLIC_STRIPE_PRICE_YEARLY=price_...
```

The current Supabase project uses the normal project URL with ref `imnekcjyzjzgskkplyri`. The public browser configuration has a safe fallback in `lib/supabase.ts`, because the current host builds client code before its runtime environment values are applied. It is still a publishable key only; never add a secret/service-role key.

## Database and security

Run the files in `supabase/migrations/` in numeric order in the target Supabase SQL editor when setting up a fresh project. The first migration creates:

- `profiles` — per-user preferences: theme and default link-opening preference.
- `categories` — user-owned category name, emoji/icon, visual tone, position and `is_system` flag.
- `sites` — user-owned bookmarks, category, URL, domain, description, favicon/custom icon URLs, favorite state, position, link-opening preference and future visit fields.

Security already implemented in that migration:

- Row Level Security is enabled on all application tables.
- Users can only read or change rows whose `user_id`/profile id matches `auth.uid()`.
- A site can only use a category owned by the same user.
- `0004_freemium_stripe_subscriptions.sql` replaces the default-category seed for new Free accounts with three categories: ⚽ Футбол, ✦ AI and ⭐ Други. Existing accounts keep their current categories.
- The database, not just the UI, rejects a 31st site, fourth Free category or second Free registered device.
- Only the service-role Stripe webhook can update `is_pro` and Stripe identifiers; authenticated browser clients retain their normal profile-preference updates only.
- `bootstrap_my_sites_account()` safely creates missing defaults for an already existing authenticated account.
- The system category **„Други“** cannot be deleted by users.

For Stripe configuration and the exact production webhook event list, use `STRIPE_SETUP.md`.

## What works now

### Public landing page

- Visitors now see a public WebVault landing page before authentication; English is the default language.
- An EN/BG switch in the top navigation changes the landing-page copy between English and Bulgarian.
- The page explains the product, privacy, search, synchronization and free-start benefits.
- The main calls to action open the existing sign-in/registration form without changing the protected dashboard flow.
- The landing page is responsive for desktop, tablet and mobile and uses the established WebVault visual language.

### Authentication

- Email/password registration and secure sign-in.
- „Забравена парола?“ изпраща защитен Supabase линк на имейла.
- След отваряне на линка потребителят задава и потвърждава нова парола.
- Stored session and sign-out.
- The dashboard is inaccessible until sign-in succeeds.
- The auth gate shows a helpful database-setup message if the SQL migration is missing.

### Sites (real Supabase data)

- Add a site: name, URL, category and optional description.
- URL validation and automatic `https://` normalization.
- Automatic domain extraction.
- Edit any site from the pencil icon on its card.
- Delete with a confirmation dialog.
- Favorite/star state is saved in the database.
- Search filters instantly by name, domain, description and category.
- Clicking a card opens the saved URL in a new tab by default.
- The add/edit form lets the user choose whether each site opens in the same tab or a new tab; the choice is saved in `open_in_new_tab`.
- Drag & Drop moves a site before another card or into a different category; the new category and order are saved immediately in Supabase.

### Categories (real Supabase data)

- Add, rename and change emoji/icon.
- Move with arrows or drag and drop.
- Delete with confirmation. Sites from a deleted category are first moved to **„Други“** so data is not lost.
- Category order and changes are saved to the database.

### Favicon behaviour

- On site create or edit, `favicon_url` is automatically set using Google’s favicon endpoint for the saved domain.
- Existing sites without a favicon receive and save one the next time the dashboard loads.
- If an icon cannot be loaded, the card shows a coloured initial-based fallback instead of a broken image.
- The add/edit form accepts a custom PNG, JPG, WebP or GIF up to 2 MB. A custom icon can be replaced or removed, and takes priority over the automatic favicon.
- Custom icon bytes are stored in the public `site-icons` Supabase Storage bucket while upload/update/delete access is limited by user-folder RLS policies.
- `0003_site_icons_storage.sql` must be run once before custom uploads will work.

### Synchronization

- Sites and categories subscribe to Supabase Realtime changes for the signed-in user, so updates from another open device are loaded automatically.
- The app also refreshes safely when it regains focus and checks while visible every 30 seconds. This keeps data current even if an instant Realtime connection is temporarily unavailable.
- `0002_enable_realtime.sql` must be run once in Supabase for instant database-change events; the focus and 30-second fallback works regardless.

### Import / Export

- The download icon in the header opens **Backup и Import**.
- Export downloads a versioned JSON file containing categories, bookmark details, ordering, favorites, favicons and link-opening preferences.
- Import accepts WebVault JSON backups up to 5 MB and remains backward-compatible with legacy My Sites JSON backups. It validates all records before showing a preview, then merges missing categories and sites.
- Chrome bookmark HTML files up to 20 MB are supported. Chrome folders become WebVault categories and nested folder names are preserved as category paths.
- Import never deletes or overwrites existing data. A bookmark with the same URL in the same category is treated as a duplicate and is skipped.

### PWA

- `manifest.webmanifest`, a safe static-asset service worker and 192/512 px branded app icons are included.
- The phone icon in the header opens install status, a native install button when the browser exposes it, and manual iPhone/Android/Windows instructions otherwise.
- The service worker intentionally does not cache authenticated pages or Supabase data; cloud data remains the source of truth.

### Dashboard language and profile settings

- The signed-in dashboard defaults to English for new devices.
- EN/BG controls are available in the dashboard header and the selection persists in `localStorage` under `webvault-language`.
- The profile avatar opens **Profile & settings** with the account email, language choice, light/dark theme controls, password change form and sign-out action.
- Password changes use `supabase.auth.updateUser({ password })` and require at least eight characters plus confirmation.

## Current limitations / next work

These are deliberate remaining milestones, not bugs to hide:

1. **Vercel deployment is complete:**
   - `vercel.json` is present with the Next.js framework and `npm run vercel-build`.
   - `package.json` includes `vercel-build: next build`.
   - `lib/supabase.ts` supports `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` for Vercel while retaining the existing Vite variables and public fallback values used by the ChatGPT Sites host.
   - The TypeScript null-narrowing problem in `app/page.tsx` around the missing-favicon update was fixed by assigning the already-guarded Supabase client to a local non-null `client` before asynchronous callbacks use it.
   - On 31 August 2026, `npm ci` and `npm run vercel-build` completed successfully after two additional Next.js compatibility fixes: the Realtime refresh timer uses a browser `number` type, and its cleanup captures the already-validated Supabase client.
   - The verified Vercel production site is live at `https://my-sites-bookmark-manager.vercel.app` and is also reachable through the custom domain `https://webvault.site`.
   - The preview verified before production is `https://my-sites-bookmark-manager-hdlyh26ue-tneykov-8790s-projects.vercel.app`.
- The Vercel source-upload workflow also requires a harmless `fetch-parts.mjs` helper and the existing `vendor/shadcn-tailwind-4.13.0.css` file to be included in the uploaded source.
- The production source upload must include `app/layout.tsx` together with `app/globals.css`; without the root layout the page can render without styles. The corrected deployment was verified READY on 31 August 2026.
   - The production deployment is using the safe public Supabase fallback values in `lib/supabase.ts`. As a configuration cleanup, set `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` for Preview and Production in Vercel; never set a secret/service-role key.
2. **Password recovery is deployed:**
   - The production version includes the „Забравена парола?“ flow and new-password screen.
   - Supabase Auth email templates and the production redirect URL should be checked if recovery emails are not received.
3. **Public landing page is deployed:**
   - The public marketing page is the first view for signed-out visitors; the dashboard remains protected behind Supabase Auth.
4. **Dashboard English/Bulgarian and Profile & settings are deployed:**
   - Production deployment was verified READY on 31 August 2026 at `https://webvault.site`.
   - The new dashboard language switch, translated core dashboard controls and Profile & settings panel are included.
5. **Future data features:** tags, notes, recently added/opened, visit counts, archive, sharing and public collections are planned but not built.

## Completed optimization steps

### Step 1 — WebVault rebrand (3 September 2026)

- Replaced all user-visible `My Sites` branding in the dashboard, authentication, password recovery, setup messages, PWA install UI and metadata with `WebVault`.
- Updated `public/manifest.webmanifest` to use `WebVault` as both the full and short PWA name.
- Bumped the service-worker shell cache from `my-sites-shell-v1` to `webvault-shell-v2` so installed clients can refresh the branded shell.
- New JSON exports identify the app as `webvault` and download as `webvault-backup-YYYY-MM-DD.json`.
- Import remains backward-compatible with old backups whose app id is `my-sites`.
- Renamed the exported auth hook from `useMySitesAuth` to `useWebVaultAuth`.
- Updated package metadata to `webvault`.
- Kept the legacy localStorage key and Realtime channel name intentionally so existing device preferences and live sync continue without migration risk.
- The existing Vercel project slug/fallback URL remains `my-sites-bookmark-manager` for now; changing infrastructure identifiers is a separate later step.

## Recommended next milestone

Proceed with **Step 2 — dependency/security maintenance**: resolve the Vercel-reported npm vulnerabilities with controlled dependency upgrades, then verify a clean Next.js production build before moving on to architecture refactoring.

## Working rules for the next AI

- Do not use hardcoded demo bookmarks as a production fallback. The signed-in user’s Supabase data is the source of truth.
- Do not remove the existing RLS policies or use a secret key in the client.
- Keep forms validated, loading-aware and error-aware.
- Keep destructive actions confirmed.
- Preserve the approved responsive design and existing mobile behaviour.
- Make small changes and verify the production build after each meaningful milestone.
- Do not silently change the user’s private deployment/access model.

## Verification

```bash
npm run build
```

The existing production build is verified through the project’s `build` script. After changes, test at least: sign-in, data loading, add/edit/delete a site, favorite toggle, category management, and mobile layout when browser testing is available.
