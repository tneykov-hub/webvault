# WebVault for Android

WebVault now has a Capacitor Android project that bundles the application locally. It does not use an external WebView URL.

## What is included

- The same local WebVault bundle as iOS: authentication, Supabase data, bookmark CRUD, import/export and profile settings.
- Native secure-browser opening for saved websites, so the dashboard remains open.
- `webvault://auth/callback` handling for email confirmation and password recovery.
- Generated adaptive app icons and light/dark splash screens for Android.
- Android security defaults: cleartext WebView traffic is disabled and app backups are disabled because WebVault data is already stored in the user’s protected Supabase account.

## One-time account configuration

In Supabase, open **Authentication → URL Configuration** and add this Redirect URL if it is not already present:

```text
webvault://auth/callback
```

Deploy the matching WebVault web source before testing the app. The native bundle requests metadata from the deployed `/api/metadata` endpoint, which now allows only the Capacitor localhost origins.

## Build on Windows, macOS or Linux

1. Install Node.js 22+, Android Studio and its Android SDK.
2. In the project folder, run:

   ```bash
   npm ci
   npm run cap:sync:android
   npm run cap:open:android
   ```

3. In Android Studio, wait for Gradle sync, choose an emulator or USB-connected Android phone, then press Run.
4. For an update to the existing Google Play app, select its existing upload keystore in Android Studio, then generate a signed Android App Bundle (AAB). Keep the application ID `site.webvault.app`.

After any WebVault UI change, run `npm run cap:sync:android` before rebuilding in Android Studio.

## 30 September 2026 update

- The prepared Android source is version **1.0.2**, `versionCode 3`, based on the published web source `8215fb591d30458a40bbe92d5bb491e8e493b89c`.
- The bundled dashboard now includes in-app ChatGPT web search for PRO. Gemini is no longer an AI-search provider. Existing local bookmark filtering remains available to Free accounts.
- Native ChatGPT requests use `https://webvault.site/api/ai/search` and the signed-in user's Supabase bearer token. The deployed server verifies both the PRO flag and an active/trialing subscription. The OpenAI key is configured only on the server.
- The local mobile production build and Capacitor Android sync have completed. Native callbacks, app icons, secure-browser opening, disabled cleartext traffic and disabled Android backups are retained.
- This Android project uses Android SDK 36 and Java 21. In Android Studio use its Java 21 Gradle JDK and install the SDK version requested during sync.
- Before upload, check the highest version code already used in **Play Console → App bundle explorer**. Code 3 was selected from the previous local Android code 2; the current Play Console maximum has not been verified. If 3 has already been used, set a higher `versionCode` in `android/app/build.gradle` before generating the signed bundle.
- See `ANDROID_UPDATE_BG.md` for the Windows signing/upload steps and `ANDROID_RELEASE_NOTES.md` for the Google Play release text.

## Google Play note

The current native pricing screen synchronizes an existing PRO status but intentionally does not open external Stripe Checkout or the Customer Portal. Before Google Play submission, native Google Play Billing must be implemented for subscriptions that unlock digital features inside the app.

## Not produced here

No signed APK or AAB is included. It requires the owner’s Android signing key and a local Android SDK/Gradle build environment.
