import { stateName } from "@/lib/geo/state";
import type { FoodSalesStatus } from "@/lib/compliance/food-sales";

/**
 * Shown to a seller whose state bans online cottage-food sales. It has to do two jobs: say plainly
 * that food cannot be listed, and make clear the storefront is otherwise fine — someone who came
 * here to sell candles should not think they've been shut down.
 */
export function FoodSalesNotice({ status }: { status: FoodSalesStatus | null }) {
  if (!status || status.allowed) return null;

  return (
    <div className="border-destructive/30 bg-destructive/5 rounded-lg border p-4 text-sm">
      <p className="text-destructive font-medium">
        {stateName(status.stateCode)} doesn&apos;t allow homemade food to be sold through online
        orders
      </p>
      <p className="text-muted-foreground mt-1">
        Every cottage-food program in {stateName(status.stateCode)} prohibits taking orders online,
        so food listings can&apos;t be published on Harvest Local from here. This isn&apos;t a
        restriction we chose — it&apos;s your state&apos;s law, and it applies wherever you sell
        online.
      </p>
      <p className="text-muted-foreground mt-2">
        Everything else works normally. Candles, soap, flowers, textiles, woodwork and other non-food
        goods can be listed and sold as usual.
      </p>
    </div>
  );
}
