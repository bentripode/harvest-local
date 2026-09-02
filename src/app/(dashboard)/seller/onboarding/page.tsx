import Link from "next/link";
import { redirect } from "next/navigation";
import { CheckCircle2, Circle } from "lucide-react";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getSellerContext } from "@/lib/auth";
import {
  ConnectButton,
  StorefrontForm,
  SubscriptionButton,
} from "@/components/onboarding-steps";

export default async function OnboardingPage({ searchParams }: PageProps<"/seller/onboarding">) {
  const { profile, seller, subscription, onboardingComplete } = await getSellerContext();
  if (profile.role === "buyer") redirect("/");
  if (onboardingComplete) redirect("/seller");

  const params = await searchParams;

  const storefrontDone = !!seller;
  const connectStarted = !!seller?.stripe_account_id;
  const connectDone = !!seller?.connect_details_submitted && !!seller?.connect_charges_enabled;
  const subDone = !!subscription && ["trialing", "active"].includes(subscription.status);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Set up your storefront</h1>
        <p className="text-muted-foreground text-sm">
          Three steps and you&apos;re live. Your first 90 days are free.
        </p>
      </div>

      {params.connect === "return" && !connectDone ? (
        <p className="rounded-md border bg-amber-50 p-3 text-sm text-amber-900">
          Thanks — we&apos;re confirming your details with Stripe. This page updates automatically
          once they&apos;re verified.{" "}
          <Link href="/seller/onboarding" className="underline">
            Refresh
          </Link>
        </p>
      ) : null}

      <Step
        n={1}
        title="Storefront details"
        done={storefrontDone}
        description="Your business name, public handle, and the state you sell in."
      >
        {storefrontDone ? (
          <p className="text-muted-foreground text-sm">
            {seller?.business_name} · /s/{seller?.storefront_slug} · {seller?.home_state}
          </p>
        ) : (
          <StorefrontForm />
        )}
      </Step>

      <Step
        n={2}
        title="Payout details"
        done={connectDone}
        locked={!storefrontDone}
        description="Stripe collects your identity and bank info to pay you out. Opens in Stripe."
      >
        {connectDone ? (
          <p className="text-muted-foreground text-sm">Verified with Stripe.</p>
        ) : (
          <ConnectButton>
            {connectStarted ? "Continue with Stripe" : "Set up payouts with Stripe"}
          </ConnectButton>
        )}
      </Step>

      <Step
        n={3}
        title="Start your subscription"
        done={subDone}
        locked={!storefrontDone}
        description="$20/month after a 90-day free trial. No card required to start the trial."
      >
        {subDone ? (
          <p className="text-muted-foreground text-sm capitalize">
            {subscription?.status}
            {subscription?.trial_end
              ? ` · trial ends ${new Date(subscription.trial_end).toLocaleDateString()}`
              : ""}
          </p>
        ) : params.subscription === "cancelled" ? (
          <div className="space-y-3">
            <p className="text-muted-foreground text-sm">Checkout was cancelled.</p>
            <SubscriptionButton>Try again</SubscriptionButton>
          </div>
        ) : (
          <SubscriptionButton>Start 90-day free trial</SubscriptionButton>
        )}
      </Step>

      {storefrontDone && !onboardingComplete ? (
        <p className="text-muted-foreground text-sm">
          Steps 2 and 3 can be done in either order. Your storefront goes live once both are
          complete.
        </p>
      ) : null}
    </div>
  );
}

function Step({
  n,
  title,
  description,
  done,
  locked,
  children,
}: {
  n: number;
  title: string;
  description: string;
  done: boolean;
  locked?: boolean;
  children: React.ReactNode;
}) {
  return (
    <Card className={locked ? "opacity-60" : undefined}>
      <CardHeader>
        <div className="flex items-center gap-2">
          {done ? (
            <CheckCircle2 className="size-5 text-green-600" />
          ) : (
            <Circle className="text-muted-foreground size-5" />
          )}
          <CardTitle className="text-base">
            Step {n}: {title}
          </CardTitle>
        </div>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>{locked ? null : children}</CardContent>
    </Card>
  );
}
