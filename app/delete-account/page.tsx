import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Delete your WebVault account",
  description: "Request permanent deletion of your WebVault account and associated data.",
};

const supportEmail = "tneykov@gmail.com";
const deletionMailto = `mailto:${supportEmail}?subject=WebVault%20account%20deletion%20request`;

export default function DeleteAccountPage() {
  return (
    <main className="privacy-page">
      <article className="privacy-card">
        <Link className="privacy-brand" href="/" aria-label="Go to WebVault home">
          <span className="privacy-brand-mark" aria-hidden="true">▦</span>
          <span>WebVault</span>
        </Link>

        <p className="privacy-eyebrow">ACCOUNT DELETION</p>
        <h1>Delete your WebVault account</h1>
        <p className="privacy-lead">
          This page lets you request deletion of your WebVault account and data even if you have uninstalled
          the WebVault app from Google Play.
        </p>

        <section>
          <h2>Fastest option: delete while signed in</h2>
          <p>Open WebVault, select <strong>Profile &amp; settings</strong>, then choose <strong>Delete account</strong>. Confirming the action permanently deletes your WebVault account and its associated content.</p>
        </section>

        <section>
          <h2>Cannot sign in?</h2>
          <p>Send an account-deletion request from the email address associated with your WebVault account. Include the email address of the account you want deleted. We may ask you to verify account ownership to protect the account from unauthorised deletion.</p>
          <p><a href={deletionMailto}>Email WebVault to request account deletion</a></p>
        </section>

        <section>
          <h2>What we delete</h2>
          <p>We permanently delete the WebVault account, saved bookmarks, categories, registered devices, and uploaded custom icons. A temporary account deactivation is not used as a substitute for deletion.</p>
        </section>

        <section>
          <h2>Subscriptions and retained records</h2>
          <p>If you delete a signed-in account with an active WebVault Stripe subscription, the subscription is cancelled before the WebVault account is deleted. Stripe may keep payment and invoice records where required for legal, accounting, fraud-prevention, or security reasons. WebVault does not store card or bank details.</p>
        </section>

        <section>
          <h2>Privacy information</h2>
          <p>Read the <Link href="/privacy#account-deletion">WebVault Privacy Policy</Link> for the data we handle, how it is used, and our retention practices.</p>
        </section>

        <p className="privacy-footnote">This deletion resource applies to WebVault at <a href="https://webvault.site">webvault.site</a> and the WebVault Android app distributed on Google Play.</p>
      </article>
    </main>
  );
}
