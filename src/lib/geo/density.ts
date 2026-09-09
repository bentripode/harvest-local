import { formatDistance, type NearbySeller } from "@/lib/geo/nearby-format";

/**
 * What to say when a state is thin — pure, so `/shop` and the map agree about it.
 *
 * ===========================================================================
 * THE FAILURE THIS EXISTS TO FIX IS A PAGE THAT STILL "WORKS"
 * ===========================================================================
 * `/shop` sorts by distance. In a dense state that is exactly right. In a thin one the nearest
 * storefront is 84 miles away, the page ranks it first, and "84 mi" reads as a result rather than as
 * the answer "not really". Nothing errors, nothing is empty, and the buyer is quietly misled about
 * whether this marketplace is any use to them. A marketplace with three sellers should say it has
 * three sellers.
 *
 * ===========================================================================
 * DISTANCE IS NOT REACH
 * ===========================================================================
 * A seller 40 miles away who delivers within 50 can get bread to your door. One 12 miles away who
 * only trades from a market stall on Saturdays may never be any use to you. So the bands are about
 * **reachability**, not proximity: delivery radius is checked against the actual distance, and a
 * seller who has said they will drive that far is treated as reachable however far away they live.
 *
 * Widening never crosses a state line. The obvious way to fill an empty page is to show the sellers
 * over the border, and that is precisely the thing CLAUDE.md rule 1 forbids at the discovery layer —
 * every one of them would be a dead end that we had advertised. Degrading gracefully here means
 * being straight about the state you are in, not quietly leaving it.
 */

/** Comfortably a local errand. */
export const LOCAL_MILES = 25;
/** A deliberate trip, but a real one. Past this, pickup stops being a plan. */
export const REGIONAL_MILES = 75;

export type Reach =
  /** Close enough to collect from without thinking about it. */
  | "local"
  /** A drive, but doable. */
  | "regional"
  /** Too far to collect from — but they deliver to you. */
  | "delivers"
  /** In your state, not within reach of you. */
  | "distant"
  /** We have no origin, so no claim is made either way. */
  | "unknown";

export interface ReachableSeller extends NearbySeller {
  reach: Reach;
}

/**
 * Whether this seller will bring it to you.
 *
 * A seller with delivery on and no radius recorded is NOT assumed to reach you: `delivery_enabled`
 * without `delivery_radius_miles` means they have not said how far, and inventing a number would
 * put a buyer through checkout to be refused by `quoteDelivery`, which does know.
 */
export function deliversTo(seller: NearbySeller, distanceMiles: number | null): boolean {
  if (!seller.deliveryEnabled || seller.deliveryRadiusMiles == null) return false;
  if (distanceMiles == null) return false;
  return distanceMiles <= seller.deliveryRadiusMiles;
}

export function classify(seller: NearbySeller): Reach {
  const miles = seller.distanceMiles;
  if (miles == null) return "unknown";
  if (miles <= LOCAL_MILES) return "local";
  if (deliversTo(seller, miles)) return "delivers";
  if (miles <= REGIONAL_MILES) return "regional";
  return "distant";
}

export interface DensityView {
  /** Everything that can realistically reach this buyer, nearest first. */
  reachable: ReachableSeller[];
  /** In the state, out of reach. Shown separately and under their own heading, never ranked in. */
  distant: ReachableSeller[];
  /** True when we had no origin to measure from — the page is just a state listing. */
  unmeasured: boolean;
  /** One honest sentence for the top of the page. */
  headline: string;
  /** A second line, where there is something useful to add. */
  detail: string | null;
}

/**
 * Split a state's sellers into what is useful to this buyer and what is merely true.
 *
 * `distant` is kept rather than dropped. A buyer deciding whether to come back next month is better
 * served by "there are four here, all a long way from you" than by a page that looks empty — and a
 * seller who has just opened deserves to appear somewhere. It is a separate list under its own
 * heading so it can never be mistaken for a result.
 */
export function describeDensity(sellers: NearbySeller[], stateName: string): DensityView {
  const classified: ReachableSeller[] = sellers.map((s) => ({ ...s, reach: classify(s) }));

  const unmeasured = classified.length > 0 && classified.every((s) => s.reach === "unknown");
  if (unmeasured) {
    return {
      reachable: classified,
      distant: [],
      unmeasured: true,
      headline: countSentence(classified.length, stateName),
      detail:
        classified.length > 0
          ? "Add a ZIP code to see which of them are near you and which deliver."
          : null,
    };
  }

  const reachable = classified.filter((s) => s.reach !== "distant");
  const distant = classified.filter((s) => s.reach === "distant");

  if (classified.length === 0) {
    return {
      reachable: [],
      distant: [],
      unmeasured: false,
      headline: `No sellers in ${stateName} yet.`,
      detail: null,
    };
  }

  if (reachable.length === 0) {
    // The case this module exists for: everything is technically listed and none of it is any use.
    const nearest = distant[0];
    const where = nearest?.locationLabel ? ` — the nearest is in ${nearest.locationLabel}` : "";
    return {
      reachable: [],
      distant,
      unmeasured: false,
      headline: `Nobody within ${REGIONAL_MILES} miles of you.`,
      detail:
        `${countSentence(distant.length, stateName)}${where}, ` +
        `${formatDistance(nearest?.distanceMiles ?? null) ?? "a long way"} away.`,
    };
  }

  const local = reachable.filter((s) => s.reach === "local").length;
  const delivering = reachable.filter((s) => s.reach === "delivers").length;

  return {
    reachable,
    distant,
    unmeasured: false,
    headline:
      local > 0
        ? `${local} ${local === 1 ? "seller" : "sellers"} within ${LOCAL_MILES} miles.`
        : `${reachable.length} ${reachable.length === 1 ? "seller" : "sellers"} within reach.`,
    detail: buildDetail(reachable.length - local, delivering, distant.length, stateName),
  };
}

function buildDetail(
  beyondLocal: number,
  delivering: number,
  distant: number,
  stateName: string,
): string | null {
  const parts: string[] = [];
  if (beyondLocal > 0) parts.push(`${beyondLocal} more a bit further out`);
  if (delivering > 0) {
    parts.push(`${delivering} of them ${delivering === 1 ? "delivers" : "deliver"} to you`);
  }
  if (distant > 0) parts.push(`${distant} elsewhere in ${stateName}`);

  if (parts.length === 0) return null;
  return `${parts.join(", ").replace(/, ([^,]*)$/, " and $1")}.`;
}

function countSentence(n: number, stateName: string): string {
  if (n === 0) return `No sellers in ${stateName} yet.`;
  return `${n} ${n === 1 ? "seller" : "sellers"} in ${stateName}.`;
}
