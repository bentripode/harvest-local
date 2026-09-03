import { z } from "zod";

import { US_STATES } from "@/lib/geo/state";

/** A US street address, shared by the seller pickup-address form and buyer delivery checkout. */
export const addressSchema = z.object({
  line1: z.string().trim().min(3, "Street address is required.").max(200),
  line2: z.string().trim().max(120).optional().or(z.literal("")),
  city: z.string().trim().min(1, "City is required.").max(120),
  state: z.enum(US_STATES),
  postal: z
    .string()
    .trim()
    .regex(/^\d{5}(-\d{4})?$/, "Enter a 5-digit ZIP."),
});

export type AddressInput = z.infer<typeof addressSchema>;

/** Single-line rendering for order snapshots and display. */
export function formatAddress(a: AddressInput): string {
  const l2 = a.line2 ? ` ${a.line2}` : "";
  return `${a.line1}${l2}, ${a.city}, ${a.state} ${a.postal}`;
}

/** The one-line string Mapbox geocoding expects. */
export function geocodeQuery(a: AddressInput): string {
  return formatAddress(a) + ", USA";
}
