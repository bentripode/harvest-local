import { redirect } from "next/navigation";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SellerPostComposer, SellerQuestionQueue } from "@/components/seller-questions-manager";
import { getSellerContext } from "@/lib/auth";
import { getSellerQuestionQueue, getStorefrontPosts } from "@/lib/storefront/queries";

export const metadata = { title: "Updates & questions — Harvest Local" };

export default async function SellerQuestionsPage() {
  const { profile, seller } = await getSellerContext();
  if (profile.role === "buyer") redirect("/");
  if (!seller) redirect("/seller/onboarding");

  const [posts, questions] = await Promise.all([
    getStorefrontPosts(seller.id, 20),
    getSellerQuestionQueue(seller.id),
  ]);

  return (
    <div className="mx-auto max-w-2xl space-y-8">
      <div>
        <h1 className="text-2xl sm:text-3xl">Updates &amp; questions</h1>
        <p className="text-muted-foreground text-sm">
          Updates show at the top of your storefront. A question stays private until you answer;
          your answer is public, with the asker&apos;s first name.
        </p>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium">Post an update</CardTitle>
        </CardHeader>
        <CardContent>
          <SellerPostComposer posts={posts} sellerId={seller.id} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium">Questions</CardTitle>
        </CardHeader>
        <CardContent>
          <SellerQuestionQueue questions={questions} />
        </CardContent>
      </Card>
    </div>
  );
}
