"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { requireRole, getSellerContext } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

/**
 * A seller's own appearances.
 *
 * Writes run under the seller's session — "events: seller writes own" is the gate — and `state` is
 * never accepted from the form: the `events_set_state` trigger derives it from the storefront, so it
 * cannot drift and a market in another state is refused rather than silently mislabelled.
 *
 * Times are wall clock at the venue (`<input type="time">` gives exactly that), so there is no
 * conversion anywhere in this file. That is the whole point of the column types.
 */

export interface EventFormState {
  error?: string;
  ok?: boolean;
}

const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;

const schema = z
  .object({
    id: z.string().uuid().optional().or(z.literal("")),
    title: z.string().trim().min(1, "Give the event a name.").max(120),
    description: z.string().trim().max(2000).optional(),
    marketId: z.string().uuid().optional().or(z.literal("")),
    locationText: z.string().trim().max(200).optional(),
    eventDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Pick a date."),
    startsAt: z.string().regex(TIME).optional().or(z.literal("")),
    endsAt: z.string().regex(TIME).optional().or(z.literal("")),
  })
  .refine((v) => v.marketId || v.locationText, {
    message: "Say where it is — pick a market, or write the address.",
    path: ["locationText"],
  })
  .refine((v) => !v.endsAt || !!v.startsAt, {
    message: "An end time needs a start time.",
    path: ["startsAt"],
  })
  .refine((v) => !v.startsAt || !v.endsAt || v.endsAt > v.startsAt, {
    message: "It has to end after it starts.",
    path: ["endsAt"],
  });

function read(formData: FormData) {
  return {
    id: formData.get("id") ?? "",
    title: formData.get("title"),
    description: formData.get("description") ?? undefined,
    marketId: formData.get("marketId") ?? "",
    locationText: formData.get("locationText") ?? undefined,
    eventDate: formData.get("eventDate"),
    startsAt: formData.get("startsAt") ?? "",
    endsAt: formData.get("endsAt") ?? "",
  };
}

export async function saveEventAction(
  _prev: EventFormState,
  formData: FormData,
): Promise<EventFormState> {
  await requireRole("seller");
  const { seller } = await getSellerContext();
  if (!seller) return { error: "Finish setting up your storefront first." };

  const parsed = schema.safeParse(read(formData));
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Check the event details." };
  }
  const v = parsed.data;

  const row = {
    seller_id: seller.id,
    market_id: v.marketId || null,
    title: v.title,
    description: v.description || null,
    location_text: v.locationText || null,
    event_date: v.eventDate,
    starts_at: v.startsAt || null,
    ends_at: v.endsAt || null,
    // Supplied only because the column is NOT NULL with no default. `events_set_state` overwrites
    // it from the storefront on every insert and update, so this value is never the authority —
    // a tampered form field cannot put an event in another state.
    state: seller.home_state,
  };

  const supabase = await createClient();
  const { error } = v.id
    ? await supabase.from("events").update(row).eq("id", v.id).eq("seller_id", seller.id)
    : await supabase.from("events").insert(row);

  if (error) return { error: friendly(error.message) };

  revalidatePath("/seller/events");
  revalidatePath(`/s/${seller.storefront_slug}`);
  return { ok: true };
}

const statusSchema = z.object({
  id: z.string().uuid(),
  status: z.enum(["published", "hidden", "cancelled"]),
  cancelledNote: z.string().trim().max(300).optional(),
});

/**
 * Publish, hide or call off an event.
 *
 * Cancelling asks for a reason and keeps the row: the event stays on the calendar until its date
 * passes, marked off. Someone rearranged their Saturday around it, and deleting the row tells them
 * nothing at all.
 */
export async function setEventStatusAction(
  _prev: EventFormState,
  formData: FormData,
): Promise<EventFormState> {
  await requireRole("seller");
  const { seller } = await getSellerContext();
  if (!seller) return { error: "Finish setting up your storefront first." };

  const parsed = statusSchema.safeParse({
    id: formData.get("id"),
    status: formData.get("status"),
    cancelledNote: formData.get("cancelledNote") ?? undefined,
  });
  if (!parsed.success) return { error: "Something went wrong reading the form." };

  const supabase = await createClient();
  const { error } = await supabase
    .from("events")
    .update({
      status: parsed.data.status,
      cancelled_note: parsed.data.status === "cancelled" ? parsed.data.cancelledNote || null : null,
    })
    .eq("id", parsed.data.id)
    .eq("seller_id", seller.id);

  if (error) return { error: friendly(error.message) };

  revalidatePath("/seller/events");
  revalidatePath(`/s/${seller.storefront_slug}`);
  return { ok: true };
}

export async function deleteEventAction(
  _prev: EventFormState,
  formData: FormData,
): Promise<EventFormState> {
  await requireRole("seller");
  const { seller } = await getSellerContext();
  if (!seller) return { error: "Finish setting up your storefront first." };

  const id = z.string().uuid().safeParse(formData.get("id"));
  if (!id.success) return { error: "Something went wrong reading the form." };

  const supabase = await createClient();
  const { error } = await supabase
    .from("events")
    .delete()
    .eq("id", id.data)
    .eq("seller_id", seller.id);

  if (error) return { error: friendly(error.message) };

  revalidatePath("/seller/events");
  revalidatePath(`/s/${seller.storefront_slug}`);
  return { ok: true };
}

function friendly(message: string): string {
  if (/own state/.test(message)) {
    return "That market is in another state. You can only list events in the state your storefront sells in.";
  }
  if (/events_venue/.test(message)) return "Say where it is — pick a market, or write the address.";
  if (/events_span/.test(message)) return "It has to end after it starts.";
  if (/events_end_needs_start/.test(message)) return "An end time needs a start time.";
  return "We couldn't save that event.";
}
