/**
 * Notification categories: the grouping a user opts out of, and the template → category map.
 * Pure — safe to import from a client component (the settings form renders from `CATEGORY_META`).
 *
 * Storage is `profiles.notification_prefs`, a jsonb map of `{ [category]: false }` for opt-outs
 * (absent = opted in). `queueNotification` calls `emailEnabled()` before inserting an `email` row.
 */

export type NotificationCategory =
  | "order_updates"
  | "payments"
  | "referrals"
  | "license_reminders"
  | "compliance"
  | "admin";

/** `notifications.template` → the category it belongs to. */
export const TEMPLATE_CATEGORY: Record<string, NotificationCategory> = {
  order_status_changed: "order_updates",
  refund_issued: "payments",
  referral_reward_earned: "referrals",
  license_expiring: "license_reminders",
  license_expired: "compliance",
  revenue_cap_reached: "compliance",
  referral_reward_review: "admin",
  referral_reward_attach_failed: "admin",
  report_filed: "admin",
};

/**
 * Categories a user may switch off. `payments` and `compliance` are deliberately absent — a refund
 * and a storefront-pausing compliance event always email, regardless of prefs.
 */
export const SUPPRESSIBLE_CATEGORIES = [
  "order_updates",
  "referrals",
  "license_reminders",
  "admin",
] as const;

export type SuppressibleCategory = (typeof SUPPRESSIBLE_CATEGORIES)[number];

export function isSuppressible(category: NotificationCategory): category is SuppressibleCategory {
  return (SUPPRESSIBLE_CATEGORIES as readonly string[]).includes(category);
}

export interface CategoryMeta {
  label: string;
  description: string;
  /** Whose settings surface this belongs on. */
  audience: "buyer" | "seller" | "admin";
}

export const CATEGORY_META: Record<SuppressibleCategory, CategoryMeta> = {
  order_updates: {
    label: "Order updates",
    description:
      "When a seller moves an order you placed along — preparing, ready, out for delivery, completed.",
    audience: "buyer",
  },
  referrals: {
    label: "Referral rewards",
    description: "When you earn a free month from verified referrals.",
    audience: "seller",
  },
  license_reminders: {
    label: "License renewal reminders",
    description:
      "Heads-up emails 30, 7, and 1 day before a license expires. You're always emailed the day it expires.",
    audience: "seller",
  },
  admin: {
    label: "Admin queue alerts",
    description: "New order reports and referral-reward reviews that need triage.",
    audience: "admin",
  },
};

/** The stored shape on `profiles.notification_prefs`. Only opt-outs are recorded. */
export type NotificationPrefs = Partial<Record<NotificationCategory, boolean>>;

/**
 * Whether an `email` notification for `template` should go to a user with these prefs.
 * Unknown templates and non-suppressible categories always return true.
 */
export function emailEnabled(
  prefs: NotificationPrefs | null | undefined,
  template: string,
): boolean {
  const category = TEMPLATE_CATEGORY[template];
  if (!category || !isSuppressible(category)) return true;
  return prefs?.[category] !== false;
}
