import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Privacy Policy | WebVault",
  description: "How WebVault handles account, bookmark, device, and subscription information.",
};

const updated = "September 22, 2026";
const supportEmail = "tneykov@gmail.com";
const deletionMailto = `mailto:${supportEmail}?subject=WebVault%20account%20deletion%20request`;

export default function PrivacyPage() {
  return (
    <main className="privacy-page">
      <article className="privacy-card">
        <Link className="privacy-brand" href="/" aria-label="Go to WebVault home">
          <span className="privacy-brand-mark" aria-hidden="true">▦</span>
          <span>WebVault</span>
        </Link>

        <p className="privacy-eyebrow">LEGAL</p>
        <h1>Privacy Policy</h1>
        <p className="privacy-lead">
          WebVault is a private bookmark manager. This policy explains what information is handled when you use
          WebVault on the web or through the WebVault Android app distributed on Google Play.
        </p>
        <p className="privacy-updated">Last updated: {updated}</p>

        <section>
          <h2>1. Information we handle</h2>
          <p>We handle only the information needed to provide WebVault:</p>
          <ul>
            <li><strong>Account information:</strong> your email address, optional display name, and a service-generated account identifier used to sign in and secure your account.</li>
            <li><strong>Your WebVault content:</strong> saved website addresses, titles, descriptions, categories, favourites, display preferences, visit activity, and optional custom icons that you choose to add.</li>
            <li><strong>Subscription information:</strong> your subscription status and technical Stripe customer, subscription, and price identifiers. Card and bank details are processed by Stripe and are not stored by WebVault.</li>
            <li><strong>Technical information:</strong> a service-generated device identifier plus basic device and browser information used to provide sync, apply the selected plan, secure the service, and troubleshoot it.</li>
          </ul>
        </section>

        <section>
          <h2>2. How we use information</h2>
          <p>We use this information to create and protect your account, save and synchronise your bookmarks, provide search and organisation features, process subscriptions, prevent abuse, and maintain the service.</p>
          <p>WebVault does not sell personal information and does not use your saved websites or account information for advertising.</p>
        </section>

        <section>
          <h2>3. Service providers</h2>
          <p>WebVault uses carefully selected providers to operate the service:</p>
          <ul>
            <li><strong>Supabase</strong> provides authentication, database, and file-storage services.</li>
            <li><strong>Stripe</strong> processes subscription payments and customer billing management for web subscriptions.</li>
            <li><strong>Vercel</strong> hosts the WebVault website and application services.</li>
          </ul>
          <p>When you request automatic metadata for a website you add, WebVault fetches that website to obtain its title and description. A favicon may be requested from Google&apos;s favicon service. The submitted website address is used only for that request.</p>
        </section>

        <section>
          <h2>4. Sharing and security</h2>
          <p>Your bookmark data is private to your account. We share information with the providers above only as needed to run WebVault, meet legal obligations, or protect the security of the service and its users.</p>
          <p>We use access controls and encrypted connections to protect data in transit. No online service can guarantee absolute security, so please use a strong, unique password.</p>
        </section>

        <section id="account-deletion">
          <h2>5. Account deletion and retention</h2>
          <p>Your account and WebVault content are retained while your account is active. You can remove saved sites and categories from the dashboard at any time.</p>
          <p>To permanently delete your WebVault account while signed in, use <strong>Profile &amp; settings → Delete account</strong> in the app. This deletes your WebVault account, bookmarks, categories, registered devices, and uploaded custom icons. If you have an active WebVault subscription through Stripe, it is cancelled before the WebVault account is deleted.</p>
          <p>If you cannot sign in or no longer have the app, use our public <Link href="/delete-account">account-deletion page</Link> or email <a href={deletionMailto}>{supportEmail}</a> from the email address associated with your account. We may ask you to verify ownership before completing an email request.</p>
          <p>We do not keep a separate archive of deleted WebVault account content. Stripe may retain payment and invoice records where required for legal, accounting, fraud-prevention, or security reasons; WebVault does not receive or store your card or bank details. Service-provider backups and security logs may persist only for their standard disaster-recovery and security-retention periods and are not used to restore a deleted WebVault account.</p>
        </section>

        <section>
          <h2>6. Cookies and local storage</h2>
          <p>WebVault uses essential browser storage and authentication tokens to keep you signed in and to remember service settings. These are used to operate the service, not for behavioural advertising.</p>
        </section>

        <section>
          <h2>7. Children</h2>
          <p>WebVault is not directed to children under 13. If you believe a child has provided personal information, please contact us at <a href={`mailto:${supportEmail}?subject=WebVault%20privacy%20request`}>{supportEmail}</a>.</p>
        </section>

        <section>
          <h2>8. Changes to this policy</h2>
          <p>We may update this policy when WebVault changes or when legal requirements change. The latest version is always published at this address.</p>
        </section>

        <p className="privacy-footnote">This policy applies to WebVault at <a href="https://webvault.site">webvault.site</a> and the WebVault Android app distributed on Google Play.</p>
      </article>
    </main>
  );
}
