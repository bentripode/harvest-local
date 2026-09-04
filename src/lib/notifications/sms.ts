import "server-only";

import { env } from "@/lib/env";

/**
 * Thin Twilio SMS wrapper — a direct call to the Messages REST endpoint, no SDK (same approach as
 * the Mapbox calls in `src/lib/geo/`). With any of `TWILIO_ACCOUNT_SID` / `TWILIO_AUTH_TOKEN` /
 * `TWILIO_FROM_NUMBER` unset it logs the message and reports success so the queue drains.
 *
 * Twilio has no idempotency key on Messages; `notification-dispatch`'s optimistic `attempt_count`
 * claim is what stops concurrent double-sends. A crash between the send and the `sent` write can
 * still re-text on retry — acceptable for the volume here.
 */

const configured = !!(
  env.TWILIO_ACCOUNT_SID &&
  env.TWILIO_AUTH_TOKEN &&
  env.TWILIO_FROM_NUMBER
);

export interface SendSmsInput {
  /** E.164, e.g. +15125550123. */
  to: string;
  body: string;
}

export async function sendSms({ to, body }: SendSmsInput): Promise<void> {
  if (!configured) {
    console.info(`[notifications] (no TWILIO_*) would SMS ${to}: ${body}`);
    return;
  }

  const url = `https://api.twilio.com/2010-04-01/Accounts/${env.TWILIO_ACCOUNT_SID}/Messages.json`;
  const auth = btoa(`${env.TWILIO_ACCOUNT_SID}:${env.TWILIO_AUTH_TOKEN}`);
  const form = new URLSearchParams({ To: to, From: env.TWILIO_FROM_NUMBER!, Body: body });

  let res: Response;
  try {
    res = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Basic ${auth}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: form,
      signal: AbortSignal.timeout(10_000),
    });
  } catch (err) {
    throw new Error(`twilio: ${err instanceof Error ? err.message : "request failed"}`);
  }

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`twilio ${res.status}: ${detail.slice(0, 200)}`);
  }
}
