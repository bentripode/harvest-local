"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { stripe } from "@/lib/stripe/client";
import { buildCheckoutSessionParams } from "@/lib/stripe/checkout";
import { env } from "@/lib/env";
import { toDecimalString } from "@/lib/money";
import { CartError, priceCart, type PricableProduct } from "@/lib/orders/pricing";
import { isUsState, sameState, US_STATES } from "@/lib/geo/state";

/** `{ productId, quantity }[]` for one seller — the only cart data the client is trusted to send. */
const cartPayloadSchema = z.object({
  sellerId: z.string().uuid(),
  items: z
    .array(z.object({ productId: z.string().uuid(), quantity: z.number().int().min(1).max(99) }))
    .min(1)
    .max(50),
});

export type CartPayload = z.infer<typeof cartPayloadSchema>;

/** Load the seller + products for a payload and re-price server-side. Shared by review + checkout. */
async function reprice(payload: CartPayload) {
  const supabase = await createClient();

  const { data: seller } = await supabase
    .from("seller_profiles")
    .select(
      "id, profile_id, business_name, storefront_slug, home_state, is_paused, connect_charges_enabled, stripe_account_id",
    )
    .eq("id", payload.sellerId)
    .maybeSingle();

  const { data: products } = await supabase
    .from("products")
    .select(
      "id, title, price, status, seller_id, quantity_available, tax_code, category:categories!products_category_id_fkey(name, tax_code)",
    )
    .in(
      "id",
      payload.items.map((i) => i.productId),
    );

  const pricable: PricableProduct[] = (products ?? []).map((p) => {
    const category = p.category as { name: string; tax_code: string | null } | null;
    return {
      id: p.id,
      title: p.title,
      price: p.price,
      status: p.status,
      seller_id: p.seller_id,
      quantity_available: p.quantity_available,
      tax_code: p.tax_code,
      category_tax_code: category?.tax_code ?? null,
      category_name: category?.name ?? null,
    };
  });

  return { seller, priced: priceCart(payload.items, pricable, payload.sellerId) };
}

export interface RepriceResult {
  ok: boolean;
  error?: string;
  buyerState?: string | null;
  sellerState?: string;
  sellerName?: string;
  sellerSlug?: string;
  inState?: boolean;
  sellerLive?: boolean;
  lines?: { title: string; quantity: number; unitPrice: number; lineTotal: number }[];
  subtotal?: number;
}

/** Called from the checkout page (client) to render an authoritative, server-priced review. */
export async function repriceCartAction(input: unknown): Promise<RepriceResult> {
  const { profile } = await requireUser("/checkout");

  const parsed = cartPayloadSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Your basket looks invalid. Try again." };

  let repriced;
  try {
    repriced = await reprice(parsed.data);
  } catch (err) {
    return { ok: false, error: err instanceof CartError ? err.message : "Could not price your basket." };
  }

  const { seller, priced } = repriced;
  if (!seller) return { ok: false, error: "This seller is no longer available." };

  const sellerLive =
    !seller.is_paused && seller.connect_charges_enabled && !!seller.stripe_account_id;

  return {
    ok: true,
    buyerState: profile.home_state,
    sellerState: seller.home_state,
    sellerName: seller.business_name,
    sellerSlug: seller.storefront_slug,
    inState: sameState(profile.home_state, seller.home_state),
    sellerLive,
    subtotal: priced.subtotal,
    lines: priced.lines.map((l) => ({
      title: l.title,
      quantity: l.quantity,
      unitPrice: l.unitPrice,
      lineTotal: l.lineTotal,
    })),
  };
}

export interface StateFormState {
  error?: string;
}

/** Buyer self-attests their state (Phase 2). Backed by the same-state CHECK + checkout guard. */
export async function setBuyerStateAction(
  _prev: StateFormState,
  formData: FormData,
): Promise<StateFormState> {
  const { user } = await requireUser("/shop");
  const state = z.enum(US_STATES).safeParse(formData.get("state"));
  if (!state.success) return { error: "Choose your state." };

  const supabase = await createClient();
  const { error } = await supabase
    .from("profiles")
    .update({ home_state: state.data })
    .eq("id", user.id);
  if (error) return { error: error.message };

  revalidatePath("/shop");
  revalidatePath("/checkout");
  return {};
}

/**
 * The checkout flow. Re-validates and re-prices everything server-side, writes a
 * `pending_payment` order (money snapshot), creates a Stripe Checkout Session as a destination
 * charge with the seller as merchant of record, and redirects the buyer to Stripe. The order only
 * becomes `new` when the webhook confirms payment — never here.
 */
export async function startCheckoutAction(formData: FormData): Promise<void> {
  const { user, profile } = await requireUser("/checkout");

  let payload: CartPayload;
  try {
    payload = cartPayloadSchema.parse(JSON.parse(String(formData.get("cart") ?? "{}")));
  } catch {
    redirect("/cart?error=invalid");
  }

  const buyerState = profile.home_state;
  if (!buyerState || !isUsState(buyerState)) redirect("/checkout?error=state");

  let seller: Awaited<ReturnType<typeof reprice>>["seller"] = null;
  let priced: Awaited<ReturnType<typeof reprice>>["priced"] | null = null;
  let failure: string | null = null;
  try {
    const repriced = await reprice(payload);
    seller = repriced.seller;
    priced = repriced.priced;
  } catch (err) {
    failure = err instanceof CartError ? err.code : "pricing";
  }
  if (failure || !priced) redirect(`/checkout?error=${failure ?? "pricing"}`);
  if (!seller) redirect("/cart?error=seller");
  if (seller.profile_id === user.id) redirect("/cart?error=self");
  if (seller.is_paused || !seller.connect_charges_enabled || !seller.stripe_account_id) {
    redirect("/cart?error=unavailable");
  }
  if (!sameState(buyerState, seller.home_state)) redirect("/checkout?error=state_mismatch");

  const admin = createAdminClient();
  const subtotal = toDecimalString(priced.subtotal);

  const { data: order, error: orderError } = await admin
    .from("orders")
    .insert({
      buyer_id: user.id,
      seller_id: seller.id,
      status: "pending_payment",
      fulfillment_type: "pickup",
      subtotal,
      discount_total: "0.00",
      delivery_fee: "0.00",
      tax_total: "0.00",
      total: subtotal,
      buyer_state: buyerState,
      seller_state: seller.home_state,
    })
    .select("id")
    .single();
  if (orderError || !order) redirect("/checkout?error=order");

  const { error: itemsError } = await admin.from("order_items").insert(
    priced.lines.map((line) => ({
      order_id: order.id,
      product_id: line.productId,
      title_snapshot: line.title,
      quantity: line.quantity,
      unit_price: toDecimalString(line.unitPrice),
      line_total: toDecimalString(line.lineTotal),
      category_snapshot: line.categorySnapshot,
      tax_code: line.taxCode,
    })),
  );
  if (itemsError) redirect("/checkout?error=order");

  let checkoutUrl: string | null = null;
  try {
    const session = await stripe.checkout.sessions.create(
      buildCheckoutSessionParams({
        orderId: order.id,
        lines: priced.lines,
        sellerAccountId: seller.stripe_account_id,
        siteUrl: env.NEXT_PUBLIC_SITE_URL,
        customerEmail: user.email,
      }),
      { idempotencyKey: `checkout:${order.id}` },
    );
    checkoutUrl = session.url;
    await admin
      .from("orders")
      .update({ stripe_checkout_session_id: session.id })
      .eq("id", order.id);
  } catch (err) {
    console.error("[checkout] Stripe session creation failed:", err);
    await admin.from("orders").update({ status: "cancelled" }).eq("id", order.id);
    redirect(`/orders/${order.id}?checkout=error`);
  }

  if (!checkoutUrl) redirect(`/orders/${order.id}?checkout=error`);
  redirect(checkoutUrl);
}
