/**
 * Money is handled server-side only, in integer minor units (cents). No floating-point math.
 *
 * Postgres stores `numeric` (e.g. "12.50"); convert at the boundary with `toCents` / `formatUsd`.
 * The client only ever displays values the server computed.
 */

export type Cents = number & { readonly __brand: "Cents" };

export function cents(value: number): Cents {
  if (!Number.isInteger(value)) {
    throw new Error(`cents() expects an integer, got ${value}`);
  }
  return value as Cents;
}

/** Parse a decimal string/number of dollars (from Postgres numeric or a form) into cents. */
export function toCents(dollars: string | number): Cents {
  const n = typeof dollars === "string" ? Number(dollars) : dollars;
  if (!Number.isFinite(n) || n < 0) {
    throw new Error(`toCents() expects a non-negative number, got ${dollars}`);
  }
  return cents(Math.round(n * 100));
}

/** Cents back to a Postgres-friendly decimal string, e.g. 1250 -> "12.50". */
export function toDecimalString(value: Cents): string {
  return (value / 100).toFixed(2);
}

export function addCents(...values: Cents[]): Cents {
  return cents(values.reduce((sum, v) => sum + v, 0));
}

/** Percentage discount, rounded to the nearest cent, never exceeding the base. */
export function percentOff(base: Cents, percent: number): Cents {
  const off = Math.min(base, Math.round((base * percent) / 100));
  return cents(off);
}

const usd = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });

export function formatUsd(value: Cents | number): string {
  return usd.format(value / 100);
}
