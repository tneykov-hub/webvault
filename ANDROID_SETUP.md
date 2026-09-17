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
4. Before a Google Play release, create a signing key, update `versionCode` and `versionName` in `android/app/build.gradle`, then generate a signed Android App Bundle (AAB).

After any WebVault UI change, run `npm run cap:sync:android` before rebuilding in Android Studio.

## Google Play note

The current native pricing screen synchronizes an existing PRO status but intentionally does not open external Stripe Checkout or the Customer Portal. Before Google Play submission, native Google Play Billing must be implemented for subscriptions that unlock digital features inside the app.

## Not produced here

No signed APK or AAB is included. It requires the owner’s Android signing key and a local Android SDK/Gradle build environment.
