"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { getSellerContext, requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

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

export interface ImagesFormState {
  error?: string;
  ok?: boolean;
}

/**
 * A storage path is only ever accepted if it is one of THIS seller's.
 *
 * The path arrives in a form field, and a Server Action is reachable by direct POST — so without
 * this a seller could submit another seller's object path and have their storefront render it, or
 * have our replacement-delete remove it. The storage policy stops them WRITING outside their own
 * folder; nothing stops them naming a path they did not write.
 */
function ownedBy(sellerId: string, path: string): boolean {
  return path.startsWith(`${sellerId}/`) && !path.includes("..");
}

const imageSchema = z.object({
  avatarPath: z.string().trim().max(300),
  avatarUrl: z.string().trim().max(600),
  coverPath: z.string().trim().max(300),
  coverUrl: z.string().trim().max(600),
});

/**
 * The seller's mark and banner.
 *
 * Separate from `saveStoryAction` because the uploader has already written the objects by the time
 * this runs: this only records WHICH ones the storefront should point at, and tidies up the ones it
 * is replacing.
 */
export async function saveStorefrontImagesAction(
  _prev: ImagesFormState,
  formData: FormData,
): Promise<ImagesFormState> {
  await requireRole("seller");
  const { seller } = await getSellerContext();
  if (!seller) return { error: "Finish setting up your storefront first." };

  const parsed = imageSchema.safeParse({
    avatarPath: formData.get("avatarPath") ?? "",
    avatarUrl: formData.get("avatarUrl") ?? "",
    coverPath: formData.get("coverPath") ?? "",
    coverUrl: formData.get("coverUrl") ?? "",
  });
  if (!parsed.success) return { error: "Check the photos and try again." };

  const { avatarPath, avatarUrl, coverPath, coverUrl } = parsed.data;

  if (
    (avatarPath && !ownedBy(seller.id, avatarPath)) ||
    (coverPath && !ownedBy(seller.id, coverPath))
  ) {
    return { error: "That image doesn't belong to this storefront." };
  }
  // A path with no URL, or the reverse, would render a broken image or point at nothing.
  if (Boolean(avatarPath) !== Boolean(avatarUrl) || Boolean(coverPath) !== Boolean(coverUrl)) {
    return { error: "That upload didn't finish. Try picking the photo again." };
  }

  const supabase = await createClient();

  const { data: before } = await supabase
    .from("seller_profiles")
    .select("avatar_path, cover_path")
    .eq("id", seller.id)
    .maybeSingle();

  const { error } = await supabase
    .from("seller_profiles")
    .update({
      avatar_path: avatarPath || null,
      avatar_url: avatarUrl || null,
      cover_path: coverPath || null,
      cover_url: coverUrl || null,
    })
    .eq("id", seller.id);

  if (error) return { error: "We couldn't save that." };

  // Only once the row no longer points at them. Deleting first and then failing the update would
  // leave the storefront rendering a URL whose object is gone.
  const orphans = [
    before?.avatar_path && before.avatar_path !== avatarPath ? before.avatar_path : null,
    before?.cover_path && before.cover_path !== coverPath ? before.cover_path : null,
  ].filter((x): x is string => Boolean(x) && ownedBy(seller.id, x as string));

  if (orphans.length > 0) {
    // Service role: the seller's own session could do this, but the delete has to succeed after
    // the row is already updated, and an RLS hiccup here would silently keep the old file forever.
    try {
      await createAdminClient().storage.from("product-images").remove(orphans);
    } catch {
      /* an orphaned object is untidy, not broken — never fail the save for it */
    }
  }

  revalidatePath("/seller/story");
  revalidatePath("/seller");
  revalidatePath(`/s/${seller.storefront_slug}`);
  revalidatePath("/shop");
  return { ok: true };
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
