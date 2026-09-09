"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { getSellerContext, requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

/**
 * The seller's own story.
 *
 * Written under their own session — `story` and `story_on_home` are deliberately NOT in
 * `seller_profiles_guard_columns`, because unlike `is_paused` or `avg_rating` they are not verdicts
 * the platform reaches about a seller. They are the seller's words about themselves.
 */

export interface StoryFormState {
  error?: string;
  ok?: boolean;
}

const schema = z.object({
  story: z.string().trim().max(2000, "That's longer than the page can show — trim it a little."),
  onHome: z.boolean(),
});

export async function saveStoryAction(
  _prev: StoryFormState,
  formData: FormData,
): Promise<StoryFormState> {
  await requireRole("seller");
  const { seller } = await getSellerContext();
  if (!seller) return { error: "Finish setting up your storefront first." };

  const parsed = schema.safeParse({
    story: formData.get("story") ?? "",
    onHome: formData.get("onHome") === "on",
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Check what you've written." };
  }

  const story = parsed.data.story || null;

  const supabase = await createClient();
  const { error } = await supabase
    .from("seller_profiles")
    .update({
      story,
      // Clearing the story takes it off the home page too. Leaving the flag set on an empty story
      // would put a blank card on the front page the next time the rotation reached them.
      story_on_home: story ? parsed.data.onHome : false,
    })
    .eq("id", seller.id);

  if (error) return { error: "We couldn't save that." };

  revalidatePath("/seller/story");
  revalidatePath(`/s/${seller.storefront_slug}`);
  revalidatePath("/");
  return { ok: true };
}
