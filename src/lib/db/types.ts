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
 *     `products.price` is corrected back to `string` so money stays exact end to end
 *     (see `src/lib/money.ts`). Add other numeric columns here as code starts touching them.
 *  2. `products.images` (jsonb) is given its real element shape instead of `Json`.
 */
import type { Database as Generated } from "./database.types";

export type { Json } from "./database.types";

/** One entry in `products.images`. */
export interface ProductImage {
  path: string;
  url: string;
  alt?: string;
}

type GenProducts = Generated["public"]["Tables"]["products"];

/** `Generated`, with the corrections described in the file header applied. */
export type Database = Omit<Generated, "public"> & {
  public: Omit<Generated["public"], "Tables"> & {
    Tables: Omit<Generated["public"]["Tables"], "products"> & {
      products: {
        Row: Omit<GenProducts["Row"], "price" | "images"> & {
          price: string;
          images: ProductImage[];
        };
        Insert: Omit<GenProducts["Insert"], "price" | "images"> & {
          price: string;
          images?: ProductImage[];
        };
        Update: Omit<GenProducts["Update"], "price" | "images"> & {
          price?: string;
          images?: ProductImage[];
        };
        Relationships: GenProducts["Relationships"];
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

export type Role = Profile["role"];
export type ProductStatus = Product["status"];
export type SubscriptionStatus = Subscription["status"];
