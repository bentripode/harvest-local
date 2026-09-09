/**
 * Domain types layered over the generated `database.types.ts`.
 *
 * `database.types.ts` is regenerated verbatim from the live schema (`npm run db:types`) and only
 * carries the raw `Database` shape plus Supabase's generic helpers. Everything the app imports by a
 * friendly name lives here so a regen never wipes it. Import `Database` and all row aliases from
 * THIS module, not from `database.types` directly.
 *
 * Deliberate corrections to the generator's output:
 *  1. Money columns accept a decimal *string* on writes as well as a number, because
 *     `toDecimalString` produces one and Postgres takes it (see `src/lib/money.ts`). Reads are left
 *     as the generator has them — `numeric` comes back as a NUMBER, which this file used to claim
 *     it did not; see the note on `MoneyFixed`.
 *  2. jsonb columns are given their real shape instead of `Json` — `products.images`,
 *     `products.ingredients`, `profiles.notification_prefs`, `seller_profiles.delivery_windows`.
 *  3. function returns that are genuinely nullable — the generator emits every `Returns` as
 *     non-nullable (`sync_seller_license_pause`).
 */
import type { Database as Generated } from "./database.types";
import type { NotificationPrefs } from "@/lib/notifications/categories";

export type { Json } from "./database.types";

/** One entry in `products.images`. */
export interface ProductImage {
  path: string;
  url: string;
  alt?: string;
}

type GenTables = Generated["public"]["Tables"];

/** `number` (or `number | null`, etc.) → `number | string`, preserving null via distribution. */
type NumOrStr<T> = T extends number ? number | string : T;

/**
 * Money columns accept a decimal STRING on writes, and come back as a NUMBER on reads.
 *
 * This used to rewrite Row as well, on the stated grounds that "Postgres `numeric` crosses the wire
 * as text". **It does not, against this PostgREST.** Verified across every money column on the live
 * project — `orders.total`, `order_items.unit_price`, `refunds.amount`, `products.price`,
 * `state_food_programs.revenue_cap`, all of them — and each one arrives as a JS number.
 *
 * Nothing broke while the declaration was wrong, because every money read in the app goes through
 * `toCents`, which takes `string | number`. But the type was a lie, and code trusting it (a string
 * method on a total, a `.length`, a `===` against a decimal string) would have compiled and then
 * failed at runtime. Reads are now typed as what actually arrives.
 *
 * Writes are a genuine union: `toDecimalString` produces `"12.50"` and Postgres accepts a string
 * for a numeric column, which is how money keeps its exactness on the way in (`src/lib/money.ts`).
 * So Insert and Update widen to `number | string` rather than narrowing to one of them.
 *
 * Pinned by an assertion in `test/integration/payouts.test.ts`, so a future change in the wire
 * format is reported rather than quietly making this right again by accident.
 */
type MoneyFixed<
  T extends { Row: object; Insert: object; Update: object; Relationships: unknown },
  K extends string,
> = {
  Row: T["Row"];
  Insert: { [P in keyof T["Insert"]]: P extends K ? NumOrStr<T["Insert"][P]> : T["Insert"][P] };
  Update: { [P in keyof T["Update"]]: P extends K ? NumOrStr<T["Update"][P]> : T["Update"][P] };
  Relationships: T["Relationships"];
};

/**
 * `notification_prefs` — the generator emits `Json`; this pins its real shape (correction 3, same
 * class as `products.images`). Survives a `db:types` regen because it lives here.
 */
type ProfilesFixed = {
  Row: Omit<GenTables["profiles"]["Row"], "notification_prefs"> & {
    notification_prefs: NotificationPrefs;
  };
  Insert: Omit<GenTables["profiles"]["Insert"], "notification_prefs"> & {
    notification_prefs?: NotificationPrefs;
  };
  Update: Omit<GenTables["profiles"]["Update"], "notification_prefs"> & {
    notification_prefs?: NotificationPrefs;
  };
  Relationships: GenTables["profiles"]["Relationships"];
};

/** `delivery_windows` — the generator emits `Json`; these are always window-label strings. */
type SellerProfilesFixed = {
  Row: Omit<GenTables["seller_profiles"]["Row"], "delivery_windows"> & {
    delivery_windows: string[];
  };
  Insert: Omit<GenTables["seller_profiles"]["Insert"], "delivery_windows"> & {
    delivery_windows?: string[];
  };
  Update: Omit<GenTables["seller_profiles"]["Update"], "delivery_windows"> & {
    delivery_windows?: string[];
  };
  Relationships: GenTables["seller_profiles"]["Relationships"];
};

type ProductsFixed = {
  // `price` and `net_weight_value` are NOT corrected on the way out: numeric arrives as a JS
  // number (see the note on MoneyFixed). Only the jsonb columns need a real shape.
  Row: Omit<GenTables["products"]["Row"], "images" | "ingredients"> & {
    images: ProductImage[];
    ingredients: string[];
  };
  Insert: Omit<
    GenTables["products"]["Insert"],
    "price" | "images" | "ingredients" | "net_weight_value"
  > & {
    price: number | string;
    images?: ProductImage[];
    ingredients?: string[];
    net_weight_value?: number | string | null;
  };
  Update: Omit<
    GenTables["products"]["Update"],
    "price" | "images" | "ingredients" | "net_weight_value"
  > & {
    price?: number | string;
    images?: ProductImage[];
    ingredients?: string[];
    net_weight_value?: number | string | null;
  };
  Relationships: GenTables["products"]["Relationships"];
};

type OrderMoneyKeys =
  | "subtotal"
  | "discount_total"
  | "delivery_fee"
  | "tax_total"
  | "total"
  | "delivery_distance_miles";

/**
 * `sync_seller_license_pause` returns the seller's resulting `pause_reason`, which is **null when
 * the storefront is live** — the generator types every function return as non-nullable, so this is
 * correction 4, the same class as the numeric and jsonb fixes above. A regen won't reintroduce it.
 */
type FunctionsFixed = Omit<Generated["public"]["Functions"], "sync_seller_license_pause"> & {
  sync_seller_license_pause: { Args: { p_seller_id: string }; Returns: string | null };
};

/** `Generated`, with the corrections described in the file header applied. */
export type Database = Omit<Generated, "public"> & {
  public: Omit<Generated["public"], "Tables" | "Functions"> & {
    Functions: FunctionsFixed;
    Tables: Omit<
      GenTables,
      | "profiles"
      | "seller_profiles"
      | "products"
      | "product_variants"
      | "orders"
      | "order_items"
      | "state_cottage_food_rules"
      | "state_food_programs"
      | "seller_revenue_tracking"
      | "seller_revenue_buckets"
      | "referrals"
      | "refunds"
      | "payouts"
    > & {
      profiles: ProfilesFixed;
      seller_profiles: SellerProfilesFixed;
      products: ProductsFixed;
      // `price` is numeric, and a variant carries the same net_weight_value the product does.
      product_variants: MoneyFixed<
        GenTables["product_variants"],
        "price" | "net_weight_value"
      >;
      orders: MoneyFixed<GenTables["orders"], OrderMoneyKeys>;
      order_items: MoneyFixed<GenTables["order_items"], "unit_price" | "line_total">;
      state_cottage_food_rules: MoneyFixed<GenTables["state_cottage_food_rules"], "revenue_cap">;
      state_food_programs: MoneyFixed<
        GenTables["state_food_programs"],
        "revenue_cap" | "license_threshold"
      >;
      seller_revenue_tracking: MoneyFixed<
        GenTables["seller_revenue_tracking"],
        "gross_revenue" | "cap_amount"
      >;
      seller_revenue_buckets: MoneyFixed<
        GenTables["seller_revenue_buckets"],
        "gross_revenue" | "cap_amount"
      >;
      referrals: MoneyFixed<GenTables["referrals"], "discount_amount">;
      refunds: MoneyFixed<GenTables["refunds"], "amount">;
      payouts: MoneyFixed<GenTables["payouts"], "amount">;
    };
  };
};

type Row<T extends keyof Database["public"]["Tables"]> =
  Database["public"]["Tables"][T]["Row"];

export type Profile = Row<"profiles">;
export type SellerProfile = Row<"seller_profiles">;
export type Subscription = Row<"subscriptions">;
export type Category = Row<"categories">;
export type Tag = Row<"tags">;
export type Product = Row<"products">;
export type Order = Row<"orders">;
export type OrderItem = Row<"order_items">;
export type OrderStatusHistory = Row<"order_status_history">;
export type Notification = Row<"notifications">;
export type SellerLicense = Row<"seller_licenses">;
export type StateCottageFoodRule = Row<"state_cottage_food_rules">;
export type SellerRevenueTracking = Row<"seller_revenue_tracking">;
export type PromoCode = Row<"promo_codes">;
export type Referral = Row<"referrals">;
export type ReferralCycle = Row<"referral_cycles">;
export type Review = Row<"reviews">;
export type Conversation = Row<"conversations">;
export type Message = Row<"messages">;
export type Report = Row<"reports">;
export type Refund = Row<"refunds">;
export type ProductDrop = Row<"product_drops">;
export type Payout = Row<"payouts">;

export type ReferralStatus = "pending" | "active" | "invalidated";

export type Role = Profile["role"];
export type ProductStatus = Product["status"];
export type SubscriptionStatus = Subscription["status"];
export type NotificationChannel = Notification["channel"];
export type LicenseType = SellerLicense["license_type"];
export type LicenseStatus = SellerLicense["verification_status"];
export type PauseReason =
  | "onboarding_incomplete"
  | "license_unverified"
  | "revenue_cap"
  // The seller's own "closed for now". Unlike the others it hides nothing: a storefront paused for
  // a holiday stays readable (20260908280000).
  | "vacation"
  | "license_expired"
  | "admin";

export type OrderStatus =
  | "pending_payment"
  | "new"
  | "preparing"
  | "ready"
  | "out_for_delivery"
  | "completed"
  | "cancelled"
  | "disputed";

export type FulfillmentType = "pickup" | "delivery";
