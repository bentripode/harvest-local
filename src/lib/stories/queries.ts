import "server-only";

import { createClient } from "@/lib/supabase/server";
import { pickDailyStories, utcDayKey, type StoryLike } from "@/lib/stories/select";

/**
 * Reading seller stories. The choosing and the trimming are pure (`select.ts`).
 *
 * State scoping follows every other discovery surface: a visitor who has told us where they are
 * sees their own state's makers, because a story that ends at a storefront they cannot buy from is
 * a dead end. A visitor who hasn't told us yet sees anyone — better a real person from two states
 * over than an empty page, and the storefront itself will say the rest.
 */

export interface HomeStory extends StoryLike {
  city: string | null;
}

const SELECT = "id, business_name, storefront_slug, home_state, story";

export async function getHomeStories(state: string | null, count = 3): Promise<HomeStory[]> {
  const supabase = await createClient();

  let query = supabase
    .from("seller_profiles")
    .select(SELECT)
    .eq("story_on_home", true)
    .not("story", "is", null)
    // A storefront closed by us is not a shop window. One closed for a holiday keeps its story —
    // the storefront page stays up for `vacation` too, so the link still goes somewhere real.
    .or("is_paused.eq.false,pause_reason.eq.vacation")
    // A generous ceiling, then the rotation picks from all of them. Choosing from a slice of the
    // table ordered by anything would quietly reintroduce the favouritism the rotation avoids.
    .limit(200);

  if (state) query = query.eq("home_state", state.toUpperCase());

  const { data } = await query;

  const stories: HomeStory[] = (data ?? [])
    .filter((row) => (row.story ?? "").trim().length > 0)
    .map((row) => ({
      sellerId: row.id,
      businessName: row.business_name,
      storefrontSlug: row.storefront_slug,
      homeState: row.home_state,
      story: row.story!,
      city: null,
    }));

  return pickDailyStories(stories, utcDayKey(), count);
}

export interface SellerStory {
  story: string | null;
  onHome: boolean;
}

/** One seller's own story, for their storefront and for the editor. */
export async function getSellerStory(sellerId: string): Promise<SellerStory | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("seller_profiles")
    .select("story, story_on_home")
    .eq("id", sellerId)
    .maybeSingle();

  if (!data) return null;
  return { story: data.story, onHome: data.story_on_home };
}
