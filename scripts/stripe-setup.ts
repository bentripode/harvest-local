/**
 * One-time Stripe test-mode setup.
 *
 *   npm run stripe:setup
 *
 * Creates (idempotently):
 *  - a "Harvest Local Seller" Product with a $20/mo recurring Price
 *  - the reusable FREE_MONTH_100 coupon (100% off, once) used by the Phase 3 referral reward
 *
 * Prints the Price id to paste into STRIPE_SUBSCRIPTION_PRICE_ID.
 *
 * Run with Node's built-in .env + TS support (Node 22.6+ / 24): `node --env-file=.env.local`.
 */
import Stripe from "stripe";

const key = process.env.STRIPE_SECRET_KEY;
if (!key?.startsWith("sk_test_")) {
  console.error("STRIPE_SECRET_KEY must be a test-mode key (sk_test_...). Aborting.");
  process.exit(1);
}

const stripe = new Stripe(key, { apiVersion: "2026-08-26.dahlia" });

const PRODUCT_LOOKUP = "harvest_local_seller_subscription";
const PRICE_LOOKUP = "harvest_local_seller_monthly";
const COUPON_ID = "FREE_MONTH_100";

async function main() {
  // Product
  const existingProducts = await stripe.products.search({
    query: `metadata['lookup']:'${PRODUCT_LOOKUP}'`,
  });
  const product =
    existingProducts.data[0] ??
    (await stripe.products.create({
      name: "Harvest Local Seller",
      description: "Monthly storefront subscription for Harvest Local sellers.",
      metadata: { lookup: PRODUCT_LOOKUP },
    }));
  console.log(`Product: ${product.id}`);

  // Price ($20/mo). Prices are immutable; find by lookup_key or create.
  let price: Stripe.Price | undefined;
  const existingPrices = await stripe.prices.list({
    product: product.id,
    active: true,
    limit: 100,
  });
  price = existingPrices.data.find((p) => p.lookup_key === PRICE_LOOKUP);
  if (!price) {
    price = await stripe.prices.create({
      product: product.id,
      lookup_key: PRICE_LOOKUP,
      currency: "usd",
      unit_amount: 2000,
      recurring: { interval: "month" },
      metadata: { lookup: PRICE_LOOKUP },
    });
  }
  console.log(`Price:   ${price.id}  ($${(price.unit_amount ?? 0) / 100}/mo)`);

  // Seller reward coupon (100% off next invoice)
  await ensureCoupon(COUPON_ID, {
    percent_off: 100,
    duration: "once",
    name: "Referral reward — one free month",
  });

  // Buyer referral discount coupon for the current default rate (others are created on demand
  // by src/lib/stripe/coupons.ts). Keep in sync with platform_settings.buyer_referral_discount.
  const BUYER_PCT = 10;
  await ensureCoupon(`buyer-referral-pct-${BUYER_PCT}`, {
    percent_off: BUYER_PCT,
    duration: "once",
    name: `Harvest Local referral — ${BUYER_PCT}% off`,
    metadata: { purpose: "buyer_referral_discount" },
  });

  console.log("\nAdd this to .env.local:");
  console.log(`STRIPE_SUBSCRIPTION_PRICE_ID="${price.id}"`);
}

async function ensureCoupon(
  id: string,
  params: Omit<Stripe.CouponCreateParams, "id">,
): Promise<void> {
  try {
    const c = await stripe.coupons.retrieve(id);
    console.log(`Coupon:  ${c.id} (exists)`);
  } catch {
    const c = await stripe.coupons.create({ id, ...params });
    console.log(`Coupon:  ${c.id} (created)`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
