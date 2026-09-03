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
import { cents, toDecimalString } from "@/lib/money";
import { CartError, priceCart, type PricableProduct } from "@/lib/orders/pricing";
import { isUsState, sameState, US_STATES } from "@/lib/geo/state";
import { addressSchema, formatAddress, type AddressInput } from "@/lib/geo/address";
import { geocodeAddress } from "@/lib/geo/geocode";
import { quoteDelivery } from "@/lib/orders/delivery";
import { validatePromoCode } from "@/lib/referrals/validate";
import { ensureBuyerDiscountCoupon } from "@/lib/stripe/coupons";

/** The only cart data the client is trusted to send — every price is recomputed server-side. */
const cartPayloadSchema = z.object({
  sellerId: z.string().uuid(),
  items: z
    .array(z.object({ productId: z.string().uuid(), quantity: z.number().int().min(1).max(99) }))
    .min(1)
    .max(50),
  promoCode: z.string().max(32).optional(),
  fulfillment: z.enum(["pickup", "delivery"]).default("pickup"),
  deliveryAddress: addressSchema.optional(),
});

export type CartPayload = z.infer<typeof cartPayloadSchema>;

const SELLER_SELECT =
  "id, profile_id, business_name, storefront_slug, home_state, is_paused, connect_charges_enabled, stripe_account_id, delivery_enabled";

/** Load the seller + products for a payload and re-price server-side. Shared by review + checkout. */
async function reprice(payload: CartPayload) {
  const supabase = await createClient();

  const { data: seller } = await supabase
    .from("seller_profiles")
    .select(SELLER_SELECT)
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

const DELIVERY_REASON_COPY: Record<string, string> = {
  disabled: "This seller isn't offering delivery right now.",
  out_of_range: "That address is outside this seller's delivery area.",
  no_route: "We couldn't find a driving route to that address.",
  ungeocodable: "We couldn't locate that address. Check it and try again.",
  wrong_state: "Delivery has to stay within the seller's state.",
};

/**
 * Resolve a delivery fee for a checkout. Geocodes the address, enforces same-state, and quotes the
 * driving-distance fee — all server-side. Returns cents + a distance/text snapshot, or a reason.
 */
type DeliveryResolution =
  | { ok: true; feeCents: number; distanceMiles: number; text: string; state: AddressInput["state"] }
  | { ok: false; reason: keyof typeof DELIVERY_REASON_COPY };

async function resolveDelivery(
  sellerId: string,
  sellerState: string,
  address: AddressInput,
): Promise<DeliveryResolution> {
  if (address.state !== sellerState) return { ok: false, reason: "wrong_state" };

  const point = await geocodeAddress(address);
  if (!point) return { ok: false, reason: "ungeocodable" };

  const quote = await quoteDelivery(sellerId, point);
  if (!quote.ok) return { ok: false, reason: quote.reason };

  return {
    ok: true,
    feeCents: quote.feeCents,
    distanceMiles: quote.distanceMiles,
    text: formatAddress(address),
    state: address.state,
  };
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
  sellerDeliveryEnabled?: boolean;
  lines?: { title: string; quantity: number; unitPrice: number; lineTotal: number }[];
  subtotal?: number;
  /** Present only when a promo code was submitted. */
  promo?: { ok: true; code: string; discountCents: number } | { ok: false; error: string };
  /** Present only when a delivery address was submitted. */
  delivery?:
    | { ok: true; feeCents: number; distanceMiles: number }
    | { ok: false; error: string };
}

/** Called from the checkout page (client) to render an authoritative, server-priced review. */
export async function repriceCartAction(input: unknown): Promise<RepriceResult> {
  const { user, profile } = await requireUser("/checkout");

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

  let promo: RepriceResult["promo"];
  const submittedCode = parsed.data.promoCode?.trim();
  if (submittedCode) {
    const v = await validatePromoCode({
      code: submittedCode,
      cartSellerId: seller.id,
      buyerId: user.id,
      subtotalCents: priced.subtotal,
    });
    promo = v.ok
      ? { ok: true, code: v.code!, discountCents: v.discountCents! }
      : { ok: false, error: v.reason ?? "That code isn't valid." };
  }

  let delivery: RepriceResult["delivery"];
  if (parsed.data.fulfillment === "delivery" && parsed.data.deliveryAddress) {
    const d = await resolveDelivery(seller.id, seller.home_state, parsed.data.deliveryAddress);
    delivery = d.ok
      ? { ok: true, feeCents: d.feeCents, distanceMiles: d.distanceMiles }
      : { ok: false, error: DELIVERY_REASON_COPY[d.reason] };
  }

  return {
    ok: true,
    buyerState: profile.home_state,
    sellerState: seller.home_state,
    sellerName: seller.business_name,
    sellerSlug: seller.storefront_slug,
    inState: sameState(profile.home_state, seller.home_state),
    sellerLive,
    sellerDeliveryEnabled: seller.delivery_enabled,
    subtotal: priced.subtotal,
    lines: priced.lines.map((l) => ({
      title: l.title,
      quantity: l.quantity,
      unitPrice: l.unitPrice,
      lineTotal: l.lineTotal,
    })),
    promo,
    delivery,
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

  if (!profile.home_state || !isUsState(profile.home_state)) redirect("/checkout?error=state");

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
  if (!sameState(profile.home_state, seller.home_state)) redirect("/checkout?error=state_mismatch");

  // Delivery (optional). Fee, distance, and the frozen address are all resolved server-side; the
  // fee rides the Stripe session as a shipping option so Stripe Tax handles delivery tax.
  const isDelivery = payload.fulfillment === "delivery";
  let deliveryFeeCents = 0;
  let deliveryDistance: number | null = null;
  let deliveryText: string | null = null;
  let buyerState = profile.home_state;

  if (isDelivery) {
    if (!payload.deliveryAddress) redirect("/checkout?error=delivery");
    const d = await resolveDelivery(seller.id, seller.home_state, payload.deliveryAddress);
    if (!d.ok) redirect(`/checkout?error=delivery`);
    deliveryFeeCents = d.feeCents;
    deliveryDistance = d.distanceMiles;
    deliveryText = d.text;
    buyerState = d.state; // == seller.home_state (resolveDelivery enforces it)
  }

  // Referral code (optional). The discount amount is OUR order math (admin-set % from
  // platform_settings, computed in validatePromoCode) and is snapshotted into the order now. A
  // matching reusable Coupon is attached to the Checkout Session purely as the transport so Stripe
  // Tax computes on the discounted base; the webhook reconciles `discount_total` against the
  // session's `amount_discount` (authoritative — that's what was actually charged).
  let promoCodeId: string | null = null;
  let discountCoupon: string | undefined;
  let discountCents = 0;
  let couponFailed = false;
  const submittedCode = payload.promoCode?.trim();
  if (submittedCode) {
    const v = await validatePromoCode({
      code: submittedCode,
      cartSellerId: seller.id,
      buyerId: user.id,
      subtotalCents: priced.subtotal,
    });
    if (!v.ok) redirect("/checkout?error=promo");
    promoCodeId = v.promoCodeId!;
    discountCents = v.discountCents!;
    try {
      discountCoupon = await ensureBuyerDiscountCoupon(v.discountPercent!);
    } catch (err) {
      console.error("[checkout] buyer discount coupon unavailable:", err);
      couponFailed = true;
    }
  }
  if (couponFailed) redirect("/checkout?error=promo");

  const admin = createAdminClient();
  const subtotal = toDecimalString(priced.subtotal);
  const discountTotal = toDecimalString(cents(discountCents));
  const deliveryFee = toDecimalString(cents(deliveryFeeCents));
  // Pre-tax total; `tax_total` and the final `total` are finalised by the webhook from the
  // Stripe-computed session (same as a no-promo order).
  const preTaxTotal = toDecimalString(cents(priced.subtotal - discountCents + deliveryFeeCents));

  const { data: order, error: orderError } = await admin
    .from("orders")
    .insert({
      buyer_id: user.id,
      seller_id: seller.id,
      status: "pending_payment",
      fulfillment_type: isDelivery ? "delivery" : "pickup",
      subtotal,
      discount_total: discountTotal,
      delivery_fee: deliveryFee,
      tax_total: "0.00",
      total: preTaxTotal,
      buyer_state: buyerState,
      seller_state: seller.home_state,
      promo_code_id: promoCodeId,
      delivery_distance_miles: deliveryDistance == null ? null : String(deliveryDistance),
      delivery_address_text: deliveryText,
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
        discountCoupon,
        deliveryFeeCents,
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
