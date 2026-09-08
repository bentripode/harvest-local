import "server-only";

import { cookies, headers } from "next/headers";

import { getProfile } from "@/lib/auth";
import { isUsState } from "@/lib/geo/state";

/**
 * Which state's sellers to *show* someone who is browsing.
 *
 * This is a discovery hint and nothing else. Order authorization stays exactly where it was:
 * `profiles.home_state` re-checked server-side in `startCheckoutAction`, the frozen
 * `orders.buyer_state` / `seller_state` snapshots, and the `orders_same_state_only` CHECK
 * (CLAUDE.md rule 1). A cookie or an IP guess must never widen who a buyer may transact with —
 * anonymous browsing exists so the marketplace is reachable and indexable, not so an order can be
 * placed without an account.
 *
 * Resolution order, most authoritative first:
 *
 *   profile — the signed-in buyer's own recorded state. This is the column checkout enforces
 *             against, so when it exists nothing else may override it.
 *   chosen  — a state picked from the state picker, kept in a cookie. Survives sign-out.
 *   geo     — the edge's IP geolocation. A guess, and the UI always says so.
 */

export const BROWSE_STATE_COOKIE = "hl_browse_state";

/** Long enough that a returning buyer isn't asked again; short enough to lapse if they move. */
const COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 180;

export type BrowseStateSource = "profile" | "chosen" | "geo";

export interface BrowseState {
  /** Two-letter state code, or null when we have nothing to go on yet. */
  state: string | null;
  /** Where it came from. `geo` is a guess and screens should offer to correct it. */
  source: BrowseStateSource | null;
}

export const COOKIE_OPTIONS = {
  httpOnly: false,
  sameSite: "lax",
  path: "/",
  maxAge: COOKIE_MAX_AGE_SECONDS,
} as const;

/**
 * Vercel's edge geolocation headers. `x-vercel-ip-country-region` is the two-letter code for US
 * visitors. Absent everywhere else (local dev, other hosts), which resolves to "no guess".
 */
async function stateFromRequestGeo(): Promise<string | null> {
  const h = await headers();
  const country = h.get("x-vercel-ip-country");
  if (country && country.toUpperCase() !== "US") return null;

  const region = h.get("x-vercel-ip-country-region")?.toUpperCase();
  return region && isUsState(region) ? region : null;
}

export async function getBrowseState(): Promise<BrowseState> {
  const profile = await getProfile();
  if (profile?.home_state && isUsState(profile.home_state)) {
    return { state: profile.home_state, source: "profile" };
  }

  const chosen = (await cookies()).get(BROWSE_STATE_COOKIE)?.value?.toUpperCase();
  if (chosen && isUsState(chosen)) return { state: chosen, source: "chosen" };

  const geo = await stateFromRequestGeo();
  if (geo) return { state: geo, source: "geo" };

  return { state: null, source: null };
}
