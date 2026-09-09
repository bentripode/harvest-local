import "server-only";

import { inngest } from "@/lib/inngest/client";
import { createAdminClient } from "@/lib/supabase/admin";
import { queueNotificationForEach } from "@/lib/notifications/queue";

/**
 * The point of following something.
 *
 * Two fan-outs, both deliberately narrow. A seller listing three things in one afternoon should
 * send three emails, not thirty — so each of these is triggered by one concrete event and resolves
 * its own recipients through `followers_to_notify()`, which is service-role only precisely because
 * it turns a target into a list of people.
 *
 * Both land in the `follows` notification category, which is suppressible: this is the platform
 * telling you about something you might like, not a compliance obligation, and it belongs behind a
 * switch a person can turn off.
 */

/** A seller you follow listed something. */
export const followedSellerListed = inngest.createFunction(
  {
    id: "followed-seller-listed",
    name: "New product → followers of the seller",
    retries: 3,
    triggers: [{ event: "harvest/product.published" }],
  },
  async ({ event, step }) => {
    const { productId } = event.data as { productId: string };
    const admin = createAdminClient();

    const context = await step.run("resolve-product", async () => {
      const { data } = await admin
        .from("products")
        .select(
          "id, title, status, seller:seller_profiles!inner(id, business_name, storefront_slug, is_paused)",
        )
        .eq("id", productId)
        .maybeSingle();
      if (!data) return null;

      const seller = data.seller as {
        id: string;
        business_name: string;
        storefront_slug: string;
        is_paused: boolean;
      } | null;

      // Re-checked here rather than trusted from the event: the listing may have been pulled, or
      // the storefront paused, between publish and this job running. Emailing people towards a
      // page that now 404s is worse than not emailing them.
      if (!seller || seller.is_paused || data.status !== "active") return null;

      return {
        title: data.title,
        sellerId: seller.id,
        businessName: seller.business_name,
        storefrontSlug: seller.storefront_slug,
      };
    });

    if (!context) return { skipped: true };

    const followers = await step.run("resolve-followers", async () => {
      const { data } = await admin.rpc("followers_to_notify", {
        p_target_type: "seller",
        p_target_id: context.sellerId,
      });
      return (data ?? []).map((r) => r.profile_id);
    });

    if (followers.length === 0) return { notified: 0 };

    await step.run("queue", async () => {
      await queueNotificationForEach(admin, followers, {
        template: "new_product_from_seller",
        channels: ["in_app", "email"],
        payload: {
          product_id: productId,
          product_title: context.title,
          business_name: context.businessName,
          storefront_slug: context.storefrontSlug,
        },
      });
    });

    return { notified: followers.length };
  },
);

/**
 * A seller started selling at a market you follow.
 *
 * This is also what finally makes `market_watchers` mean something. That waitlist has been
 * collecting addresses since 20260908220000 against a promise — "we'll tell you when someone starts
 * selling here" — that nothing could keep until sellers could attach a booth to a market at all.
 * Followers and watchers are notified together, since they asked the same question in two places.
 */
export const followedMarketGainedSeller = inngest.createFunction(
  {
    id: "followed-market-gained-seller",
    name: "New booth → followers and watchers of the market",
    retries: 3,
    triggers: [{ event: "harvest/market.seller_joined" }],
  },
  async ({ event, step }) => {
    const { marketId, sellerId } = event.data as { marketId: string; sellerId: string };
    const admin = createAdminClient();

    const context = await step.run("resolve", async () => {
      const [{ data: market }, { data: seller }] = await Promise.all([
        admin.from("markets").select("id, name, slug, state, status").eq("id", marketId).maybeSingle(),
        admin
          .from("seller_profiles")
          .select("business_name, storefront_slug, is_paused")
          .eq("id", sellerId)
          .maybeSingle(),
      ]);
      if (!market || market.status !== "published" || !seller || seller.is_paused) return null;

      return {
        marketName: market.name,
        marketSlug: market.slug,
        marketState: market.state,
        businessName: seller.business_name,
        storefrontSlug: seller.storefront_slug,
      };
    });

    if (!context) return { skipped: true };

    const followers = await step.run("resolve-followers", async () => {
      const { data } = await admin.rpc("followers_to_notify", {
        p_target_type: "market",
        p_target_id: marketId,
      });
      return (data ?? []).map((r) => r.profile_id);
    });

    // A watcher who has since made an account and followed the market is one person, so the
    // waitlist row is only used when it carries a profile we haven't already notified.
    const watchers = await step.run("resolve-watchers", async () => {
      const { data } = await admin
        .from("market_watchers")
        .select("profile_id")
        .eq("market_id", marketId)
        .not("profile_id", "is", null);
      return (data ?? []).map((r) => r.profile_id).filter((id): id is string => !!id);
    });

    const recipients = [...new Set([...followers, ...watchers])];
    if (recipients.length === 0) return { notified: 0 };

    await step.run("queue", async () => {
      await queueNotificationForEach(admin, recipients, {
        template: "seller_joined_market",
        channels: ["in_app", "email"],
        payload: {
          market_id: marketId,
          market_name: context.marketName,
          market_slug: context.marketSlug,
          market_state: context.marketState,
          business_name: context.businessName,
          storefront_slug: context.storefrontSlug,
        },
      });
    });

    return { notified: recipients.length };
  },
);
