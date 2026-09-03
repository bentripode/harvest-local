import { z } from "zod";

/**
 * Promo code rules, shared by the seller create form and the server action. Codes are stored and
 * compared UPPERCASE; the DB has `check (code ~ '^[A-Z0-9]{4,20}$')` and `unique (upper(code))`.
 */

export const RESERVED_CODES = new Set([
  "HARVEST",
  "HARVESTLOCAL",
  "ADMIN",
  "SUPPORT",
  "HELP",
  "FREE",
  "TEST",
  "NULL",
  "NONE",
  "REFUND",
  "STRIPE",
  "COUPON",
  "PROMO",
]);

export function normalizeCode(input: string): string {
  return input.trim().toUpperCase();
}

export const promoCodeSchema = z
  .string()
  .transform(normalizeCode)
  .pipe(
    z
      .string()
      .regex(/^[A-Z0-9]{4,20}$/, "4–20 letters and numbers only.")
      .refine((c) => !RESERVED_CODES.has(c), "That code is reserved — pick another."),
  );
