import "server-only";

import { createClient } from "@/lib/supabase/server";
import { getProductDisclosures, type ProductDisclosure } from "@/lib/labels/disclosure";
import { DROP_SELECT, toDrops, type DropRow } from "@/lib/orders/drop-queries";
import { stockWithDrops } from "@/lib/orders/drops";
import { describeCard, type CardFacts } from "@/lib/products/card";
import type { DropLike } from "@/lib/orders/drops";
import type { VariantLike } from "@/lib/orders/sale-unit";

/**
 * Everything the quick view shows about one listing, loaded when the buyer opens it.
 *
 * Loaded on demand rather than with the gallery: `/shop` renders six products for each of many
 * sellers, and the pre-sale disclosure is one SECURITY DEFINER call per product. Paying for all of
 * them so a buyer can open one would be slow for everybody. It also means the disclosure is fetched
 * at the moment the buyer reads it, rather than at whatever time the page was rendered.
 *
 * =========================================================================
 * THE QUICK VIEW IS A PLACE TO ADD TO A BASKET, SO IT IS A PRE-SALE SURFACE
 * =========================================================================
 * In the eleven `predisclosure_required` jurisdictions the listing IS the disclosure — Texas
 * §437.0194(b)(2) permits an internet sale only if the labelling information reaches the buyer
 * "before the operator accepts payment", and Illinois legislates the point of sale in those words.
 * A modal with an "Add to basket" button and no label is a new way to reach payment without the
 * disclosure the storefront page shows.
 *
 * So `canAddToBasket` is false whenever a disclosure is required and we could not render one. It
 * FAILS CLOSED: a load error, a missing rule, an empty result — all of them remove the button
 * rather than leaving it there. The buyer is sent to the storefront listing, which renders the same
 * thing server-side and is the surface those states were written about.
 */

export interface QuickView {
  id: string;
  title: string;
  description: string | null;
  images: { url: string; alt?: string }[];
  sellerId: string;
  sellerSlug: string;
  sellerName: string;
  price: string;
  /**
   * What the buyer may actually take: the shelf capped by the open batch, whichever is smaller.
   * The storefront passes the same figure — a modal offering a quantity stepper that runs past the
   * batch would let a buyer build a cart `priceCart` is going to refuse.
   */
  quantityAvailable: number | null;
  ingredients: string[];
  handlingInstructions: string | null;
  variants: VariantLike[];
  drops: DropLike[];
  facts: CardFacts;
  disclosure: ProductDisclosure | null;
  /** False where a required disclosure could not be shown — see the note above. */
  canAddToBasket: boolean;
}

export async function getQuickView(productId: string): Promise<QuickView | null> {
  const supabase = await createClient();

  // RLS decides visibility: an `active` product on a live storefront, or the owner's own. A draft
  // listing simply comes back empty, which is the same answer as "no such product".
  const { data, error } = await supabase
    .from("products")
    .select(
      `id, title, description, price, images, quantity_available, status, seller_id,
       net_weight_value, net_weight_unit, allergens, ingredients, handling_instructions,
       variants:product_variants(id, name, price, quantity_available, is_active, net_weight_value, net_weight_unit),
       drops:product_drops(${DROP_SELECT}),
       seller:seller_profiles!inner(id, business_name, storefront_slug, is_paused, pause_reason)`,
    )
    .eq("id", productId)
    .eq("status", "active")
    .maybeSingle();

  if (error || !data) return null;

  const seller = data.seller as {
    id: string;
    business_name: string;
    storefront_slug: string;
    is_paused: boolean;
    pause_reason: string | null;
  } | null;
  if (!seller) return null;

  // A storefront closed by us is not shoppable. One closed by its seller for a holiday stays
  // readable — the storefront page makes the same distinction.
  const closedByUs = seller.is_paused && seller.pause_reason !== "vacation";
  const onBreak = seller.is_paused && seller.pause_reason === "vacation";
  if (closedByUs) return null;

  const variants = (data.variants ?? []) as VariantLike[];
  const drops = toDrops(data.drops as DropRow[] | null);

  const facts = describeCard({
    id: data.id,
    title: data.title,
    price: data.price,
    quantityAvailable: data.quantity_available,
    netWeightValue: data.net_weight_value,
    netWeightUnit: data.net_weight_unit,
    allergens: data.allergens,
    variants,
    drops,
  });

  // Fail closed: if this throws we treat it as "required and unshowable", never as "not required".
  let disclosure: ProductDisclosure | null = null;
  let disclosureFailed = false;
  try {
    const map = await getProductDisclosures([data.id]);
    disclosure = map[data.id] ?? null;
  } catch (err) {
    console.error("[quick-view] disclosure lookup failed for", data.id, err);
    disclosureFailed = true;
  }

  const disclosureShowable =
    !disclosureFailed &&
    (!disclosure?.required || disclosure.lines.length > 0 || !!disclosure.disclaimer);

  return {
    id: data.id,
    title: data.title,
    description: data.description,
    images: (data.images ?? []) as { url: string; alt?: string }[],
    sellerId: seller.id,
    sellerSlug: seller.storefront_slug,
    sellerName: seller.business_name,
    price: data.price,
    quantityAvailable: stockWithDrops(drops, data.quantity_available),
    ingredients: (data.ingredients ?? []) as string[],
    handlingInstructions: data.handling_instructions,
    variants,
    drops,
    facts,
    disclosure,
    canAddToBasket: facts.orderable && disclosureShowable && !onBreak,
  };
}
