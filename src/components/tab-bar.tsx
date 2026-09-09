"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { LucideIcon } from "lucide-react";

/**
 * The bottom tab bar — the app's spine on a phone.
 *
 * Five slots, never six. The constraint is the feature: with twelve links in a scrolling strip
 * everything is equally reachable and nothing is prioritised, which is what the seller nav had
 * become. Forcing five makes somebody decide what this app is for, and pushes the rest one layer
 * down behind "More".
 *
 * Hidden from `md:` up, where the top nav takes over — a tab bar on a desktop browser is a phone
 * app cosplaying, and the horizontal room is already there.
 *
 * Two details that are easy to miss and awful to get wrong on a real handset:
 *
 *   - `pb-[env(safe-area-inset-bottom)]` keeps the row clear of the home indicator on an iPhone.
 *     Without it the last few pixels of every tab sit under a system gesture area.
 *   - The bar is `fixed`, so the page needs matching bottom padding or the final element of every
 *     scroll hides behind it. That padding lives on the layouts, next to where this is rendered.
 */

export interface Tab {
  /** Where the tab goes. Ignored when `onSelect` is set — that tab is a button, not a link. */
  href: string;
  label: string;
  icon: LucideIcon;
  /** A count to show on the tab — unread messages, basket items. Zero renders nothing. */
  badge?: number;
  /**
   * Match sub-routes as well. `/orders` should light up on `/orders/abc`, but `/` must not light
   * up on everything, so exact matching is the default.
   */
  matchNested?: boolean;
  /**
   * Makes this cell a button that runs this instead of navigating — the "More" door.
   *
   * It lives here rather than being an invisible `<button>` overlaid on the cell, which is what
   * this replaced: an overlay has to re-derive the bar's centred `max-w-lg` box to stay over the
   * right cell, and it announces a second control with the same name to a screen reader.
   */
  onSelect?: () => void;
  /** Highlight the tab even when the route doesn't match — a door is "open" for what's behind it. */
  forceActive?: boolean;
}

export function isActive(pathname: string, tab: Tab): boolean {
  if (tab.forceActive) return true;
  if (tab.matchNested) return pathname === tab.href || pathname.startsWith(`${tab.href}/`);
  return pathname === tab.href;
}

export function TabBar({ tabs }: { tabs: Tab[] }) {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Main"
      className="bg-background/95 supports-[backdrop-filter]:bg-background/80 fixed inset-x-0 bottom-0 z-40 border-t backdrop-blur-md md:hidden"
    >
      <ul className="mx-auto flex max-w-lg items-stretch pb-[env(safe-area-inset-bottom)]">
        {tabs.map((tab) => {
          const active = isActive(pathname, tab);
          const Icon = tab.icon;

          // 56px of height is the smallest a thumb target should be, and the whole cell is the
          // target rather than just the icon.
          const cell = `flex h-14 w-full flex-col items-center justify-center gap-1 text-[0.6875rem] transition-colors ${
            active ? "text-primary font-semibold" : "text-muted-foreground"
          }`;

          const inner = (
            <>
              <span className="relative">
                <Icon className="size-5" strokeWidth={active ? 2.4 : 1.8} aria-hidden />
                {tab.badge && tab.badge > 0 ? (
                  <span className="bg-accent text-accent-foreground absolute -top-1.5 -right-2 min-w-4 rounded-full px-1 text-[0.625rem] leading-4 font-semibold tabular-nums">
                    {tab.badge > 9 ? "9+" : tab.badge}
                  </span>
                ) : null}
              </span>
              {tab.label}
            </>
          );

          return (
            <li key={tab.label} className="flex-1">
              {tab.onSelect ? (
                <button type="button" onClick={tab.onSelect} className={cell}>
                  {inner}
                </button>
              ) : (
                <Link href={tab.href} aria-current={active ? "page" : undefined} className={cell}>
                  {inner}
                </Link>
              )}
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

/**
 * The spacer every page needs under a fixed tab bar.
 *
 * A sibling element rather than padding on `<main>`, so a page that wants an edge-to-edge section
 * (a map, a full-bleed photo) can still reach the bottom of the viewport and simply render this
 * after it.
 */
export function TabBarSpacer() {
  return <div aria-hidden className="h-14 pb-[env(safe-area-inset-bottom)] md:hidden" />;
}
