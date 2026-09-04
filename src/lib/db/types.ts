/**
 * Domain types layered over the generated `database.types.ts`.
 *
 * `database.types.ts` is regenerated verbatim from the live schema (`npm run db:types`) and only
 * carries the raw `Database` shape plus Supabase's generic helpers. Everything the app imports by a
 * friendly name lives here so a regen never wipes it. Import `Database` and all row aliases from
 * THIS module, not from `database.types` directly.
 *
 * Two deliberate corrections to the generator's output:
 *  1. Postgres `numeric` crosses the wire as a *string*, but the generator types it `number`.
 *     Every money column is corrected back to `string` so money stays exact end to end
 *     (see `src/lib/money.ts`).
 *  2. `products.images` (jsonb) is given its real element shape instead of `Json`.
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

/** `number` (or `number | null`, etc.) → `string`, preserving null/undefined via distribution. */
type NumToStr<T> = T extends number ? string : T;

/**
 * Rewrite the listed money keys of a table's Row/Insert/Update from `number` to `string`
 * (Postgres `numeric` crosses the wire as text). Homomorphic mapping keeps `?` optionality.
 */
type MoneyFixed<
  T extends { Row: object; Insert: object; Update: object; Relationships: unknown },
  K extends string,
> = {
  Row: { [P in keyof T["Row"]]: P extends K ? NumToStr<T["Row"][P]> : T["Row"][P] };
  Insert: { [P in keyof T["Insert"]]: P extends K ? NumToStr<T["Insert"][P]> : T["Insert"][P] };
  Update: { [P in keyof T["Update"]]: P extends K ? NumToStr<T["Update"][P]> : T["Update"][P] };
  Relationships: T["Relationships"];
};

/**
 * `notification_prefs` (jsonb) given its real shape. Manually declared until `npm run db:types` is
 * re-run against a DB with the 20260904000000_notification_prefs migration applied — the generator
 * will then emit it as `Json` and this override keeps the precise type.
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

type ProductsFixed = {
  Row: Omit<GenTables["products"]["Row"], "price" | "images"> & {
    price: string;
    images: ProductImage[];
  };
  Insert: Omit<GenTables["products"]["Insert"], "price" | "images"> & {
    price: string;
    images?: ProductImage[];
  };
  Update: Omit<GenTables["products"]["Update"], "price" | "images"> & {
    price?: string;
    images?: ProductImage[];
  };
  Relationships: GenTables["products"]["Relationships"];
};

/**
 * `reviews.response` / `responded_at` — a seller's public reply. Manually declared until
 * `npm run db:types` is re-run against a DB with the 20260904020000_review_responses migration.
 */
type ReviewsFixed = {
  Row: Omit<GenTables["reviews"]["Row"], "response" | "responded_at"> & {
    response: string | null;
    responded_at: string | null;
  };
  Insert: Omit<GenTables["reviews"]["Insert"], "response" | "responded_at"> & {
    response?: string | null;
    responded_at?: string | null;
  };
  Update: Omit<GenTables["reviews"]["Update"], "response" | "responded_at"> & {
    response?: string | null;
    responded_at?: string | null;
  };
  Relationships: GenTables["reviews"]["Relationships"];
};

/**
 * `seller_view_counts` + `record_storefront_view` — storefront-view rollup for the seller
 * dashboard's conversion rate. Manually declared until `npm run db:types` picks up the
 * 20260904030000_storefront_views migration.
 */
type SellerViewCountsTable = {
  Row: { seller_id: string; day: string; views: number };
  Insert: { seller_id: string; day?: string; views?: number };
  Update: { seller_id?: string; day?: string; views?: number };
  Relationships: [];
};

type OrderMoneyKeys =
  | "subtotal"
  | "discount_total"
  | "delivery_fee"
  | "tax_total"
  | "total"
  | "delivery_distance_miles";

/** `Generated`, with the corrections described in the file header applied. */
export type Database = Omit<Generated, "public"> & {
  public: Omit<Generated["public"], "Tables" | "Functions"> & {
    Tables: Omit<
      GenTables,
      | "profiles"
      | "products"
      | "orders"
      | "order_items"
      | "state_cottage_food_rules"
      | "seller_revenue_tracking"
      | "referrals"
      | "refunds"
      | "reviews"
    > & {
      profiles: ProfilesFixed;
      products: ProductsFixed;
      reviews: ReviewsFixed;
      seller_view_counts: SellerViewCountsTable;
      orders: MoneyFixed<GenTables["orders"], OrderMoneyKeys>;
      order_items: MoneyFixed<GenTables["order_items"], "unit_price" | "line_total">;
      state_cottage_food_rules: MoneyFixed<GenTables["state_cottage_food_rules"], "revenue_cap">;
      seller_revenue_tracking: MoneyFixed<
        GenTables["seller_revenue_tracking"],
        "gross_revenue" | "cap_amount"
      >;
      referrals: MoneyFixed<GenTables["referrals"], "discount_amount">;
      refunds: MoneyFixed<GenTables["refunds"], "amount">;
    };
    Functions: Generated["public"]["Functions"] & {
      record_storefront_view: {
        Args: { p_seller_id: string };
        Returns: undefined;
      };
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

export type ReferralStatus = "pending" | "active" | "invalidated";

export type Role = Profile["role"];
export type ProductStatus = Product["status"];
export type SubscriptionStatus = Subscription["status"];
export type NotificationChannel = Notification["channel"];
export type LicenseType = SellerLicense["license_type"];
export type LicenseStatus = SellerLicense["verification_status"];
export type PauseReason =
  | "onboarding_incomplete"
  | "revenue_cap"
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
