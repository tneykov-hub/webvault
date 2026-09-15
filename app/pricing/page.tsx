import type { Metadata } from "next";
import { PricingClient } from "@/components/pricing-client";

export const metadata: Metadata = {
  title: "WebVault PRO | Plans and pricing",
  description: "Compare WebVault FREE and PRO plans for private bookmark management.",
  alternates: { canonical: "/pricing" },
  openGraph: {
    type: "website",
    title: "WebVault PRO | Plans and pricing",
    description: "Compare WebVault FREE and PRO plans for private bookmark management.",
    url: "https://webvault.site/pricing",
    images: [{ url: "/webvault-social.png", width: 1200, height: 630, alt: "WebVault PRO plans" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "WebVault PRO | Plans and pricing",
    description: "Compare WebVault FREE and PRO plans for private bookmark management.",
    images: ["/webvault-social.png"],
  },
};

export default function PricingPage() {
  return <PricingClient />;
}
