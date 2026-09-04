"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { addressSchema } from "@/lib/geo/address";
import { geocodeAddress } from "@/lib/geo/geocode";
import type { NotificationPrefs } from "@/lib/notifications/categories";

export interface AddressActionState {
  error?: string;
  ok?: boolean;
}

const MAX_ADDRESSES = 12;

const addSchema = addressSchema.extend({
  label: z.string().trim().max(40).optional().or(z.literal("")),
});

export async function addAddressAction(
  _prev: AddressActionState,
  formData: FormData,
): Promise<AddressActionState> {
  const { user } = await requireUser("/account");

  const parsed = addSchema.safeParse({
    label: formData.get("label") ?? "",
    line1: formData.get("line1"),
    line2: formData.get("line2") ?? "",
    city: formData.get("city"),
    state: formData.get("state"),
    postal: formData.get("postal"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Check the address." };
  }
  const d = parsed.data;

  const supabase = await createClient();

  const { count } = await supabase
    .from("addresses")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user.id);
  if ((count ?? 0) >= MAX_ADDRESSES) {
    return { error: `You can save up to ${MAX_ADDRESSES} addresses. Remove one first.` };
  }

  const point = await geocodeAddress({
    line1: d.line1,
    line2: d.line2 || "",
    city: d.city,
    state: d.state,
    postal: d.postal,
  });
  if (!point) {
    return { error: "We couldn't verify that address. Check it and try again." };
  }

  const { error } = await supabase.rpc("upsert_address", {
    p_id: undefined,
    p_label: d.label || "Address",
    p_line1: d.line1,
    p_line2: d.line2 || "",
    p_city: d.city,
    p_state: d.state,
    p_postal: d.postal,
    p_lng: point.lng,
    p_lat: point.lat,
  });
  if (error) return { error: error.message };

  revalidatePath("/account");
  return { ok: true };
}

export async function deleteAddressAction(formData: FormData): Promise<void> {
  const { user } = await requireUser("/account");
  const id = z.string().uuid().safeParse(formData.get("id"));
  if (!id.success) return;

  const supabase = await createClient();
  await supabase.from("addresses").delete().eq("id", id.data).eq("user_id", user.id);

  revalidatePath("/account");
}

export interface SmsPrefsState {
  error?: string;
  ok?: boolean;
}

/** Normalise a US number to E.164 (+1XXXXXXXXXX), or null when blank. */
function normalizeUsPhone(raw: string): string | null | undefined {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const digits = trimmed.replace(/\D/g, "");
  const ten = digits.length === 11 && digits.startsWith("1") ? digits.slice(1) : digits;
  if (ten.length !== 10) return undefined; // invalid
  return `+1${ten}`;
}

/**
 * Save the buyer's mobile number and their opt-in for order-update texts
 * (`notification_prefs["sms:order_updates"]`). Opt-in requires a number on file.
 */
export async function saveSmsPrefsAction(
  _prev: SmsPrefsState,
  formData: FormData,
): Promise<SmsPrefsState> {
  const { user } = await requireUser("/account");

  const phone = normalizeUsPhone(String(formData.get("phone") ?? ""));
  if (phone === undefined) return { error: "Enter a 10-digit US mobile number." };

  const wantsOrderTexts = formData.get("sms_order_updates") === "on";
  if (wantsOrderTexts && !phone) return { error: "Add a mobile number to get text updates." };

  const supabase = await createClient();
  const { data: current } = await supabase
    .from("profiles")
    .select("notification_prefs")
    .eq("id", user.id)
    .single();

  const prefs: NotificationPrefs = { ...(current?.notification_prefs ?? {}) };
  if (wantsOrderTexts) prefs["sms:order_updates"] = true;
  else delete prefs["sms:order_updates"];

  const { error } = await supabase
    .from("profiles")
    .update({ phone, notification_prefs: prefs })
    .eq("id", user.id);
  if (error) return { error: error.message };

  revalidatePath("/account");
  return { ok: true };
}
