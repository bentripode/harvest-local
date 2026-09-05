import { Badge } from "@/components/ui/badge";
import { getAllStatePrograms, type StateProgramSummary } from "@/lib/compliance/programs";
import { getUnmappedFoodCategories } from "@/lib/compliance/categories";
import { getProgramReviewStatus } from "@/lib/compliance/programs";
import { stateName } from "@/lib/geo/state";
import { formatUsd, toCents } from "@/lib/money";

export const metadata = { title: "Food programs — Admin" };

/**
 * Read-only view of the seeded cottage-food programs. Editing comes with the enforcement work; the
 * job of this page today is to make the data — and how much of it is unverified — visible.
 */
export default async function AdminProgramsPage() {
  const [states, unmappedCategories, review] = await Promise.all([
    getAllStatePrograms(),
    getUnmappedFoodCategories(),
    getProgramReviewStatus(),
  ]);
  const blocked = states.filter((s) => s.foodSalesBlocked);
  const programCount = states.reduce((n, s) => n + s.programs.length, 0);
  const unverified = states.reduce((n, s) => n + s.programs.filter((p) => !p.verified_at).length, 0);
  const multi = states.filter((s) => s.programs.length > 1);

  return (
    <div className="space-y-8">
      <div className="space-y-3">
        <h1 className="text-2xl font-semibold tracking-tight">State food programs</h1>
        <p className="text-muted-foreground text-sm">
          {programCount} programs across {states.length} jurisdictions. A seller doesn&apos;t operate
          in a state — they operate in a <em>program</em> within a state, and {multi.length} states
          run more than one, with different caps, different permitted foods, and different answers on
          whether online orders are allowed at all.
        </p>

        {unverified > 0 ? (
          <p className="text-destructive border-destructive/30 bg-destructive/5 rounded-lg border p-3 text-sm">
            <strong>
              {unverified} of {programCount} programs are unverified.
            </strong>{" "}
            Seeded from the Institute for Justice state pages on 4 September 2026 — a serious source,
            but a summary rather than statute, and its own pages say so. Nothing here should gate a
            real seller until a human has checked it against the state&apos;s own rules.
          </p>
        ) : null}

        {review.overdue > 0 ? (
          <p className="text-muted-foreground rounded-lg border p-3 text-sm">
            <strong>{review.overdue}</strong> programs were last verified over a year ago. A weekly
            job emails admins about these — laws change, and data that looks settled but isn&apos;t
            is worse than an obvious gap.
          </p>
        ) : null}

        {unmappedCategories.length > 0 ? (
          <div className="rounded-lg border p-3 text-sm">
            <p className="font-medium">
              {unmappedCategories.length} food categories have no regulatory axis mapped
            </p>
            <p className="text-muted-foreground mt-1">
              {unmappedCategories.map((c) => c.name).join(", ")} — the category gate does not fire
              for these. Deciding which of the six axes a category implicates is a judgement, and a
              wrong one either blocks legal trade or permits illegal trade, so they were left unset
              rather than guessed. The licence and permit gates still apply.
            </p>
          </div>
        ) : null}

        {blocked.length > 0 ? (
          <div className="rounded-lg border p-3 text-sm">
            <p className="font-medium">
              Online food sales are banned outright in {blocked.length} jurisdictions
            </p>
            <p className="text-muted-foreground mt-1">
              {blocked.map((s) => stateName(s.stateCode)).join(", ")} — every program in those states
              prohibits taking orders online. Sellers there can list non-food goods only.
            </p>
          </div>
        ) : null}
      </div>

      <ul className="space-y-4">
        {states.map((state) => (
          <StateCard key={state.stateCode} state={state} />
        ))}
      </ul>
    </div>
  );
}

function StateCard({ state }: { state: StateProgramSummary }) {
  return (
    <li className="rounded-lg border p-4">
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="text-sm font-medium">{stateName(state.stateCode)}</h2>
        <span className="text-muted-foreground font-mono text-xs">{state.stateCode}</span>
        {state.foodSalesBlocked ? <Badge variant="destructive">no online food sales</Badge> : null}
        {state.programs.length > 1 ? (
          <Badge variant="secondary">{state.programs.length} programs</Badge>
        ) : null}
      </div>

      <ul className="mt-3 divide-y rounded-md border">
        {state.programs.map((p) => (
          <li key={p.id} className="space-y-1.5 p-3 text-sm">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-medium">{p.name}</span>
              <Badge variant={p.online_orders === "allowed" ? "default" : "destructive"}>
                online {p.online_orders}
              </Badge>
              {p.mail_delivery !== "allowed" ? (
                <Badge variant="outline">mail {p.mail_delivery}</Badge>
              ) : null}
              {p.verified_at ? null : <Badge variant="outline">unverified</Badge>}
            </div>

            <p className="text-muted-foreground">
              {p.cap_basis === "none" ? (
                "No sales cap"
              ) : (
                <>
                  {formatUsd(toCents(p.revenue_cap ?? "0"))}{" "}
                  {p.cap_basis === "per_product"
                    ? "per product"
                    : p.cap_basis === "per_category"
                      ? "per category"
                      : "a year"}
                </>
              )}
              {p.license_threshold ? (
                <> · licence needed above {formatUsd(toCents(p.license_threshold))}</>
              ) : null}
              {" · "}
              licence {p.license_required}
              {p.inspection_required ? " · inspection required" : ""}
              {p.training_required !== "no" ? ` · training ${p.training_required}` : ""}
              {p.recipe_approval !== "no" ? ` · recipe approval ${p.recipe_approval}` : ""}
            </p>

            {p.cap_note ? <p className="text-muted-foreground">{p.cap_note}</p> : null}
            {p.mail_note ? <p className="text-muted-foreground">Mail: {p.mail_note}</p> : null}
            {p.category_note ? (
              <p className="text-muted-foreground">Categories: {p.category_note}</p>
            ) : null}
            {p.venue_note ? <p className="text-muted-foreground">Venues: {p.venue_note}</p> : null}
          </li>
        ))}
      </ul>
    </li>
  );
}
