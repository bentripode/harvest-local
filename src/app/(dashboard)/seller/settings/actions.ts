"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { requireRole, requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { addressSchema } from "@/lib/geo/address";
import { geocodeAddress } from "@/lib/geo/geocode";
import { parseWindows } from "@/lib/orders/delivery-windows";
import {
  SUPPRESSIBLE_CATEGORIES,
  type SuppressibleCategory,
  type NotificationPrefs,
} from "@/lib/notifications/categories";

export interface DeliverySettingsState {
  error?: string;
  ok?: boolean;
}

const schema = z
  .object({
    line1: addressSchema.shape.line1,
    line2: addressSchema.shape.line2,
    city: addressSchema.shape.city,
    state: addressSchema.shape.state,
    postal: addressSchema.shape.postal,
    deliveryEnabled: z.union([z.literal("on"), z.undefined()]).transform((v) => v === "on"),
    radiusMiles: z.coerce.number().min(1).max(100),
    baseFee: z.coerce.number().min(0).max(999),
    perMileFee: z.coerce.number().min(0).max(99),
  })
  .refine((v) => !v.deliveryEnabled || v.radiusMiles > 0, {
    message: "Set a delivery radius.",
    path: ["radiusMiles"],
  });

export async function saveDeliverySettingsAction(
  _prev: DeliverySettingsState,
  formData: FormData,
): Promise<DeliverySettingsState> {
  const { user } = await requireRole("seller");
  const supabase = await createClient();

  const { data: seller } = await supabase
    .from("seller_profiles")
    .select("id, home_state, pickup_address_id")
    .eq("profile_id", user.id)
    .maybeSingle();
  if (!seller) return { error: "Set up your storefront first." };

  const parsed = schema.safeParse({
    line1: formData.get("line1"),
    line2: formData.get("line2") ?? "",
    city: formData.get("city"),
    state: formData.get("state"),
    postal: formData.get("postal"),
    deliveryEnabled: formData.get("deliveryEnabled") ?? undefined,
    radiusMiles: formData.get("radiusMiles"),
    baseFee: formData.get("baseFee"),
    perMileFee: formData.get("perMileFee"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Check the form." };
  }
  const d = parsed.data;

  if (d.state !== seller.home_state) {
    return { error: `Your pickup address must be in ${seller.home_state}, your selling state.` };
  }

  const point = await geocodeAddress({
    line1: d.line1,
    line2: d.line2 || "",
    city: d.city,
    state: d.state,
    postal: d.postal,
  });
  if (!point) {
    return { error: "We couldn't locate that address. Check it and try again." };
  }

  const { data: addressId, error: addrError } = await supabase.rpc("upsert_address", {
    p_id: seller.pickup_address_id ?? undefined,
    p_label: "Pickup",
    p_line1: d.line1,
    p_line2: d.line2 || "",
    p_city: d.city,
    p_state: d.state,
    p_postal: d.postal,
    p_lng: point.lng,
    p_lat: point.lat,
  });
  if (addrError || !addressId) return { error: addrError?.message ?? "Could not save the address." };

  const { error } = await supabase
    .from("seller_profiles")
    .update({
      pickup_address_id: addressId,
      delivery_enabled: d.deliveryEnabled,
      delivery_radius_miles: d.radiusMiles,
      delivery_base_fee: Number(d.baseFee.toFixed(2)),
      delivery_per_mile_fee: Number(d.perMileFee.toFixed(2)),
      delivery_windows: parseWindows(String(formData.get("windows") ?? "")),
    })
    .eq("id", seller.id);
  if (error) return { error: error.message };

  revalidatePath("/seller/settings");
  return { ok: true };
}

export interface NotificationPrefsState {
  error?: string;
  ok?: boolean;
}

/**
 * Save per-category email opt-outs. The form submits a hidden `fields` list of the categories it
 * rendered (a checkbox is absent from FormData when unchecked, so we can't tell "off" from "not
 * shown" without it). Only the submitted categories are touched — a seller saving here never
 * clobbers a buyer-only category like `order_updates`.
 */
export async function saveNotificationPrefsAction(
  _prev: NotificationPrefsState,
  formData: FormData,
): Promise<NotificationPrefsState> {
  const { user, profile } = await requireUser();
  const supabase = await createClient();

  const submitted = String(formData.get("fields") ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter((c): c is SuppressibleCategory =>
      (SUPPRESSIBLE_CATEGORIES as readonly string[]).includes(c),
    );

  if (submitted.length === 0) return { error: "Nothing to save." };

  const current: NotificationPrefs = { ...(profile.notification_prefs ?? {}) };
  for (const category of submitted) {
    const on = formData.get(`email_${category}`) === "on";
    if (on) delete current[category];
    else current[category] = false;
  }

  const { error } = await supabase
    .from("profiles")
    .update({ notification_prefs: current })
    .eq("id", user.id);
  if (error) return { error: error.message };

  revalidatePath("/seller/settings");
  return { ok: true };
}
