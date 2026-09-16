import type { CapacitorConfig } from "@capacitor/cli";
import { KeyboardResize } from "@capacitor/keyboard";

const config: CapacitorConfig = {
  appId: "site.webvault.app",
  appName: "WebVault",
  webDir: "mobile-web",
  backgroundColor: "#f5f7fb",
  loggingBehavior: "debug",
  ios: {
    contentInset: "automatic",
    preferredContentMode: "mobile",
    scrollEnabled: true,
  },
  plugins: {
    Keyboard: {
      resize: KeyboardResize.Native,
      autoBackdropColor: "auto",
    },
    SplashScreen: {
      launchAutoHide: true,
      launchShowDuration: 0,
      backgroundColor: "#161d2e",
      showSpinner: false,
    },
    StatusBar: {
      overlaysWebView: false,
      style: "DARK",
    },
  },
};

export default config;
