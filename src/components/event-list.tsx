"use client";

import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import {
  formatEventDateShort,
  formatEventTime,
  groupByDay,
  localToday,
  upcomingEvents,
  type EventLike,
} from "@/lib/events/schedule";

/**
 * A calendar of what's on.
 *
 * A client component for one reason: "Today" and "Tomorrow" are the two labels a reader actually
 * uses, and both are wrong if worked out on a server running UTC — at 8pm Pacific it already thinks
 * it is tomorrow. So the reader's own clock decides, here.
 *
 * The server hands over a deliberately generous window (see `events/queries.ts`) and this does the
 * real filtering, which means a stale day never renders even though it was fetched.
 */

export interface ListedEvent extends EventLike {
  description: string | null;
  locationText: string | null;
  sellerName: string;
  sellerSlug: string;
  market: { id: string; name: string; slug: string; state: string; city: string | null } | null;
}

export function EventList({
  events,
  /** Hide the seller's name where the list is already on their storefront. */
  showSeller = true,
  /** Hide the venue where the list is already on that market's page. */
  showVenue = true,
  emptyText = "Nothing listed yet.",
}: {
  events: ListedEvent[];
  showSeller?: boolean;
  showVenue?: boolean;
  emptyText?: string;
}) {
  const today = localToday();
  const groups = groupByDay(events, today);

  if (groups.length === 0) {
    return <p className="text-muted-foreground text-sm">{emptyText}</p>;
  }

  return (
    <div className="space-y-5">
      {groups.map((group) => (
        <section key={group.date} className="space-y-2">
          <h3 className="text-sm font-medium">{group.label}</h3>
          <ul className="divide-y rounded-lg border">
            {group.events.map((e) => {
              const time = formatEventTime(e);
              const cancelled = e.status === "cancelled";
              return (
                <li key={e.id} className="space-y-1 p-3">
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <p className={`font-medium ${cancelled ? "line-through" : ""}`}>{e.title}</p>
                    {cancelled ? <Badge variant="outline">Cancelled</Badge> : null}
                  </div>

                  <p className="text-muted-foreground text-sm">
                    {time ? <span>{time}</span> : null}
                    {time && (showVenue || showSeller) ? " · " : null}
                    {showVenue ? (
                      e.market ? (
                        <Link
                          href={`/markets/${e.market.state.toLowerCase()}/${e.market.slug}`}
                          className="hover:underline"
                        >
                          {e.market.name}
                        </Link>
                      ) : (
                        e.locationText
                      )
                    ) : null}
                    {showVenue && showSeller ? " · " : null}
                    {showSeller ? (
                      <Link href={`/s/${e.sellerSlug}`} className="hover:underline">
                        {e.sellerName}
                      </Link>
                    ) : null}
                  </p>

                  {/* The reason comes first when it's off — that's the news. */}
                  {cancelled && e.cancelledNote ? (
                    <p className="text-sm">{e.cancelledNote}</p>
                  ) : e.description ? (
                    <p className="text-muted-foreground text-sm">{e.description}</p>
                  ) : null}
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </div>
  );
}

/** A compact "where to find us" strip — the next few, one line each. */
export function EventStrip({ events, limit = 3 }: { events: ListedEvent[]; limit?: number }) {
  const today = localToday();
  const next = upcomingEvents(events, today, limit);
  if (next.length === 0) return null;

  return (
    <ul className="space-y-1 text-sm">
      {next.map((e) => {
        const time = formatEventTime(e);
        return (
          <li key={e.id} className={e.status === "cancelled" ? "text-muted-foreground" : ""}>
            <span className="font-medium">
              {e.eventDate === today ? "Today" : formatEventDateShort(e.eventDate)}
            </span>
            {time ? `, ${time}` : ""} ·{" "}
            {e.market ? (
              <Link
                href={`/markets/${e.market.state.toLowerCase()}/${e.market.slug}`}
                className="hover:underline"
              >
                {e.market.name}
              </Link>
            ) : (
              e.locationText
            )}
            {e.status === "cancelled" ? " — cancelled" : ""}
          </li>
        );
      })}
    </ul>
  );
}
