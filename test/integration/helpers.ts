import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { describe } from "vitest";

import type { Database } from "@/lib/db/types";

/**
 * Integration-test harness — runs the SECURITY DEFINER functions, triggers and RLS policies against
 * a REAL Postgres (a throwaway Supabase branch or `supabase start`). See ./README.md.
 *
 * Every suite is wrapped in `describeDb`, which SKIPS when the three env vars below are unset — so
 * `npm test` and CI stay green without a database. `npm run test:integration` is the DB pass.
 *
 * These tests create and delete real rows. Never point them at production.
 */

const url = process.env.INTEGRATION_SUPABASE_URL;
const anonKey = process.env.INTEGRATION_SUPABASE_ANON_KEY;
const serviceKey = process.env.INTEGRATION_SUPABASE_SERVICE_ROLE_KEY;

export const dbConfigured = !!(url && anonKey && serviceKey);

/** `describe` that skips the whole suite when no database is configured (see ./global-setup.ts). */
export const describeDb = dbConfigured ? describe : describe.skip;

export type Db = SupabaseClient<Database>;

/** Service-role client — bypasses RLS. The stand-in for webhook / trusted-job code. */
export function adminDb(): Db {
  return createClient<Database>(url!, serviceKey!, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

/** Anon client with no session — the stand-in for a logged-out visitor. */
export function anonDb(): Db {
  return createClient<Database>(url!, anonKey!, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

// ---------------------------------------------------------------------------
// Fixtures. Everything is prefixed `it-` and torn down by `cleanupAll()`.
// Vitest isolates modules per file, so this registry is per test file.
// ---------------------------------------------------------------------------

const createdUserIds: string[] = [];
const createdOrderIds: string[] = [];

const rand = () => Math.random().toString(36).slice(2, 10);

export interface TestUser {
  id: string;
  email: string;
  password: string;
  /** Client authenticated AS this user — subject to RLS. */
  db: Db;
}

/**
 * Creates an auth user (the `on_auth_user_created` trigger makes the `profiles` row), sets
 * `home_state`, and returns a client signed in as them.
 */
export async function createTestUser(opts: {
  role?: "buyer" | "seller" | "admin";
  homeState?: string;
  displayName?: string;
} = {}): Promise<TestUser> {
  const admin = adminDb();
  const email = `it-${rand()}@example.test`;
  const password = `it-${rand()}-Aa1!`;

  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: {
      display_name: opts.displayName ?? `IT ${rand()}`,
      role: opts.role === "seller" ? "seller" : "buyer",
    },
  });
  if (error || !data.user) throw new Error(`createTestUser: ${error?.message ?? "no user"}`);
  const id = data.user.id;
  createdUserIds.push(id);

  // `role: admin` can't come from metadata (handle_new_user only maps seller/buyer).
  const patch: { home_state?: string; role?: "buyer" | "seller" | "admin" } = {};
  if (opts.homeState) patch.home_state = opts.homeState;
  if (opts.role === "admin") patch.role = "admin";
  if (Object.keys(patch).length > 0) {
    const { error: pErr } = await admin.from("profiles").update(patch).eq("id", id);
    if (pErr) throw new Error(`createTestUser profile patch: ${pErr.message}`);
  }

  const db = anonDb();
  const { error: signInError } = await db.auth.signInWithPassword({ email, password });
  if (signInError) throw new Error(`createTestUser signIn: ${signInError.message}`);

  return { id, email, password, db };
}

/** A live storefront for `profileId`. `isPaused` defaults to false so checkout guards pass. */
export async function createSeller(
  profileId: string,
  opts: { homeState?: string; isPaused?: boolean } = {},
): Promise<{ id: string; homeState: string }> {
  const admin = adminDb();
  const homeState = opts.homeState ?? "TX";
  const { data, error } = await admin
    .from("seller_profiles")
    .insert({
      profile_id: profileId,
      business_name: `IT Storefront ${rand()}`,
      storefront_slug: `it-${rand()}`,
      home_state: homeState,
      is_paused: opts.isPaused ?? false,
      connect_charges_enabled: true,
      connect_details_submitted: true,
      stripe_account_id: `acct_it_${rand()}`,
    })
    .select("id")
    .single();
  if (error || !data) throw new Error(`createSeller: ${error?.message}`);
  return { id: data.id, homeState };
}

/** An `active` product with stock, using whatever seeded category is available. */
export async function createProduct(
  sellerId: string,
  opts: { price?: string; quantity?: number } = {},
): Promise<{ id: string; title: string }> {
  const admin = adminDb();
  const { data: cat, error: catErr } = await admin
    .from("categories")
    .select("id")
    .is("parent_id", null)
    .limit(1)
    .single();
  if (catErr || !cat) throw new Error(`createProduct: no seeded category (${catErr?.message})`);

  const title = `IT Product ${rand()}`;
  const { data, error } = await admin
    .from("products")
    .insert({
      seller_id: sellerId,
      title,
      price: opts.price ?? "10.00",
      category_id: cat.id,
      status: "active",
      quantity_available: opts.quantity ?? 10,
    })
    .select("id")
    .single();
  if (error || !data) throw new Error(`createProduct: ${error?.message}`);
  return { id: data.id, title };
}

/** Inserts an order via the service role (as the checkout action does) and tracks it for cleanup. */
export async function createOrder(opts: {
  buyerId: string;
  sellerId: string;
  buyerState: string;
  sellerState?: string;
  status?: Database["public"]["Tables"]["orders"]["Row"]["status"];
  subtotal?: string;
  total?: string;
  fulfillmentType?: "pickup" | "delivery";
  promoCodeId?: string | null;
}): Promise<{ id: string }> {
  const admin = adminDb();
  const { data, error } = await admin
    .from("orders")
    .insert({
      buyer_id: opts.buyerId,
      seller_id: opts.sellerId,
      status: opts.status ?? "pending_payment",
      fulfillment_type: opts.fulfillmentType ?? "pickup",
      subtotal: opts.subtotal ?? "10.00",
      total: opts.total ?? "10.00",
      buyer_state: opts.buyerState,
      seller_state: opts.sellerState ?? opts.buyerState,
      promo_code_id: opts.promoCodeId ?? null,
    })
    .select("id")
    .single();
  if (error || !data) throw new Error(`createOrder: ${error?.message}`);
  createdOrderIds.push(data.id);
  return { id: data.id };
}

export async function addOrderItem(
  orderId: string,
  product: { id: string; title: string },
  opts: { quantity?: number; unitPrice?: string } = {},
): Promise<void> {
  const admin = adminDb();
  const quantity = opts.quantity ?? 1;
  const unitPrice = opts.unitPrice ?? "10.00";
  const { error } = await admin.from("order_items").insert({
    order_id: orderId,
    product_id: product.id,
    title_snapshot: product.title,
    quantity,
    unit_price: unitPrice,
    line_total: (Number(unitPrice) * quantity).toFixed(2),
  });
  if (error) throw new Error(`addOrderItem: ${error.message}`);
}

/** Walks an order to `completed` with the service role (bypasses the seller-ownership check). */
export async function completeOrder(orderId: string, fulfillment: "pickup" | "delivery" = "pickup") {
  const admin = adminDb();
  const path =
    fulfillment === "delivery"
      ? ["preparing", "ready", "out_for_delivery", "completed"]
      : ["preparing", "ready", "completed"];
  for (const to of path) {
    const { error } = await admin.rpc("advance_order_status", {
      p_order_id: orderId,
      p_to_status: to,
    });
    if (error) throw new Error(`completeOrder(${to}): ${error.message}`);
  }
}

/**
 * Deletes what this file created. Orders go first — `orders.buyer_id` is `on delete restrict`, so
 * removing the auth user would fail otherwise. Everything else cascades off the user.
 */
export async function cleanupAll(): Promise<void> {
  if (!dbConfigured) return;
  const admin = adminDb();

  if (createdOrderIds.length > 0) {
    await admin.from("orders").delete().in("id", createdOrderIds);
    createdOrderIds.length = 0;
  }
  for (const id of createdUserIds) {
    await admin.auth.admin.deleteUser(id).catch(() => {});
  }
  createdUserIds.length = 0;
}
