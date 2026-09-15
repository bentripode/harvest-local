"use server";

import { cookies, headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { getUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { US_STATES } from "@/lib/geo/state";
import {
  BROWSE_POINT_COOKIE,
  BROWSE_STATE_COOKIE,
  COOKIE_OPTIONS,
  encodeOrigin,
} from "@/lib/geo/browse-state";
import { geocodePostalCode } from "@/lib/geo/geocode";
import { RATE_LIMITS, tryRateLimit } from "@/lib/rate-limit";

export interface StateFormState {
  error?: string;
}

/**
 * Set the state whose sellers you are browsing.
 *
 * Deliberately open to signed-out visitors — discovery is public, and the cookie this writes is
 * only ever read to decide what to *display* (`getBrowseState`). For a signed-in buyer it also
 * writes `profiles.home_state`, because that column is the one checkout actually enforces
 * against; keeping both in step means the shelf a buyer browses and the sellers they may order
 * from are the same set.
 */
export async function setBrowseStateAction(
  _prev: StateFormState,
  formData: FormData,
): Promise<StateFormState> {
  const parsed = z.enum(US_STATES).safeParse(formData.get("state"));
  if (!parsed.success) return { error: "Choose your state." };
  const state = parsed.data;

  const user = await getUser();
  if (user) {
    const supabase = await createClient();
    const { error } = await supabase
      .from("profiles")
      .update({ home_state: state })
      .eq("id", user.id);
    if (error) return { error: error.message };
  }

  (await cookies()).set(BROWSE_STATE_COOKIE, state, COOKIE_OPTIONS);

  revalidatePath("/shop");
  revalidatePath("/checkout");
  return {};
}

export interface OriginState {
  error?: string;
  ok?: boolean;
}

const originSchema = z.union([
  z.object({
    kind: z.literal("zip"),
    zip: z.string().trim().regex(/^\d{5}$/, "Enter a 5-digit ZIP code."),
  }),
  z.object({
    kind: z.literal("point"),
    lng: z.coerce.number().min(-180).max(-64),
    lat: z.coerce.number().min(15).max(72),
  }),
]);

/**
 * Set where to measure distances from.
 *
 * Two ways in, and only one of them costs anything: the browser's own geolocation arrives as a
 * point and is written straight to the cookie, while a typed ZIP has to be geocoded. Both are
 * presentational — this never widens who a buyer may order from, which is decided by state at
 * checkout.
 *
 * Rate-limited on the ZIP path because it is an unauthenticated call into a metered API.
 */
export async function setBrowseOriginAction(
  _prev: OriginState,
  formData: FormData,
): Promise<OriginState> {
  const parsed = originSchema.safeParse({
    kind: formData.get("kind"),
    zip: formData.get("zip"),
    lng: formData.get("lng"),
    lat: formData.get("lat"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "We couldn't use that location." };
  }

  const jar = await cookies();

  if (parsed.data.kind === "point") {
    jar.set(
      BROWSE_POINT_COOKIE,
      encodeOrigin(parsed.data.lng, parsed.data.lat, "your location"),
      COOKIE_OPTIONS,
    );
    revalidatePath("/shop");
    return { ok: true };
  }

  const limited = await tryRateLimit(await originRateKey(), RATE_LIMITS.geocode, "search");
  if (limited) return { error: limited };

  const point = await geocodePostalCode(parsed.data.zip);
  if (!point) return { error: "We couldn't find that ZIP code." };

  jar.set(BROWSE_POINT_COOKIE, encodeOrigin(point.lng, point.lat, parsed.data.zip), COOKIE_OPTIONS);
  revalidatePath("/shop");
  return { ok: true };
}

/** Clear it — back to whatever the connection suggests, or to no distances at all. */
export async function clearBrowseOriginAction(): Promise<void> {
  (await cookies()).delete(BROWSE_POINT_COOKIE);
  revalidatePath("/shop");
}

/** Per-user where there is one, per-IP otherwise: this path is open to guests. */
async function originRateKey(): Promise<string> {
  const user = await getUser();
  if (user) return `geocode:user:${user.id}`;
  const h = await headers();
  const ip = h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip")?.trim();
  return `geocode:ip:${ip || "unknown"}`;
}
