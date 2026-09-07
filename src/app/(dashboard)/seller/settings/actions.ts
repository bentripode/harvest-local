"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { getSellerContext, requireRole, requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { addressSchema } from "@/lib/geo/address";
import { geocodeAddress } from "@/lib/geo/geocode";
import { parseWindows } from "@/lib/orders/delivery-windows";
import { getDeliveryPermission } from "@/lib/compliance/delivery";
import type { ComplianceBlock } from "@/lib/compliance/blocks";
import {
  SUPPRESSIBLE_CATEGORIES,
  type SuppressibleCategory,
  type NotificationPrefs,
} from "@/lib/notifications/categories";

export interface DeliverySettingsState {
  error?: string;
  ok?: boolean;
  /** A refusal that came from a state rule, with the words behind it. */
  block?: ComplianceBlock;
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

  // A state that forbids the producer delivering the food is not a setting we let someone switch
  // on. Only an outright ban refuses — `unclear` is surfaced on the page instead, because a seller
  // must not be blocked by a question nobody has answered.
  if (d.deliveryEnabled) {
    const permission = await getDeliveryPermission(seller.id);
    if (permission.block) return { error: permission.block.message, block: permission.block };
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

export interface HomemadeStatementState {
  error?: string;
  ok?: boolean;
}

/**
 * Save the seller's own wording for a disclosure their state prescribes by substance.
 *
 * Deliberately not validated against the state's requirement beyond being non-empty: we cannot judge
 * whether a sentence "clearly indicates" what Louisiana wants or "informs" what Montana wants, and
 * pretending to would be worse than showing the seller the statute and trusting them with it.
 */
export async function saveHomemadeStatementAction(
  _prev: HomemadeStatementState,
  formData: FormData,
): Promise<HomemadeStatementState> {
  const { seller } = await getSellerContext();
  if (!seller) return { error: "Finish onboarding first." };

  const raw = String(formData.get("statement") ?? "").trim();
  if (raw.length > 500) return { error: "Keep it under 500 characters — it has to fit on a label." };

  const supabase = await createClient();
  const { error } = await supabase
    .from("seller_profiles")
    .update({ homemade_food_statement: raw || null })
    .eq("id", seller.id);
  if (error) return { error: error.message };

  revalidatePath("/seller/settings");
  revalidatePath("/seller/products");
  return { ok: true };
}

export interface MailingAddressState {
  error?: string;
  ok?: boolean;
}

/**
 * Save the producer's mailing address, where a state wants it on the label separately from the
 * address where the food is made (S.D. Codified Laws 34-18-37(3) and (4)).
 *
 * Plain text and unvalidated beyond length: it is printed verbatim on a label and never geocoded,
 * unlike the pickup address, so there is nothing here to check it against.
 */
export async function saveMailingAddressAction(
  _prev: MailingAddressState,
  formData: FormData,
): Promise<MailingAddressState> {
  const { seller } = await getSellerContext();
  if (!seller) return { error: "Finish onboarding first." };

  const raw = String(formData.get("mailingAddress") ?? "").trim();
  if (raw.length > 300) return { error: "Keep it under 300 characters — it has to fit on a label." };

  const supabase = await createClient();
  const { error } = await supabase
    .from("seller_profiles")
    .update({ mailing_address: raw || null })
    .eq("id", seller.id);
  if (error) return { error: error.message };

  revalidatePath("/seller/settings");
  revalidatePath("/seller/products");
  return { ok: true };
}

export interface ContactPhoneState {
  error?: string;
  ok?: boolean;
}

/**
 * Save the telephone number that goes on the label, where the state asks for one.
 *
 * Sixteen jurisdictions want a producer's phone number on the package, and Tenn. Code
 * 53-1-118(b)(4)(A) and (b)(5)(A)(iv) put it on the storefront listing as well. It is deliberately
 * NOT `profiles.phone` — that is the E.164 mobile number used for order-update texts under a
 * separate opt-in, and a seller may well want a business line printed on a jar instead.
 *
 * Printed verbatim, so the only check is length: "(615) 555-0134", "615-555-0134" and
 * "+1 615 555 0134" are all things a state accepts on a label, and normalising them would be us
 * rewriting what the seller chose to publish.
 */
export async function saveContactPhoneAction(
  _prev: ContactPhoneState,
  formData: FormData,
): Promise<ContactPhoneState> {
  const { seller } = await getSellerContext();
  if (!seller) return { error: "Finish onboarding first." };

  const raw = String(formData.get("contactPhone") ?? "").trim();
  if (raw.length > 40) return { error: "That is too long for a phone number." };

  const supabase = await createClient();
  const { error } = await supabase
    .from("seller_profiles")
    .update({ contact_phone: raw || null })
    .eq("id", seller.id);
  if (error) return { error: error.message };

  revalidatePath("/seller/settings");
  revalidatePath("/seller/products");
  return { ok: true };
}
