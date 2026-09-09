/**
 * What a new seller should do next, derived from what they have actually done.
 *
 * ===========================================================================
 * EVERY STEP IS OBSERVED, NOT SELF-REPORTED
 * ===========================================================================
 * There are no checkboxes here and no table behind it. A step is done because the thing itself is
 * true — a listing exists, a collection point exists, somebody has looked at the storefront — and it
 * is undone because it isn't. That rules out the two failure modes a launch checklist usually has:
 * ticking something you never did, and being nagged about something you finished a month ago.
 *
 * It also rules out one step this feature obviously "wants": *tell your friends*. We cannot see it,
 * so it is not a step. What we can see is whether anyone has looked at the storefront, which is the
 * same question asked honestly — and the templates page is where the help for it lives.
 *
 * Order matters. The list is a path, not a scoreboard: nothing below the storefront gate is worth
 * doing until the gate opens, and a seller reading top-down should hit the thing that is actually
 * blocking them first.
 */

export type StepState = "done" | "todo" | "blocked";

export interface LaunchStep {
  id: string;
  title: string;
  /** Why it matters, in the seller's terms. One sentence. */
  why: string;
  state: StepState;
  /** Where to go and do it. Null when there is nothing to click — a blocked step waits on us. */
  href: string | null;
  /** Shown when the step is blocked or has a caveat. */
  note?: string;
}

export interface LaunchFacts {
  /** Storefront visible to buyers — the gate everything else waits on. */
  isLive: boolean;
  /** Why not, where it isn't. `pause_reason`, or null when it is live. */
  pauseReason: string | null;
  /** True when this seller lists anything in a food category. */
  sellsFood: boolean;
  hasProgramChoice: boolean;
  activeListings: number;
  draftListings: number;
  /** Listings whose state-required label fields are incomplete. */
  listingsWithGaps: number;
  hasPickupLocation: boolean;
  hasStory: boolean;
  hasUpcomingEvent: boolean;
  hasPromoCode: boolean;
  storefrontViews: number;
  completedOrders: number;
  reviewCount: number;
}

export function launchSteps(f: LaunchFacts): LaunchStep[] {
  const steps: LaunchStep[] = [];

  // 1. The gate. Nothing below matters until this is open, and the reason it is shut is the single
  // most useful thing on the page.
  steps.push({
    id: "live",
    title: "Get your storefront open",
    why: "Until this is done nobody can see your listings, however many you add.",
    state: f.isLive ? "done" : "todo",
    href: f.isLive ? null : "/seller/compliance",
    note: f.isLive ? undefined : PAUSE_NOTE[f.pauseReason ?? ""] ?? PAUSE_NOTE.default,
  });

  // 2. Programme choice, but only for a seller who actually lists food.
  if (f.sellsFood) {
    steps.push({
      id: "programme",
      title: "Choose your cottage food programme",
      why: "It decides what you're allowed to make and what has to go on the label — and a food listing can't go live without it.",
      state: f.hasProgramChoice ? "done" : "todo",
      href: "/seller/onboarding/program",
    });
  }

  steps.push({
    id: "listing",
    title: "Put up your first listing",
    why: "One is enough to open with. It's easier to add the second once something has sold.",
    state: f.activeListings > 0 ? "done" : "todo",
    href: "/seller/products/new",
    note:
      f.activeListings === 0 && f.draftListings > 0
        ? `You have ${f.draftListings} saved as a draft — publishing ${f.draftListings === 1 ? "it" : "one"} is the last step.`
        : undefined,
  });

  if (f.listingsWithGaps > 0) {
    steps.push({
      id: "labels",
      title: "Finish your label details",
      why: "Your state requires some of this before a buyer pays, so a listing without it can't go live.",
      state: "todo",
      href: "/seller/products",
      note: `${f.listingsWithGaps} listing${f.listingsWithGaps === 1 ? "" : "s"} still missing something.`,
    });
  }

  steps.push({
    id: "pickup",
    title: "Say where buyers collect",
    why: "Buyers see the town before they order and the exact address once they've paid.",
    state: f.hasPickupLocation ? "done" : "todo",
    href: "/seller/settings",
  });

  steps.push({
    id: "story",
    title: "Write your story",
    why: "On a local marketplace people are choosing a person as much as a product.",
    state: f.hasStory ? "done" : "todo",
    href: "/seller/story",
  });

  // 3. Getting looked at. Deliberately phrased as an observation rather than a task, because the
  // task — telling people — is one we cannot see and should not pretend to track.
  steps.push({
    id: "seen",
    title: "Get your first visitors",
    why: "Nothing sells before anyone has looked. The templates below are the awkward part written for you.",
    state: f.storefrontViews > 0 ? "done" : "todo",
    href: "/seller/qr",
    note:
      f.storefrontViews > 0
        ? `${f.storefrontViews} ${f.storefrontViews === 1 ? "person has" : "people have"} looked at your storefront.`
        : "Nobody has looked yet — that's normal on day one.",
  });

  steps.push({
    id: "order",
    title: "Take your first order",
    why: "The first one is the hard one.",
    state: f.completedOrders > 0 ? "done" : "todo",
    href: "/seller/orders",
  });

  // 4. Everything past the first sale. Shown, because they are the next things worth doing, but
  // they sit below the line and none of them is urgent.
  steps.push({
    id: "review",
    title: "Ask your first buyer for a review",
    why: "It's the first thing the next buyer looks at, and only a real buyer can leave one.",
    state: f.reviewCount > 0 ? "done" : f.completedOrders > 0 ? "todo" : "blocked",
    href: f.completedOrders > 0 ? "/seller/orders" : null,
    note: f.completedOrders > 0 ? undefined : "Once you've completed an order.",
  });

  steps.push({
    id: "event",
    title: "Add a market day",
    why: "It puts you on that market's page and on the state calendar, where people are already looking.",
    state: f.hasUpcomingEvent ? "done" : "todo",
    href: "/seller/events",
  });

  steps.push({
    id: "referral",
    title: "Make a referral code",
    why: "Three buyers using it in a billing cycle earns you a free month.",
    state: f.hasPromoCode ? "done" : "todo",
    href: "/seller/referrals",
  });

  return steps;
}

const PAUSE_NOTE: Record<string, string> = {
  license_unverified: "We're waiting on a document, or one hasn't been verified yet.",
  license_expired: "One of your documents has expired.",
  onboarding_incomplete: "Your Stripe details or subscription aren't finished.",
  revenue_cap: "You've reached your state's sales cap for the year.",
  vacation: "You've closed your storefront yourself — reopen it whenever you're ready.",
  admin: "Closed by us. Check your messages.",
  default: "Finish the setup steps and this opens on its own.",
};

/** How far along, for a progress line. Blocked steps don't count against them. */
export function launchProgress(steps: LaunchStep[]): { done: number; total: number } {
  const countable = steps.filter((s) => s.state !== "blocked");
  return { done: countable.filter((s) => s.state === "done").length, total: countable.length };
}

/**
 * The one thing to do next: the first step that isn't done and isn't waiting on something else.
 *
 * Null once everything actionable is done, and the page says so rather than inventing another task —
 * a checklist that never finishes is a checklist people stop reading.
 */
export function nextStep(steps: LaunchStep[]): LaunchStep | null {
  return steps.find((s) => s.state === "todo") ?? null;
}
