# WebVault — HANDOFF

## 1 October 2026 — subscription, checkout, metadata and AI cost protections

- The owner authorized fixing the four findings from the 1 October audit. Design, prices, the GPT-6 Luna model and native store purchase restrictions remain unchanged. The owner `tneykov@gmail.com` stays PRO with `manual_founder`; neither the migration nor verification changes any existing profile row.
- Stripe webhooks now acquire a durable per-profile lease, retrieve canonical subscription/customer state from Stripe, and atomically apply it with a fencing token and an event receipt. An old active event after cancellation cannot restore PRO; retries are idempotent and an expired worker cannot overwrite a newer result. An old canceled subscription also cannot revoke a newer active WebVault subscription. Checkout requires a real paid/trial subscription. Founder profiles are excluded from Stripe synchronization both before and during the final transaction.
- The server pricing page passes the non-secret plan IDs to the client from `lib/stripe-prices.ts`, the same verified configuration used by the Checkout allow-list. Missing or duplicated legacy STRIPE_PRICE/NEXT_PUBLIC price environment values are no longer used; the static pricing page retains its existing design and caching behavior. The monthly and yearly IDs are distinct and correspond to their displayed billing periods. The active live EUR 3.99/month and EUR 29/year Stripe prices were checked read-only. No price, product, Stripe billing configuration or real customer purchase was changed.
- Metadata permits public HTTP(S) destinations on default ports only. All DNS answers and every redirect are checked; the socket is pinned to a validated address while keeping TLS hostname verification. Private/local/mapped/transition addresses, credentials, oversized input and compressed responses are rejected. Fetching is limited to 3 redirects, 512 KiB and a total 7 seconds. The existing response format and Capacitor CORS contract are preserved. Durable metadata limits are 30/minute, 300/day, 5,000/calendar month and 3 concurrent requests per hashed ingress IP; non-Vercel environments share a bounded bucket.
- AI reservations are atomic and server-only: 20 attempts/day, 200/calendar month, 6/minute and 1 concurrent request per verified user. UTC calendar resets, 45-second expiring leases, provider cancellation after 25 seconds, one web-search tool call, the existing 700-token output cap and bounded input/provider bodies limit cost and resource use. Attempts count before contacting OpenAI, including errors; denied requests never contact the provider. Access is checked again in the reservation transaction. The existing web error box displays BG/EN quota feedback; an older Android bundle still receives backend enforcement.
- The migration additionally restricts client profile INSERT to safe personal fields, preventing self-assigned PRO/Stripe/founder entitlement while retaining auth triggers and bootstrap behavior. Existing protected UPDATE restrictions remain intact. New tables have RLS and service-role-only grants; all five new functions are SECURITY INVOKER and executable only by service_role.
- Production migration `20261001093416_harden_stripe_and_request_limits.sql` was applied to project `imnekcjyzjzgskkplyri`. A rolled-back live verification confirmed founder access, FREE denial and concurrent-request blocking without provider calls or persistent usage. The before/after digest of all 14 profiles is identical. The filename reflects the recorded remote migration version (the initial CLI-generated file was 20261001085206).
- Verification: **109/109** targeted tests passed, including executable route tests against real PostgreSQL/PGlite migration functions, stale events, retries, fencing, FREE/founder access, quota boundaries, malicious DNS/redirects and response limits. `npm run vercel-build` passed compilation and TypeScript, and `npm run mobile:build` passed. Shared pricing and the executable Checkout route are covered by regression tests with missing/duplicated legacy price variables, including both billing periods, rejection of empty/unrecognized plans and prevention of duplicate PRO purchases. A future Stripe price replacement must update the public configuration in lib/stripe-prices.ts and deploy it; secret keys stay in Vercel. Targeted ESLint for the new server code, pricing and security tests passed. The dashboard retains the baseline lint error about `Date.now` in the existing icon-upload function and five baseline warnings; an existing privacy assertion in the subscription integration suite also fails unchanged. These unrelated issues were not altered.
- No real payment or charged OpenAI request is made by these checks. Final branch/production deployment checks and full archive details are recorded in the root archive HANDOFF and security report. The signed Android 1.0.3/code 4 AAB and its frozen source remain byte-identical; these server protections apply through its existing API endpoints. Play submission/rollout is not confirmed.

## 1 October 2026 — ChatGPT visibility across PRO and Android 1.0.3

- The owner requested that Android show ChatGPT search and that every PRO offer clearly includes it, matching the attached dashboard and pricing screenshots. The supplied screenshots lack the ChatGPT controls and comparison row; both are already present in the verified current web source and frozen 1.0.2 assets. The installed version/device build was not independently identified. Do not claim that a server model change updates an older locally bundled Android UI.
- The existing dashboard ChatGPT action, gold PRO badge, in-app answers/citations and Profile & settings explanation are retained. Pricing now says “Search with ChatGPT” / “Търсене с ChatGPT”; the comparison remains unavailable for FREE and checked for PRO. The upgrade dialog gives ChatGPT its own benefit row. The existing public landing descriptions explicitly attribute ChatGPT to PRO in both EN and BG. The native purchase notice says “mobile app” instead of incorrectly calling Android an iOS app. No CSS/layout, pricing, checkout, AI model or entitlement logic was changed.
- Protected owner account: `tneykov@gmail.com` remains PRO with `stripe_subscription_status = 'manual_founder'`. It is not the separately observed PRO/null-status account. Do not downgrade, normalize, or otherwise change the owner's profile/founder entitlement as part of billing cleanup. This change performs no database, account or Stripe writes.
- Verification: `npm run vercel-build` passed compilation and TypeScript; `npm run mobile:build` passed; all **21/21** existing pricing localization and AI route/access-control scenarios passed. Targeted ESLint passed with 0 errors and the existing auth-gate `signOut` dependency warning. CSS and the AI route remain byte-identical to the current production baseline. Provider tests are mocked; a real signed-in AI answer is still not verified by this task.
- Android update is prepared separately as **1.0.3 / versionCode 4**, based on the latest shared web source plus the previous native Android project. The archived signed 1.0.2 / code 3 source and AAB are retained unchanged. `npm run cap:sync:android` passed; all 16 generated mobile assets exactly match the files synced into the new Android project. The packaged JavaScript contains the BG/EN ChatGPT action, PRO feature label, AI endpoint and the corrected mobile notice. No Android SDK/Java 21 or private owner signing key is available here, so this does not produce or upload a new signed AAB. The owner must rebuild/sign with the registered upload key and distribute the new package before installed Android apps show the updated UI.
- Web publication status and new Android preparation details are recorded in the root archive HANDOFF and Android release metadata after verification.

## 1 October 2026 — GPT-6 Luna search model

- The owner explicitly requested switching WebVault's AI search to GPT-6 Luna. The route's default and `.env.example` now use `gpt-6-luna`; `vercel.json` declares this non-secret server environment value for Vercel functions. `OPENAI_API_KEY` remains exclusively in the server environment.
- Official OpenAI documentation confirms GPT-6 Luna supports the existing Responses API, built-in web search and `reasoning.effort: "none"`: https://developers.openai.com/api/docs/models/gpt-6-luna . The existing prompts, required web search, low search context, 500-character query limit, 700-output-token cap, answer/citation contract and PRO/founder access rules are preserved.
- This is a server-side model change. Android 1.0.2 calls `https://webvault.site/api/ai/search` and will use the deployed server model without a new AAB. No native package or store release is part of this change.
- The earlier generic AI error was diagnosed in production logs on 30 September at 19:33:58 UTC: OpenAI HTTP 429, `code: credit_balance_exhausted`, `type: insufficient_quota`. Switching models does not replenish API credits. No API balance, key or billing configuration is changed here.
- Local verification passed: **19/19** existing route/access-control and provider-error privacy scenarios, targeted ESLint, source whitespace checks and `npm run vercel-build` including TypeScript. The route's executable source differs only in the default model identifier; `.env.example` and `vercel.json` select the same target. These tests mock OpenAI; a successful real signed-in GPT-6 Luna answer is not yet verified.

## 30 September 2026 — gold ChatGPT PRO badge and provider error diagnosis

- The owner requested that the crown and PRO text beside ChatGPT use the same gold styling as the header PRO button. `app/globals.css` now gives `.pro-badge` and `.ai-pro-badge` a shared gold foreground, translucent gold background and gold border; the former purple light/dark AI-badge overrides were removed. The existing compact pill layout remains intact.
- After the founder-access release, the owner's screenshots showed a generic ChatGPT response error rather than the Free upgrade dialog. Production logs confirmed two requests reached OpenAI at 15:59:26 and 15:59:33 UTC (18:59 Europe/Sofia) and OpenAI returned HTTP 429; WebVault returned HTTP 502. The founder access gate is no longer the observed blocker, and a server-side provider key is present. A successful live AI answer and the precise 429 cause remain unverified.
- Official OpenAI error-code guidance (`https://developers.openai.com/api/docs/guides/error-codes`) distinguishes rate limits from credit/spend/usage limits via `error.code`. Existing logs recorded only the HTTP status and request ID. The search route now also logs allow-listed-format provider error `code` and `type` labels, without the raw provider error message, search query or API key. Client-facing errors remain generic. No API billing balance, spending limit, key or model configuration was changed.
- Local verification passed: **19/19** route/access-control and provider-error privacy tests, targeted ESLint, `git diff --check`, and `npm run vercel-build` including TypeScript. These use mocked provider responses; the quota/rate-limit distinction must be checked on a subsequent live request after deployment.
- Published the gold badge and diagnostic logging in code commit `db3b81137dcc72801cdaf3e6e9cefd8d4f4585e1` after READY Preview deployment `dpl_9PUMH4YuMJfMMdAiARKdsTL7JGQt` returned HTTP 200. Production deployment `dpl_CrzQKy9YDuuzATEYk8r7FoqGvEGH` reached READY and Vercel assigned `webvault.site` to it. The public home page returned HTTP 200 and its active stylesheet `/_next/static/chunks/0.0rdfqeb5tjj.css` contains the shared gold `.pro-badge,.ai-pro-badge` rule with no purple AI-badge override. This verifies the deployed CSS; no new browser visual/device screenshot was captured.
- **Android distinction:** the owner reported the already-signed version 1.0.2 AAB was uploaded to Google Play. Its locally bundled CSS predates this gold badge edit, so the new badge colour requires a later Android build/release. The server-side founder access and error diagnosis apply immediately through `https://webvault.site/api/ai/search`; they do not require another AAB. Do not represent the newly edited web CSS as included in the already-uploaded package.

## 30 September 2026 — founder PRO search access and signed Android update

- The owner explicitly authorized enabling ChatGPT search for the existing founder PRO account. Live read-only Supabase inspection confirmed the owner's profile has `is_pro = true` and `stripe_subscription_status = 'manual_founder'`; no account or Stripe subscription fields were changed.
- `app/api/ai/search/route.ts` now accepts the protected `manual_founder` entitlement together with `is_pro = true`, in addition to the existing active/trialing PRO subscriptions. The Stripe billing helper remains unchanged. A PRO flag without an eligible status is still denied, and ordinary Free accounts cannot call OpenAI or gain access through request-body fields.
- Verified live database privileges: authenticated users can update only `display_name`, `open_links_in_new_tab` and `theme` on `profiles`; they cannot set their own plan or subscription status. The API continues to read the profile for the server-authenticated user ID.
- Local checks for the initial access fix passed: 16 access-control regression scenarios against the actual route source in `tests/ai-search-access.test.mjs`, targeted ESLint, `git diff --check`, and `npm run vercel-build` (including TypeScript). The follow-up diagnosis tests bring the total to 19. Provider responses were mocked in these tests; a real signed-in founder OpenAI answer has not yet been verified.
- Published after the owner's explicit authorization: code commit `e8f3d746a40f282fd4ea77206019ea5221ee14c4` on `codex/founder-pro-search-fix-20260930` passed the READY Preview deployment `dpl_6f4kCirNQ78ZX5gKHnYxQcN8XMDf`, then advanced production `main` from `8215fb591d30458a40bbe92d5bb491e8e493b89c`. Production deployment `dpl_DY889orYv9d2v69naprnn9YrnLMT` reached READY and Vercel assigned `webvault.site` to it.
- Live production checks passed: `/` returned HTTP 200; `POST /api/ai/search` returned HTTP 401 for both missing and invalid authentication; Android-origin (`https://localhost`) CORS preflight returned HTTP 204 with `Authorization, Content-Type` permitted. The initial deployment-scoped ten-minute runtime check reported no error/fatal entries; subsequent owner searches returned provider HTTP 429 as documented above. A real signed-in founder OpenAI answer has not succeeded in the observed requests.
- **Android package completed:** the owner built the signed `app-release.aab` successfully in Android Studio on Windows. Independent verification of the uploaded file confirmed package `site.webvault.app`, version code **3**, version name **1.0.2**, target/compile SDK 36 and minimum SDK 24. All 18 packaged public web assets match the prepared Android source on branch `codex/android-chatgpt-update-20260930`, commit `e8238506780b8236bcfd42dce026ac2706f50c2a`.
- The AAB is 3,512,161 bytes with SHA-256 `21eea377c213ddddbe48f08d6fe8d999a028a2cf4770bf4e4cb86c1ec12cff99`. Its signature and all 487 payload digests were verified. The signing certificate's SHA-256 is `7EB1457890F22448462D40E6368094D4181587D5278A46714AD44A0165FFA4E0`. The uploaded AAB is available as `libfile_0a82d2f74fc48191b3ce8fb2ccd01656`; the existing source archive is `WebVault-Android-1.0.2-2026-09-30.zip`.
- **Google Play upload reported completed:** at 18:59 Europe/Sofia on 30 September 2026 the owner stated that the Android correction has now been uploaded to Google Play. This supersedes the earlier pending-upload status. The last independently observed Play Console release was Closed testing / Alpha, version code 1 / version 1.0; the earlier screenshot showed a pending upload-key reset. The uploaded release's current review, approval and rollout status have not yet been independently checked. Do not state that Google is still blocking upload after the owner's new confirmation, and do not equate upload with approval or availability to testers.
- Next Android step: verify the newly uploaded release is the intended version code 3 / version 1.0.2, then confirm its review and rollout status in Closed testing / Alpha. Keep the private keystore and passwords on the owner's computer. This founder access change is server-only and does not require rebuilding the prepared AAB; a real Android ChatGPT request remains to be tested.

## 30 September 2026 — PRO-only in-app ChatGPT web search

- Published the verified branch `codex/chatgpt-pro-search-20260930` to production `main` on 30 September 2026 after the user's explicit publication instruction. The code release commit is `2fd218a5763a4a3b538be49832c5ac0c5d1ff13e`, based on the previous production commit `3e71f1df177a0591ebd3a96626838a7225073a53`.
- Replaced the API-free ChatGPT/Gemini shortcut picker with a single **ChatGPT search** action that returns the answer directly inside WebVault. Gemini is no longer offered as an AI-search provider.
- ChatGPT search is gated twice for paid access: the dashboard opens the existing PRO upgrade dialog for Free accounts, and the new server route `app/api/ai/search/route.ts` independently authenticates the Supabase bearer token and verifies the user's server-side WebVault PRO subscription state before calling OpenAI.
- The OpenAI key is server-only. The route reads `OPENAI_API_KEY` and never sends it to the browser or native bundle. `.env.example` documents `OPENAI_API_KEY` plus optional `OPENAI_SEARCH_MODEL`; the default model is `gpt-5.6-luna`.
- The route uses the OpenAI Responses API with the `web_search` tool required on every AI query, `store: false`, low search context, a 500-character input limit and a 700-output-token cap. Web URL citations are returned to WebVault as source buttons below the answer.
- Pricing and upgrade UI now list ChatGPT web search as a PRO feature. Profile & settings explains that ChatGPT search runs inside WebVault and requires PRO.
- **Configuration and live verification:** `OPENAI_API_KEY` must be configured as a server-only Vercel environment variable (Preview for preview testing; Production for the public site). Its presence and a successful paid-PRO OpenAI request have not been confirmed during this verification. Do not paste the key into chat, GitHub, source code, or any `NEXT_PUBLIC_*` variable.
- Deployment: production deployment `dpl_EU9fFBB52TQfMdwk5TPmFuJJcnvd` for release commit `2fd218a5763a4a3b538be49832c5ac0c5d1ff13e` reached **READY** at `https://my-sites-bookmark-manager-rg13yoqfe-tneykov-8790s-projects.vercel.app`; Vercel assigned `webvault.site` to this deployment. The latest checked Preview was `dpl_GQe8BBqKcTDqzRVXmEtupTNRU6ZF` for the same commit.
- Live production checks: `/` and `/pricing` returned HTTP 200. `POST /api/ai/search` returned HTTP 401 without authentication and with an invalid bearer token. No production runtime error/fatal entries were reported in the deployment-scoped ten-minute check.
- Access-control verification: 11 isolated scenarios against the exact Preview route source passed, including Free and non-active subscriptions returning 403 before any provider call, configuration/database failures failing closed, and mocked active/trialing PRO requests returning 200. These were simulations, not real signed-in paid searches.
- A real successful AI answer remains unverified. At verification time Supabase contained zero profiles with both `is_pro = true` and an `active`/`trialing` subscription. The existing test account has a PRO flag but no active subscription status, so it is denied by this route. No subscription or account flags were changed.
- This release updates the web application only; the Android package and Play Store release still require a separate build and submission.

## 29 September 2026 — AI search shortcut and latest-source check

- Confirmed the latest GitHub `main` is `68e02959a98a26c52b4d67976f05ca216a03f867` (`Add Google Play button to landing page`, 26 September 2026, 06:15 UTC). The local source tree matched that commit before this change; the work is on branch `codex/ai-search-20260929`.
- The dashboard keeps its instant local bookmark search and now lets users choose ChatGPT or Gemini beside the search field. The preferred provider is also selectable in **Profile & settings** and is saved in browser local storage.
- Selecting **Open ChatGPT/Gemini** opens that provider and copies a web-search prompt in the selected WebVault language. The user pastes and submits it in the provider. This API-free shortcut does not return AI answers inside WebVault or send AI requests from a WebVault server. A future in-app AI search needs a protected provider key, usage controls and cost limits.
- Verification: `npm run vercel-build`, `npm run mobile:build`, `npx tsc --noEmit` and `npm run lint` passed (lint has six warnings in existing code). `npm test` is blocked because the checked-out source has no `build/sites-vite-plugin` imported by `vite.config.ts`; running the test files directly gives 9 passes and 4 failures in unrelated landing-page/privacy assertions or tests that expect generated `dist` files. That run also logs that port 24678 is already in use.
- Published to production from GitHub commit `c70f647ae65dcb7df23f13f2ec0d0d503bbf1115`; Vercel marked the deployment READY and assigned `webvault.site`. Verified the live home page returns HTTP 200 and its deployed JavaScript contains the saved provider setting, ChatGPT and Gemini destinations. Vercel reported no runtime errors in the preceding hour.
- This is a web release only. The Android package and Play Store release remain unchanged and will be handled separately.

## 22 September 2026 — Google Play privacy and account deletion readiness

- The Google Play compliance source updates are implemented locally and use the public support address `tneykov@gmail.com` (support and account-deletion requests only).
- Added the public `app/delete-account/page.tsx` route. After production deployment its required external Google Play account-deletion URL is `https://webvault.site/delete-account`.
- Updated `app/privacy/page.tsx` for the WebVault Android app, including data handling, account deletion, Stripe cancellation and retention details.
- Added the signed-in **Delete account** flow in Profile & settings. `app/api/account/delete/route.ts` authenticates the user, cancels an active Stripe subscription, removes that user's `site-icons` objects and deletes the Supabase Auth user; existing database foreign keys cascade the user's profile, categories, sites and registered devices.
- Native CORS now permits the `Authorization` request header. Android `versionCode` is now `2` and `versionName` is `1.0.1`, so the next signed AAB can be uploaded after the already-uploaded version 1.
- Verification passed on 22 September: `npm run mobile:build`, `npx cap sync android`, and `npm test` (9/9). The Android assets were synced to `android/app/src/main/assets/public`.
- Production deployment of these changes is still pending. The connected Vercel deploy action returned the platform error `Tool deploy_to_vercel not found`; it was not retried as an infrastructure mutation. Do not enter the external deletion URL or release a new AAB until `https://webvault.site/delete-account` is live and tested.



## 16 September 2026 — Capacitor iOS and Android application foundations

- WebVault now has production-safe Capacitor 8 native projects in `ios/` and `android/`. Both package a 

locally built WebVault bundle from `mobile/`; neither uses Capacitor `server.url` or loads the production site as a remote WebView.
- `capacitor.config.ts` uses app ID `site.webvault.app`, a local `mobile-web` build, mobile content mode, native keyboard resizing, non-overlay status-bar behaviour and branded splash settings. The iOS target supports iOS 15.0+.
- Added the Capacitor App, Browser, Keyboard, Splash Screen and Status Bar plugins. Existing WebVault artwork now generates the iOS app/icon splash catalog and Android adaptive icon/light-dark splash resources.
- Saved websites open through the native secure browser, preserving WebVault in the background. The PWA install dialog recognises the native app and does not attempt service-worker/PWA installation inside Capacitor.
- Email confirmation and password recovery use `webvault://auth/callback`. It is registered in `ios/App/App/Info.plist`, Android's launcher intent filter and Supabase Authentication → URL Configuration (verified on 16 September 2026).
- Android disables cleartext traffic and Android backups in `android/app/src/main/AndroidManifest.xml`. The app stores its source-of-truth data in the user's protected Supabase account; no credentials or service-role key were added to the bundle.
- The native app uses the existing Supabase project directly. `app/api/metadata/route.ts` now exposes narrow CORS headers only for Capacitor localhost origins, so title/description detection works after the matching web source is deployed.
- Mobile routes are local hash routes for the dashboard and pricing screen. Existing PRO status synchronizes, but external Stripe Checkout and Customer Portal are deliberately disabled in both native builds. Implement StoreKit and Google Play Billing before a store submission that sells digital PRO features.
- New commands: `npm run mobile:build`, `npm run mobile:dev`, `npm run cap:sync:ios`, `npm run cap:open:ios`, `npm run cap:sync:android`, `npm run cap:open:android`. `IOS_SETUP.md` and `ANDROID_SETUP.md` contain the exact setup, signing and update steps.
- No `.ipa`, APK or AAB was produced here: iOS requires macOS, Xcode and Apple signing credentials; Android requires the local Android SDK and the owner’s signing key. This workspace has Java 17 but no Android SDK, so an Android Gradle build was not attempted.
- Final verification passed locally: `npx tsc --noEmit`, `npm run lint` (0 errors; 6 pre-existing warnings), `npm run mobile:build`, `npm run cap:sync:ios`, `npm run cap:sync:android`, `npm run vercel-build`, and `npm test` (**9/9**). No production deployment, Supabase data, Stripe configuration, store account or signing setting was changed in this transfer.
- Android emulator smoke test passed on 16 September 2026 in Android Studio on Windows: after `npm ci` and `npm run cap:sync:android`, the app installed successfully on a Pixel 8 / Android 15 (API 35) emulator. It signed in with the owner’s real account, loaded real Supabase categories/sites and opened a saved external site in the native browser, returning correctly to WebVault.
- A Vercel **preview** was deployed from branch `codex/capacitor-android-preview-2026-09-16`, commit `4498288195adc005763e6680b337ad9b5b738c4b`, and reached **READY**: `https://my-sites-bookmark-manager-470adlh4x-tneykov-8790s-projects.vercel.app/`. The preview root returned HTTP 200 and rendered the WebVault authentication shell. The earlier type-check failure was fixed by passing the active dashboard language into the localized upgrade modal. Production was not promoted: `webvault.site` remains on READY deployment `dpl_3X2x1vpirBXyY1douByBLL6KvANK`.
- Email confirmation/password recovery and new-site metadata lookup are not yet device-tested. The Supabase callback is configured. The native metadata client still points to `https://webvault.site`, so a production deployment of this matching source is required before testing metadata lookup from the Android app.
- Production approval was given on 17 September 2026. The preview branch was merged to `main` in squash commit `b38b4fab0836beee32c59842d734be93d5bb1e24`; Vercel production deployment `dpl_HcRU78eYarJHA9xk6qUpjC5VgNw9` reached **READY** and is aliased to `https://webvault.site`. Post-deploy checks returned HTTP 200 for the public root, HTTP 200 with `{title, description, faviconUrl}` for `POST /api/metadata`, HTTP 204 for the `capacitor://localhost` CORS preflight, and no grouped runtime errors in the last hour.
- **Next agreed product step:** in Android Studio, run `npm run cap:sync:android`, rebuild/install the app, then test email confirmation/password recovery through `webvault://auth/callback` and new-site metadata lookup against production. An optional physical Android test can happen in parallel. Native store billing is the follow-on store-release milestone.

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
