import Link from "next/link";

import { requireUser } from "@/lib/auth";
import { getConversations } from "@/lib/messages/queries";

export const metadata = { title: "Messages — Harvest Local" };

export default async function MessagesPage() {
  const { user } = await requireUser("/messages");
  const conversations = await getConversations(user.id);

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold tracking-tight">Messages</h1>

      {conversations.length === 0 ? (
        <p className="text-muted-foreground text-sm">
          No conversations yet. Message a seller from their storefront or an order.
        </p>
      ) : (
        <ul className="divide-y rounded-lg border">
          {conversations.map((c) => (
            <li key={c.id}>
              <Link
                href={`/messages/${c.id}`}
                className="hover:bg-muted/40 flex items-start gap-3 p-4"
              >
                <span
                  className={`mt-1.5 size-2 shrink-0 rounded-full ${c.unread > 0 ? "bg-primary" : "bg-transparent"}`}
                  aria-hidden
                />
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline justify-between gap-3">
                    <span className={`truncate text-sm ${c.unread > 0 ? "font-semibold" : "font-medium"}`}>
                      {c.otherName}
                      {c.orderRef ? (
                        <span className="text-muted-foreground font-normal"> · order {c.orderRef}</span>
                      ) : null}
                    </span>
                    {c.lastMessageAt ? (
                      <span className="text-muted-foreground shrink-0 text-xs">
                        {new Date(c.lastMessageAt).toLocaleDateString(undefined, { dateStyle: "medium" })}
                      </span>
                    ) : null}
                  </div>
                  {c.snippet ? (
                    <p className="text-muted-foreground truncate text-sm">{c.snippet}</p>
                  ) : null}
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
