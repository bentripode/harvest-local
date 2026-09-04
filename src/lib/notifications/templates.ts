import "server-only";

import { env } from "@/lib/env";
import { notificationText } from "@/lib/notifications/copy";

/**
 * Email rendering for a `notifications` row. `subject` + `html` + `text` (plain-text fallback).
 * Body copy comes from `./copy.ts`; this file only adds the subject line, a CTA, and the layout.
 */

export interface RenderedEmail {
  subject: string;
  text: string;
  html: string;
}

type Payload = Record<string, unknown>;

interface TemplateMeta {
  subject: (p: Payload) => string;
  /** Path on the site the CTA button links to — a string, or a fn of the payload for a deep link. */
  ctaPath: string | ((p: Payload) => string);
  ctaLabel: string;
}

const TEMPLATES: Record<string, TemplateMeta> = {
  revenue_cap_reached: {
    subject: (p) => `Your ${String(p.state ?? "state")} sales cap has been reached`,
    ctaPath: "/seller/compliance",
    ctaLabel: "View compliance",
  },
  license_expiring: {
    subject: (p) => `Your ${String(p.license_type ?? "license").replace(/_/g, " ")} expires soon`,
    ctaPath: "/seller/compliance",
    ctaLabel: "Renew license",
  },
  license_expired: {
    subject: (p) => `Your ${String(p.license_type ?? "license").replace(/_/g, " ")} has expired`,
    ctaPath: "/seller/compliance",
    ctaLabel: "Renew license",
  },
  referral_reward_earned: {
    subject: () => "You earned a free month 🎉",
    ctaPath: "/seller/referrals",
    ctaLabel: "View referrals",
  },
  referral_reward_review: {
    subject: () => "Referral reward — review needed",
    ctaPath: "/seller",
    ctaLabel: "Open dashboard",
  },
  referral_reward_attach_failed: {
    subject: () => "Referral reward — coupon attach failed",
    ctaPath: "/seller",
    ctaLabel: "Open dashboard",
  },
  report_filed: {
    subject: () => "New order report",
    ctaPath: "/admin",
    ctaLabel: "Open admin queue",
  },
  refund_issued: {
    subject: () => "Your order was refunded",
    ctaPath: "/orders",
    ctaLabel: "View orders",
  },
  order_status_changed: {
    subject: (p) => {
      switch (String(p.status)) {
        case "ready":
          return "Your order is ready";
        case "out_for_delivery":
          return "Your order is out for delivery";
        case "completed":
          return "Your order is complete";
        case "cancelled":
          return "Your order was cancelled";
        default:
          return "An update on your order";
      }
    },
    ctaPath: (p) => `/orders/${String(p.order_id ?? "")}`,
    ctaLabel: "View order",
  },
};

/** Returns null for an unknown template (the dispatcher fails the row rather than sending junk). */
export function renderEmail(template: string, payload: Payload): RenderedEmail | null {
  const meta = TEMPLATES[template];
  if (!meta) return null;

  const text = notificationText(template, payload);
  const ctaPath = typeof meta.ctaPath === "function" ? meta.ctaPath(payload) : meta.ctaPath;
  const cta = `${env.NEXT_PUBLIC_SITE_URL}${ctaPath}`;

  return {
    subject: meta.subject(payload),
    text: `${text}\n\n${meta.ctaLabel}: ${cta}`,
    html: layout(text, cta, meta.ctaLabel),
  };
}

function esc(s: string): string {
  return s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);
}

function layout(body: string, ctaHref: string, ctaLabel: string): string {
  return `<!doctype html>
<html>
<body style="margin:0;padding:24px;background:#f6f6f4;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#1a1a1a">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;margin:0 auto;background:#fff;border:1px solid #e6e6e3;border-radius:12px">
    <tr><td style="padding:28px 28px 8px;font-weight:600;font-size:15px">Harvest Local</td></tr>
    <tr><td style="padding:8px 28px 20px;font-size:14px;line-height:1.55">${esc(body)}</td></tr>
    <tr><td style="padding:0 28px 28px">
      <a href="${esc(ctaHref)}" style="display:inline-block;background:#1a1a1a;color:#fff;text-decoration:none;padding:9px 16px;border-radius:8px;font-size:13px">${esc(ctaLabel)}</a>
    </td></tr>
  </table>
</body>
</html>`;
}
