import Link from "next/link";
import { redirect } from "next/navigation";

import { FoodSalesNotice } from "@/components/food-sales-notice";
import { ProgramPicker, type PickerProgram } from "@/components/program-picker";
import { getSellerContext } from "@/lib/auth";
import { getFoodSalesStatus } from "@/lib/compliance/food-sales";
import {
  getChosenProgram,
  getIntendedCategories,
  getProgramChoices,
  programRequirements,
  programSummary,
} from "@/lib/compliance/onboarding";
import { stateName } from "@/lib/geo/state";

export const metadata = { title: "Your food program — Harvest Local" };

const AXIS_COLUMN = {
  shelf_stable: "cat_shelf_stable",
  refrigerated: "cat_refrigerated",
  meat: "cat_meat",
  acidified: "cat_acidified",
  low_acid_canned: "cat_low_acid_canned",
  fermented: "cat_fermented",
} as const;

/**
 * The part of onboarding that teaches the law by asking questions.
 *
 * Someone who has never heard the phrase "cottage food" should get to a compliant storefront by
 * answering what they want to make. The state comes from their storefront details, so the first
 * thing this page can do — and does, immediately — is tell them if their state bans online food
 * sales outright, rather than letting them work through the whole flow to find out.
 */
export default async function FoodProgramPage() {
  const { profile, seller } = await getSellerContext();
  if (profile.role === "buyer") redirect("/");
  if (!seller) redirect("/seller/onboarding");

  const [categories, choices, chosen, foodSales] = await Promise.all([
    getIntendedCategories(),
    // Annotation for the banned-axis badges happens client-side as the seller ticks categories, so
    // the server pass asks for no axes.
    getProgramChoices(seller.id, []),
    getChosenProgram(seller.id),
    getFoodSalesStatus(seller.id),
  ]);

  const programs: PickerProgram[] = choices.map(({ program }) => ({
    id: program.id,
    name: program.name,
    summary: programSummary(program),
    onlineOrders: program.online_orders,
    venueNote: program.venue_note,
    categoryNote: program.category_note,
    bannedAxes: Object.entries(AXIS_COLUMN)
      .filter(([, column]) => (program[column] as string) === "banned")
      .map(([axis]) => axis),
    requirements: programRequirements(program),
  }));

  return (
    <div className="mx-auto max-w-2xl space-y-8">
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">Selling food in {stateName(seller.home_state)}</h1>
        <p className="text-muted-foreground text-sm">
          Homemade food is regulated state by state. {stateName(seller.home_state)} decides what you
          may sell, whether you need a permit, and whether you can take orders online at all.
          Answering a couple of questions here sets up the rest of your storefront correctly.
        </p>
      </div>

      <FoodSalesNotice status={foodSales} />

      {foodSales?.allowed === false ? (
        <p className="text-muted-foreground text-sm">
          You can still{" "}
          <Link href="/seller/products/new" className="text-primary underline">
            list non-food goods
          </Link>{" "}
          — candles, soap, flowers, textiles and crafts are unaffected.
        </p>
      ) : programs.length === 0 ? (
        <p className="text-muted-foreground rounded-lg border border-dashed p-4 text-sm">
          We don&apos;t have {stateName(seller.home_state)}&apos;s cottage food programs on file yet.
          Nothing is blocked, but check your state&apos;s own rules before selling food.
        </p>
      ) : (
        <ProgramPicker
          categories={categories.map((c) => ({ id: c.id, name: c.name, axes: c.axes }))}
          programs={programs}
          chosenId={chosen?.id ?? null}
        />
      )}

      <p className="text-muted-foreground border-t pt-4 text-xs">
        These rules are drawn from a public summary of each state&apos;s law, not from the statutes
        themselves, and they change. Treat this as a starting point and confirm anything that
        matters with {stateName(seller.home_state)}&apos;s own guidance.
      </p>
    </div>
  );
}
