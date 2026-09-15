# WebVault PRO — Stripe setup

## 1. Run the database migration

Run `supabase/migrations/0004_freemium_stripe_subscriptions.sql` in the Supabase SQL Editor after migrations 0001–0003.

It adds the Stripe profile fields, the enforced FREE limits (30 sites / 3 categories / 1 device), subscription-safe profile permissions, realtime profile updates, and the PRO-only custom-icon storage rules.

## 2. Create the Stripe products

In Stripe Dashboard → Product catalog, create these recurring EUR prices:

| Product | Price | Interval |
| --- | ---: | --- |
| `webvault_pro_monthly` | 3.99 EUR | Monthly |
| `webvault_pro_yearly` | 29.00 EUR | Yearly |

Copy the two generated `price_…` IDs.

## 3. Configure environment variables

Copy `.env.example` to `.env.local` locally and add the same variables to Vercel Preview and Production. Keep `SUPABASE_SERVICE_ROLE_KEY`, `STRIPE_SECRET_KEY` and `STRIPE_WEBHOOK_SECRET` server-only.

`NEXT_PUBLIC_STRIPE_PRICE_MONTHLY` and `NEXT_PUBLIC_STRIPE_PRICE_YEARLY` use the same price IDs. Price IDs are safe to expose; the API checks every submitted value against the server-only variables before it creates Checkout.

## 4. Configure the webhook

In Stripe Dashboard → Developers → Webhooks, add:

```text
https://webvault.site/api/stripe/webhook
```

Subscribe to these events:

- `checkout.session.completed`
- `customer.subscription.updated`
- `customer.subscription.deleted`

Copy the endpoint signing secret to `STRIPE_WEBHOOK_SECRET`.

## 5. Enable Customer Portal

In Stripe Dashboard → Settings → Billing → Customer portal, enable the portal and allow customers to update their card and cancel their subscription. The WebVault PRO page opens the portal only for the signed-in Stripe customer stored on that profile.

## VAT / Bulgaria

Stripe can be used from Bulgaria. For EU VAT, enable Stripe Tax and configure your business/tax registrations in Stripe before accepting live payments. Stripe Checkout is created with billing-address collection enabled; configure tax behaviour on each Stripe price according to your accountant's guidance.
