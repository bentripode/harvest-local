"use client";

import { useTransition } from "react";

import { Button } from "@/components/ui/button";
import { markNotificationsReadAction } from "@/app/(dashboard)/seller/compliance/actions";
import { notificationText } from "@/lib/notifications/copy";
import type { Notification } from "@/lib/db/types";

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
            const text = notificationText(n.template, payload);
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
