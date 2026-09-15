const ownerEmail = process.env.OWNER_NOTIFICATION_EMAIL;
const resendApiKey = process.env.RESEND_API_KEY;
const sender = process.env.RESEND_FROM_EMAIL;

type OwnerNotification = {
  subject: string;
  text: string;
  idempotencyKey: string;
};

export async function notifyOwner(notification: OwnerNotification) {
  if (!ownerEmail || !resendApiKey || !sender) {
    console.info("Owner email notification skipped: Resend is not configured.");
    return;
  }

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${resendApiKey}`,
      "Content-Type": "application/json",
      "Idempotency-Key": notification.idempotencyKey,
    },
    body: JSON.stringify({
      from: sender,
      to: [ownerEmail],
      subject: notification.subject,
      text: notification.text,
    }),
  });

  if (!response.ok) {
    const detail = await response.text();
    console.error("Unable to send WebVault owner notification:", detail);
  }
}
