"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";
import { CalendarDays, ClipboardList, LayoutGrid, MoreHorizontal, Package } from "lucide-react";

import { Button } from "@/components/ui/button";
import { TabBar, isActive, type Tab } from "@/components/tab-bar";

/**
 * The seller dashboard's chrome.
 *
 * This is the surface the redesign exists for. The nav had grown to twelve links in a
 * horizontally-scrolling strip — Overview, Launch, Products, Orders, Batches, Events, Your story,
 * Updates, QR codes, Payouts, Referrals, Compliance, Settings — where everything was equally
 * reachable and therefore nothing was prioritised. On a phone it was a smear of text that scrolled
 * sideways under your thumb.
 *
 * Five tabs, and the fifth is a door. What earns a tab is what a seller touches on an ordinary day:
 * their listings, their orders, and what they have committed to make or attend. Everything that is
 * done once a month or once ever — payouts, referrals, compliance, their story, QR codes, settings
 * — lives behind "More". That is not a demotion, it is an admission about frequency.
 */

interface MoreLink {
  href: string;
  label: string;
  hint: string;
}

/**
 * What sits behind the door, in groups.
 *
 * A flat list of ten was a wall of equal-weight rows you read top to bottom every time. The groups
 * are by the QUESTION you came in with — someone asking "has the money arrived" is not browsing
 * past "Your story" to find out — rather than by how often each is used, which the tabs already
 * express.
 *
 * Messages is first and ungrouped: it is the only thing here where somebody is waiting on a reply.
 */
const MORE_GROUPS: { title: string | null; links: MoreLink[] }[] = [
  {
    title: null,
    links: [{ href: "/messages", label: "Messages", hint: "Your conversations with buyers" }],
  },
  {
    title: "Selling",
    links: [
      { href: "/seller/launch", label: "Launch", hint: "What to do next, and what to send" },
      { href: "/seller/events", label: "Events", hint: "Market days, pop-ups and open days" },
      { href: "/seller/story", label: "Your story", hint: "The long version, for your storefront" },
      {
        href: "/seller/questions",
        label: "Updates & questions",
        hint: "Posts, and what buyers asked",
      },
      { href: "/seller/qr", label: "QR codes", hint: "For your stall and your jars" },
    ],
  },
  {
    title: "Money",
    links: [
      { href: "/seller/payouts", label: "Payouts", hint: "What Stripe has sent your bank" },
      {
        href: "/seller/referrals",
        label: "Referrals",
        hint: "Your code, and progress to a free month",
      },
    ],
  },
  {
    title: "Your account",
    links: [
      { href: "/seller/compliance", label: "Compliance", hint: "Licences, caps and notices" },
      { href: "/seller/settings", label: "Settings", hint: "Pickup, delivery and notifications" },
    ],
  },
];

const MORE_LINKS: MoreLink[] = MORE_GROUPS.flatMap((g) => g.links);

export function SellerShell({
  unread = 0,
  unreadMessages = 0,
  isAdmin = false,
}: {
  unread?: number;
  unreadMessages?: number;
  isAdmin?: boolean;
}) {
  const pathname = usePathname();
  const dialog = useRef<HTMLDialogElement>(null);

  // Any navigation closes the sheet. Without this, tapping a link leaves it open behind the new
  // page and the next back-gesture dismisses the sheet instead of navigating, which feels broken.
  useEffect(() => {
    dialog.current?.close();
  }, [pathname]);

  const groups = isAdmin
    ? [
        ...MORE_GROUPS,
        {
          title: "Admin",
          links: [
            { href: "/admin", label: "Admin", hint: "Reports, licences and platform settings" },
          ],
        },
      ]
    : MORE_GROUPS;
  const moreLinks = groups.flatMap((g) => g.links);

  const onMoreRoute = moreLinks.some(
    (l) => pathname === l.href || pathname.startsWith(`${l.href}/`),
  );

  const tabs: Tab[] = [
    { href: "/seller", label: "Home", icon: LayoutGrid },
    {
      href: "/seller/products",
      label: "Listings",
      icon: Package,
      matchNested: true,
    },
    {
      href: "/seller/orders",
      label: "Orders",
      icon: ClipboardList,
      matchNested: true,
    },
    {
      href: "/seller/drops",
      label: "Batches",
      icon: CalendarDays,
      matchNested: true,
    },
  ];

  return (
    <>
      <header className="bg-background/95 supports-[backdrop-filter]:bg-background/80 sticky top-0 z-30 border-b backdrop-blur-md">
        <div className="mx-auto flex h-14 w-full max-w-5xl items-center justify-between gap-4 px-4 sm:px-6">
          <Link href="/" className="font-heading shrink-0 text-lg font-semibold tracking-tight">
            Harvest Local
          </Link>

          {/* Desktop keeps everything visible — the room is there and a seller at a laptop is
              usually doing the once-a-month things. */}
          <nav className="text-muted-foreground hidden items-center gap-5 text-sm md:flex">
            {tabs.map((t) => {
              const active = isActive(pathname, t);
              return (
                <Link
                  key={t.href}
                  href={t.href}
                  aria-current={active ? "page" : undefined}
                  className={active ? "text-foreground font-medium" : "hover:text-foreground"}
                >
                  {t.label}
                </Link>
              );
            })}
            <button
              type="button"
              onClick={() => dialog.current?.showModal()}
              className={`hover:text-foreground cursor-pointer ${
                onMoreRoute ? "text-foreground font-medium" : ""
              }`}
            >
              More
              {unread + unreadMessages > 0 ? (
                <span className="bg-accent text-accent-foreground ml-1.5 rounded-full px-1.5 text-xs font-semibold tabular-nums">
                  {unread + unreadMessages}
                </span>
              ) : null}
            </button>
          </nav>

          <div className="flex shrink-0 items-center gap-2">
            <Button asChild variant="ghost" size="sm">
              <Link href="/shop">Shop</Link>
            </Button>
            <form action="/auth/signout" method="post" className="hidden md:block">
              <Button variant="outline" size="sm" type="submit">
                Sign out
              </Button>
            </form>
          </div>
        </div>
      </header>

      <TabBar
        tabs={[
          ...tabs,
          // The fifth slot is the door, not a page: it opens the sheet rather than navigating, and
          // lights up whenever the current route lives behind it.
          {
            href: "#more",
            label: "More",
            icon: MoreHorizontal,
            badge: unread + unreadMessages,
            onSelect: () => dialog.current?.showModal(),
            forceActive: onMoreRoute,
          },
        ]}
      />

      <dialog
        ref={dialog}
        onClick={(e) => {
          if (e.target === dialog.current) dialog.current?.close();
        }}
        className="bg-background text-foreground m-0 mt-auto w-full max-w-none rounded-t-3xl border-t p-0 shadow-lg backdrop:bg-black/50 md:m-auto md:max-w-md md:rounded-2xl md:border"
      >
        <div className="max-h-[75vh] overflow-y-auto p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))]">
          <div className="bg-border mx-auto mb-4 h-1 w-10 rounded-full md:hidden" aria-hidden />
          <h2 className="font-heading mb-3 text-lg font-semibold">More</h2>
          {groups.map((group, i) => (
            <div key={group.title ?? "top"} className={i > 0 ? "pt-4" : undefined}>
              {group.title ? (
                <p className="text-muted-foreground pb-1 text-xs font-medium">{group.title}</p>
              ) : null}
              <ul className="divide-y">
                {group.links.map((l) => (
                  <li key={l.href}>
                    <Link href={l.href} className="flex flex-col gap-0.5 py-3 no-underline">
                      <span className="font-medium">
                        {l.label}
                        {badgeFor(l.href, unread, unreadMessages) > 0 ? (
                          <span className="bg-accent text-accent-foreground ml-2 rounded-full px-1.5 text-xs font-semibold tabular-nums">
                            {badgeFor(l.href, unread, unreadMessages)}
                          </span>
                        ) : null}
                      </span>
                      <span className="text-muted-foreground text-sm">{l.hint}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
          <form action="/auth/signout" method="post" className="mt-4">
            <Button variant="outline" className="w-full" type="submit">
              Sign out
            </Button>
          </form>
          <Button
            type="button"
            variant="ghost"
            className="mt-2 w-full"
            onClick={() => dialog.current?.close()}
          >
            Close
          </Button>
        </div>
      </dialog>
    </>
  );
}

/** Which count, if any, belongs on a given link. */
function badgeFor(href: string, unread: number, unreadMessages: number): number {
  if (href === "/seller/compliance") return unread;
  if (href === "/messages") return unreadMessages;
  return 0;
}

export { MORE_LINKS, MORE_GROUPS };
