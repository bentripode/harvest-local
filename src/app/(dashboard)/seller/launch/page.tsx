import Link from "next/link";
import { redirect } from "next/navigation";

import { Badge } from "@/components/ui/badge";
import { CopyBox } from "@/components/copy-box";
import { getSellerContext } from "@/lib/auth";
import { getLaunchFacts } from "@/lib/launch/queries";
import { launchProgress, launchSteps, nextStep } from "@/lib/launch/checklist";
import { launchTemplates } from "@/lib/launch/templates";
import { createClient } from "@/lib/supabase/server";
import { getReferralConfig } from "@/lib/referrals/settings";
import { env } from "@/lib/env";
import { stateName } from "@/lib/geo/state";

export const metadata = { title: "Launch — Harvest Local" };

/**
 * What to do next, and the awkward messages written for you.
 *
 * Every step is derived from real state (see `checklist.ts`), so nothing here can be ticked that
 * wasn't done or nag about something that was. The templates are ours and pass the same claim screen
 * the writing assistant's output does.
 */
export default async function SellerLaunchPage() {
  const { profile, seller } = await getSellerContext();
  if (profile.role === "buyer") redirect("/");
  if (!seller) redirect("/seller/onboarding");

  const supabase = await createClient();
  // The discount is platform-wide config, not a property of the code — see referrals/settings.ts.
  const [facts, { data: promo }, referral] = await Promise.all([
    getLaunchFacts(seller),
    supabase
      .from("promo_codes")
      .select("code")
      .eq("seller_id", seller.id)
      .eq("is_active", true)
      .limit(1)
      .maybeSingle(),
    getReferralConfig(),
  ]);

  const steps = launchSteps(facts);
  const progress = launchProgress(steps);
  const next = nextStep(steps);

  const templates = launchTemplates({
    businessName: seller.business_name,
    storefrontUrl: `${env.NEXT_PUBLIC_SITE_URL}/s/${seller.storefront_slug}`,
    stateName: stateName(seller.home_state),
    bio: seller.bio,
    promoCode: promo?.code ?? null,
    promoPercent: promo ? referral.discountPercent : null,
  });

  return (
    <div className="mx-auto max-w-2xl space-y-8">
      <div>
        <h1 className="text-2xl sm:text-3xl">Launch</h1>
        <p className="text-muted-foreground text-sm">
          {next
            ? `${progress.done} of ${progress.total} done. Next: ${next.title.toLowerCase()}.`
            : "Everything on the list is done. The rest is baking."}
        </p>
      </div>

      <section className="space-y-3">
        <ul className="space-y-2">
          {steps.map((step) => (
            <li
              key={step.id}
              className={`flex gap-3 rounded-lg border p-3 ${
                step.state === "done" ? "opacity-60" : ""
              }`}
            >
              <span
                aria-hidden
                className={`mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full border text-xs ${
                  step.state === "done" ? "bg-foreground text-background border-foreground" : ""
                }`}
              >
                {step.state === "done" ? "✓" : ""}
              </span>

              <div className="min-w-0 flex-1 space-y-0.5">
                <div className="flex flex-wrap items-baseline gap-2">
                  {step.href && step.state !== "done" ? (
                    <Link href={step.href} className="font-medium hover:underline">
                      {step.title}
                    </Link>
                  ) : (
                    <span className="font-medium">{step.title}</span>
                  )}
                  {step.state === "blocked" ? (
                    <Badge variant="outline" className="font-normal">
                      Later
                    </Badge>
                  ) : null}
                  <span className="sr-only">
                    {step.state === "done" ? "Done" : step.state === "blocked" ? "Not yet" : "To do"}
                  </span>
                </div>
                <p className="text-muted-foreground text-sm">{step.why}</p>
                {step.note ? <p className="text-muted-foreground text-xs">{step.note}</p> : null}
              </div>
            </li>
          ))}
        </ul>
      </section>

      <section className="space-y-4">
        <div>
          <h2 className="text-lg">Things to send</h2>
          <p className="text-muted-foreground text-sm">
            The structure, not the substance — edit anything that doesn&apos;t sound like you before
            you send it. Nothing here is posted for you.
          </p>
        </div>

        {templates.map((t) => (
          <div key={t.id} className="space-y-2 rounded-lg border p-4">
            <div>
              <p className="font-medium">{t.title}</p>
              <p className="text-muted-foreground text-sm">{t.when}</p>
            </div>
            {t.note ? <p className="text-muted-foreground text-xs">{t.note}</p> : null}
            <CopyBox text={t.body} label={t.title} />
          </div>
        ))}
      </section>
    </div>
  );
}
