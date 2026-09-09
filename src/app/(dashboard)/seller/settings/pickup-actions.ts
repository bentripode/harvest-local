"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { geocodeAddress } from "@/lib/geo/geocode";
import { isUsState } from "@/lib/geo/state";
import { inngest } from "@/lib/inngest/client";

/**
 * Managing collection points.
 *
 * A location is either a booth at a market in the public directory, or an address of its own. The
 * market case stores no address at all — the market already has one, it is public, and duplicating
 * it would let the two drift.
 *
 * Everything here runs under the seller's own session: the "pickup locations: seller writes own"
 * policy is the gate, so a seller cannot touch another's rows even by guessing an id, and the
 * `pickup_locations_guard_market_state` trigger refuses an out-of-state market underneath that.
 */

export interface PickupLocationState {
  error?: string;
  ok?: boolean;
}

const slotSchema = z.object({
  dayOfWeek: z.coerce.number().int().min(0).max(6).nullable(),
  specificDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .nullable(),
  opens: z.string().regex(/^\d{2}:\d{2}$/),
  closes: z.string().regex(/^\d{2}:\d{2}$/),
  weeksOfMonth: z.array(z.coerce.number().int().min(1).max(5)).max(5),
});

const locationSchema = z
  .object({
    id: z.string().uuid().optional(),
    kind: z.enum(["market", "address"]),
    marketId: z.string().uuid().optional(),
    label: z.string().trim().min(1, "Give this place a name.").max(80),
    description: z.string().trim().max(400).optional(),
    line1: z.string().trim().max(120).optional(),
    line2: z.string().trim().max(120).optional(),
    city: z.string().trim().max(80).optional(),
    state: z.string().trim().length(2).optional(),
    postal: z.string().trim().max(12).optional(),
    prepHours: z.coerce.number().int().min(0).max(336),
    isActive: z.coerce.boolean(),
    slots: z.array(slotSchema).max(20),
  })
  .refine((v) => v.kind !== "market" || !!v.marketId, {
    message: "Choose which market.",
    path: ["marketId"],
  })
  .refine((v) => v.kind !== "address" || (!!v.line1 && !!v.city && !!v.state && !!v.postal), {
    message: "Enter the full address.",
    path: ["line1"],
  })
  .refine(
    (v) =>
      v.slots.every(
        (s) =>
          (s.dayOfWeek !== null && s.specificDate === null) ||
          (s.dayOfWeek === null && s.specificDate !== null),
      ),
    { message: "Each time is either a weekday or a one-off date.", path: ["slots"] },
  )
  .refine((v) => v.slots.every((s) => s.closes > s.opens), {
    message: "A pickup window has to end after it starts.",
    path: ["slots"],
  });

function parsePayload(formData: FormData) {
  const raw = formData.get("payload");
  if (typeof raw !== "string") return null;
  try {
    return JSON.parse(raw) as unknown;
  } catch {
    return null;
  }
}

export async function savePickupLocationAction(
  _prev: PickupLocationState,
  formData: FormData,
): Promise<PickupLocationState> {
  const { user } = await requireRole("seller");
  const supabase = await createClient();

  const { data: seller } = await supabase
    .from("seller_profiles")
    .select("id, home_state")
    .eq("profile_id", user.id)
    .maybeSingle();
  if (!seller) return { error: "Set up your storefront first." };

  const payload = parsePayload(formData);
  if (!payload) return { error: "Something went wrong reading the form." };

  const parsed = locationSchema.safeParse(payload);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Check the form." };
  const d = parsed.data;

  let addressId: string | null = null;
  let city: string | null = null;
  let postal: string | null = null;

  if (d.kind === "address") {
    if (d.state!.toUpperCase() !== seller.home_state) {
      return { error: `A pickup point has to be in ${seller.home_state}, your selling state.` };
    }

    // Already checked equal to the seller's own home_state above, which the schema types as a
    // US state code — so this narrows rather than asserts.
    const stateCode = seller.home_state;
    if (!isUsState(stateCode)) return { error: "Your selling state isn't set." };

    const point = await geocodeAddress({
      line1: d.line1!,
      line2: d.line2 || "",
      city: d.city!,
      state: stateCode,
      postal: d.postal!,
    });
    if (!point) return { error: "We couldn't locate that address. Check it and try again." };

    // Reuse the existing address row when editing, so a seller doesn't accumulate orphans.
    let existingAddressId: string | undefined;
    if (d.id) {
      const { data: row } = await supabase
        .from("pickup_locations")
        .select("address_id")
        .eq("id", d.id)
        .maybeSingle();
      existingAddressId = row?.address_id ?? undefined;
    }

    const { data: newId, error: addrError } = await supabase.rpc("upsert_address", {
      p_id: existingAddressId,
      p_label: d.label,
      p_line1: d.line1!,
      p_line2: d.line2 || "",
      p_city: d.city!,
      p_state: stateCode,
      p_postal: d.postal!,
      p_lng: point.lng,
      p_lat: point.lat,
    });
    if (addrError || !newId) return { error: addrError?.message ?? "Could not save the address." };

    addressId = newId as unknown as string;
    city = d.city!;
    postal = d.postal!;
  } else {
    // The market supplies the place; we copy only what a buyer is shown.
    const { data: market } = await supabase
      .from("markets")
      .select("city, postal_code")
      .eq("id", d.marketId!)
      .maybeSingle();
    city = market?.city ?? null;
    postal = market?.postal_code ?? null;
  }

  const row = {
    seller_id: seller.id,
    market_id: d.kind === "market" ? d.marketId! : null,
    address_id: addressId,
    label: d.label,
    description: d.description || null,
    city,
    postal_code: postal,
    prep_hours: d.prepHours,
    is_active: d.isActive,
  };

  const isNew = !d.id;
  let locationId = d.id ?? null;
  if (locationId) {
    const { error } = await supabase.from("pickup_locations").update(row).eq("id", locationId);
    if (error) return { error: friendly(error.message) };
  } else {
    const { data, error } = await supabase
      .from("pickup_locations")
      .insert(row)
      .select("id")
      .single();
    if (error || !data) return { error: friendly(error?.message ?? "Could not save.") };
    locationId = data.id;
  }

  // Slots are replaced wholesale: the form always submits the complete set, and reconciling
  // individual rows would let a deleted time survive a failed match.
  const { error: delError } = await supabase
    .from("pickup_slots")
    .delete()
    .eq("location_id", locationId);
  if (delError) return { error: delError.message };

  if (d.slots.length > 0) {
    const { error: slotError } = await supabase.from("pickup_slots").insert(
      d.slots.map((s) => ({
        location_id: locationId!,
        day_of_week: s.dayOfWeek,
        specific_date: s.specificDate,
        opens: s.opens,
        closes: s.closes,
        weeks_of_month: s.specificDate ? [] : s.weeksOfMonth,
      })),
    );
    if (slotError) return { error: slotError.message };
  }

  // A new booth at a market is news to everyone following it — and to the waitlist that has
  // been collecting addresses against exactly this promise since the market pages shipped.
  if (isNew && d.kind === "market" && d.isActive) {
    try {
      await inngest.send({
        name: "harvest/market.seller_joined",
        data: { marketId: d.marketId!, sellerId: seller.id },
      });
    } catch (err) {
      // Saving the booth must not depend on the event bus.
      console.error("[pickup] could not announce market join:", err);
    }
  }

  revalidatePath("/seller/settings");
  revalidatePath("/markets", "layout");
  return { ok: true };
}

export async function deletePickupLocationAction(
  _prev: PickupLocationState,
  formData: FormData,
): Promise<PickupLocationState> {
  const { user } = await requireRole("seller");
  const id = z.string().uuid().safeParse(formData.get("id"));
  if (!id.success) return { error: "Couldn't find that pickup point." };

  const supabase = await createClient();
  const { data: seller } = await supabase
    .from("seller_profiles")
    .select("id")
    .eq("profile_id", user.id)
    .maybeSingle();
  if (!seller) return { error: "Set up your storefront first." };

  // Scoped by seller as well as id — RLS would refuse anyway, but a silent no-op reads as success.
  const { error } = await supabase
    .from("pickup_locations")
    .delete()
    .eq("id", id.data)
    .eq("seller_id", seller.id);
  if (error) return { error: error.message };

  revalidatePath("/seller/settings");
  revalidatePath("/markets", "layout");
  return { ok: true };
}

/** Turn the two constraint violations a seller can actually cause into sentences. */
function friendly(message: string): string {
  if (/pickup_locations_seller_market_ux/.test(message)) {
    return "You already have a pickup point at that market.";
  }
  if (/own state/.test(message)) {
    return "That market is in another state. You can only sell where you're registered.";
  }
  return message;
}
