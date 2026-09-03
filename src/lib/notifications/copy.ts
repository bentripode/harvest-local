/**
 * One-line notification copy, keyed by `notifications.template`. Shared by the in-app panel and the
 * email templates (`./templates.ts`) so wording lives in exactly one place. Pure — safe to import
 * from a client component.
 */

type Payload = Record<string, unknown>;

const s = (v: unknown, fallback = "") => (v == null ? fallback : String(v));
const label = (v: unknown) => s(v, "license").replace(/_/g, " ");
const usd = (v: unknown) => {
  const n = Number(v);
  return Number.isFinite(n) ? `$${n.toFixed(2)}` : s(v);
};

export const NOTIFICATION_COPY: Record<string, (p: Payload) => string> = {
  revenue_cap_reached: (p) =>
    `${s(p.business_name, "Your storefront")} reached ${s(p.state)}'s cottage-food sales cap (${usd(p.gross)} of ${usd(p.cap)}) — sales are paused for the rest of the year.`,
  license_expiring: (p) =>
    `Your ${label(p.license_type)} expires in ${s(p.days_left)} day${p.days_left === 1 ? "" : "s"} (${s(p.expiration_date)}). Renew it to avoid a pause.`,
  license_expired: (p) =>
    `Your ${label(p.license_type)} expired on ${s(p.expiration_date)}. Your storefront is paused until it's renewed and re-verified.`,
  referral_reward_earned: (p) =>
    `You hit ${s(p.threshold)} verified referrals this cycle — a free month is applied to your next invoice.`,
  referral_reward_review: (p) =>
    `A referral for seller ${s(p.seller_id).slice(0, 8)} was invalidated after a reward was granted (${label(p.reason)}) — review for possible abuse.`,
  referral_reward_attach_failed: (p) =>
    `A referral reward for order ${s(p.order_id).slice(0, 8)} was earned but the free-month coupon failed to attach — attach it manually. (${s(p.error)})`,
  report_filed: (p) =>
    `A ${label(p.reason)} report was filed on order ${s(p.order_id).slice(0, 8)} (${s(p.business_name)}) — triage it in the admin queue.`,
};

/** The one-line text for a template, or the raw template name if unknown. */
export function notificationText(template: string, payload: Payload): string {
  return NOTIFICATION_COPY[template]?.(payload) ?? template;
}
