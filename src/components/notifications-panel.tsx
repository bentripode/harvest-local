"use client";

import { useTransition } from "react";

import { Button } from "@/components/ui/button";
import { markNotificationsReadAction } from "@/app/(dashboard)/seller/compliance/actions";
import type { Notification } from "@/lib/db/types";

const TEMPLATE_COPY: Record<string, (p: Record<string, unknown>) => string> = {
  revenue_cap_reached: (p) =>
    `You reached ${p.state}'s cottage-food sales cap — your storefront is paused for the rest of the year.`,
  license_expiring: (p) =>
    `Your ${label(p.license_type)} expires in ${p.days_left} day${p.days_left === 1 ? "" : "s"} (${p.expiration_date}). Renew it to avoid a pause.`,
  license_expired: (p) =>
    `Your ${label(p.license_type)} expired on ${p.expiration_date}. Your storefront is paused until it's renewed and re-verified.`,
  referral_reward_earned: (p) =>
    `You hit ${p.threshold} verified referrals this cycle — a free month is applied to your next invoice.`,
  referral_reward_review: (p) =>
    `A referral for seller ${String(p.seller_id ?? "").slice(0, 8)} was invalidated after a reward was granted — review for possible abuse.`,
};

function label(t: unknown): string {
  return String(t ?? "license").replace(/_/g, " ");
}

export function NotificationsPanel({ notifications }: { notifications: Notification[] }) {
  const [pending, start] = useTransition();
  const hasUnread = notifications.some((n) => !n.read_at);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-medium">Notifications</h2>
        {hasUnread ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={pending}
            onClick={() => start(() => markNotificationsReadAction())}
          >
            Mark all read
          </Button>
        ) : null}
      </div>

      {notifications.length === 0 ? (
        <p className="text-muted-foreground text-sm">Nothing yet.</p>
      ) : (
        <ul className="divide-y rounded-lg border">
          {notifications.map((n) => {
            const payload = (n.payload ?? {}) as Record<string, unknown>;
            const text = TEMPLATE_COPY[n.template]?.(payload) ?? n.template;
            return (
              <li
                key={n.id}
                className={`flex gap-3 p-3 text-sm ${n.read_at ? "text-muted-foreground" : ""}`}
              >
                <span
                  className={`mt-1.5 size-2 shrink-0 rounded-full ${n.read_at ? "bg-transparent" : "bg-primary"}`}
                  aria-hidden
                />
                <div className="flex-1">
                  <p>{text}</p>
                  <time dateTime={n.created_at} className="text-muted-foreground text-xs">
                    {new Date(n.created_at).toLocaleString(undefined, {
                      dateStyle: "medium",
                      timeStyle: "short",
                    })}
                  </time>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
