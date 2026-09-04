import { Badge } from "@/components/ui/badge";
import { StateRuleForm } from "@/components/state-rule-form";
import { getStateRules, type StateRule } from "@/lib/admin/state-rules";
import { stateName } from "@/lib/geo/state";

export const metadata = { title: "State rules — Admin" };

export default async function AdminStatesPage() {
  const rules = await getStateRules();
  const unverified = rules.filter((r) => !r.verifiedAt);
  const verified = rules.filter((r) => r.verifiedAt);

  return (
    <div className="space-y-8">
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">State cottage-food rules</h1>
        <p className="text-muted-foreground text-sm">
          The annual gross-sales cap each seller is held to. When a seller crosses their state&apos;s
          cap, <code className="text-xs">record_order_revenue</code> pauses their storefront for the
          rest of the year — automatically, in SQL. These numbers have teeth.
        </p>
        {unverified.length > 0 ? (
          <p className="text-destructive rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm">
            <strong>
              {unverified.length} of {rules.length} states are still the seeded placeholder
            </strong>{" "}
            — one invented $50,000 cap copied across every state, and no licence requirement
            recorded anywhere. Until a state is verified, it is enforcing a number nobody checked.
            Saving a state marks it verified, so enter figures you have actually sourced.
          </p>
        ) : (
          <p className="rounded-lg border p-3 text-sm text-green-700">
            All {rules.length} states verified.
          </p>
        )}
      </div>

      <Section title={`Unverified (${unverified.length})`} rules={unverified} />
      {verified.length > 0 ? <Section title={`Verified (${verified.length})`} rules={verified} /> : null}
    </div>
  );
}

function Section({ title, rules }: { title: string; rules: StateRule[] }) {
  if (rules.length === 0) return null;

  return (
    <section className="space-y-3">
      <h2 className="text-sm font-medium">{title}</h2>
      <ul className="divide-y rounded-lg border">
        {rules.map((r) => (
          <li key={r.stateCode} className="space-y-2 p-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm font-medium">
                {stateName(r.stateCode)}{" "}
                <span className="text-muted-foreground font-mono text-xs">{r.stateCode}</span>
              </span>
              {r.verifiedAt ? (
                <Badge variant="default">
                  verified{" "}
                  {new Date(r.verifiedAt).toLocaleDateString(undefined, { dateStyle: "medium" })}
                </Badge>
              ) : (
                <Badge variant="destructive">placeholder</Badge>
              )}
            </div>
            <StateRuleForm rule={r} />
          </li>
        ))}
      </ul>
    </section>
  );
}
