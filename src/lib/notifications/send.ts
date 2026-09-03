import "server-only";

import { Resend } from "resend";

import { env } from "@/lib/env";

/**
 * Thin Resend wrapper. With no `RESEND_API_KEY` (local dev / CI) it logs the message and reports
 * success so the queue drains. `idempotencyKey` (the notification row id) lets Resend dedupe a
 * re-send after a mid-run crash.
 */

const resend = env.RESEND_API_KEY ? new Resend(env.RESEND_API_KEY) : null;
const FROM = env.EMAIL_FROM || "Harvest Local <onboarding@resend.dev>";

export interface SendEmailInput {
  to: string;
  subject: string;
  text: string;
  html: string;
  idempotencyKey: string;
}

export async function sendEmail(input: SendEmailInput): Promise<void> {
  if (!resend) {
    console.info(
      `[notifications] (no RESEND_API_KEY) would email ${input.to}: ${input.subject}\n${input.text}`,
    );
    return;
  }

  const { error } = await resend.emails.send(
    { from: FROM, to: input.to, subject: input.subject, text: input.text, html: input.html },
    { idempotencyKey: input.idempotencyKey },
  );
  if (error) {
    throw new Error(`resend: ${error.name} — ${error.message}`);
  }
}
