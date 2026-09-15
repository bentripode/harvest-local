import { redirect } from "next/navigation";

import { StoryEditor } from "@/components/story-editor";
import { StorefrontImagesForm } from "@/components/storefront-images-form";
import { getSellerContext } from "@/lib/auth";
import { getSellerStory } from "@/lib/stories/queries";

export const metadata = { title: "Your storefront — Harvest Local" };

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
        <h1 className="text-2xl sm:text-3xl">Your storefront</h1>
        <p className="text-muted-foreground text-sm">
          Your photo, your banner, and a few sentences on how you started. Buyers here are choosing
          a person as much as a product.
        </p>
      </div>

      <StorefrontImagesForm
        sellerId={seller.id}
        businessName={seller.business_name}
        initialAvatar={
          seller.avatar_path && seller.avatar_url
            ? { path: seller.avatar_path, url: seller.avatar_url }
            : null
        }
        initialCover={
          seller.cover_path && seller.cover_url
            ? { path: seller.cover_path, url: seller.cover_url }
            : null
        }
      />

      <div className="border-t pt-8">
        <h2 className="text-lg">Your story</h2>
      </div>

      <StoryEditor
        initialStory={current?.story ?? ""}
        initialOnHome={current?.onHome ?? false}
        storefrontSlug={seller.storefront_slug}
      />
    </div>
  );
}
