import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://webvault.site"),
  title: "WebVault — Private bookmark dashboard",
  description: "Organise the websites and tools you use most in one fast, private dashboard.",
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    url: "https://webvault.site/",
    siteName: "WebVault",
    title: "WebVault — Private bookmark dashboard",
    description: "Organise the websites and tools you use most in one fast, private dashboard.",
    images: [{ url: "/webvault-social.png", width: 1200, height: 630, alt: "WebVault private bookmark dashboard" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "WebVault — Private bookmark dashboard",
    description: "Organise the websites and tools you use most in one fast, private dashboard.",
    images: ["/webvault-social.png"],
  },
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, statusBarStyle: "default", title: "WebVault" },
  icons: {
    icon: [
      { url: "/favicon.svg", type: "image/svg+xml" },
      { url: "/icon-192.png", sizes: "192x192", type: "image/png" },
    ],
    shortcut: "/favicon.svg",
    apple: { url: "/icon-192.png", sizes: "192x192", type: "image/png" },
  },
};

export const viewport: Viewport = { themeColor: "#161d2e" };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <head>
        <meta name="codex-preview" content="development" />
        <script
          dangerouslySetInnerHTML={{
            __html:
              'if ("serviceWorker" in navigator) { navigator.serviceWorker.register("/sw.js").catch(function () {}); }',
          }}
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
