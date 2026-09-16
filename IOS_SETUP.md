# WebVault for iOS

WebVault now has a Capacitor iOS project that bundles the application locally. It does not load `https://webvault.site` as a remote WebView.

## What is included

- The existing WebVault dashboard, authentication, Supabase CRUD, backup/import and profile settings are built into the app.
- Saved websites open in the native secure browser so WebVault stays open in the background.
- Email confirmation and password recovery return to the app through `webvault://auth/callback`.
- WebVault app icon, light/dark splash screens, status bar and keyboard handling are configured for iOS 15 and later.
- The native source is in `ios/`; the reusable mobile build source is in `mobile/`.

## One-time account configuration

In Supabase, open **Authentication → URL Configuration** and add this Redirect URL:

```text
webvault://auth/callback
```

Deploy the matching WebVault web source before installing this iOS build. The mobile app calls the deployed `/api/metadata` route for title and description detection; that route now allows requests only from the Capacitor localhost origins.

## Build on a Mac

1. Install Node.js 22+, Xcode and an Apple Developer account/team.
2. In the project folder, run:

   ```bash
   npm ci
   npm run cap:sync:ios
   npm run cap:open:ios
   ```

3. In Xcode, select the **App** target, choose your Apple Development Team under **Signing & Capabilities**, and keep the bundle identifier `site.webvault.app` or replace it with an identifier you own.
4. Select an iPhone simulator or a connected iPhone, then press Run.

After any WebVault UI change, run `npm run cap:sync:ios` again before rebuilding in Xcode.

## App Store note

The current iOS screen shows existing PRO status but intentionally does not run the external Stripe Checkout or Customer Portal. Before App Store submission, native In-App Purchase / StoreKit billing must be implemented for subscriptions that unlock digital features inside the app.

Before submission, complete the App Store privacy labels and verify Xcode's privacy report for the final dependency set.

## Not produced here

An `.ipa`, provisioning profile and App Store upload require macOS, Xcode and the account owner's signing credentials. They are not stored in this project.
