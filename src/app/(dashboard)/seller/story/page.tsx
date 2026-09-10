import { redirect } from "next/navigation";

import { StoryEditor } from "@/components/story-editor";
import { getSellerContext } from "@/lib/auth";
import { getSellerStory } from "@/lib/stories/queries";

export const metadata = { title: "Your story — Harvest Local" };

/**
 * Where a seller writes the long version of who they are.
 *
 * Separate from the one-line bio collected at onboarding, and separate from `seller_posts`, which is
 * their running feed. This is the piece that doesn't change: how they started, what they make, why.
 */
export default async function SellerStoryPage() {
  const { profile, seller } = await getSellerContext();
  if (profile.role === "buyer") redirect("/");
  if (!seller) redirect("/seller/onboarding");

  const current = await getSellerStory(seller.id);

  return (
    <div className="mx-auto max-w-2xl space-y-8">
      <div>
        <h1 className="text-2xl sm:text-3xl">Your story</h1>
        <p className="text-muted-foreground text-sm">
          Buyers on a local marketplace are choosing a person as much as a product. A few sentences
          about how you started and what you make does more than any amount of description on the
          listings.
        </p>
      </div>

      <StoryEditor
        initialStory={current?.story ?? ""}
        initialOnHome={current?.onHome ?? false}
        storefrontSlug={seller.storefront_slug}
      />
    </div>
  );
}
