import Link from "next/link";
import type { Metadata } from "next";

import { LegalNotice, VerdictBadge } from "@/components/guide/provenance";
import { getStateIndex } from "@/lib/compliance/guide";

export const metadata: Metadata = {
  title: "Cottage food laws by state | Harvest Local",
  description:
    "What every US state allows a home food business to make and sell — programmes, sales caps, licences, labelling rules, and whether you can take orders online. Free, with a source link on every claim.",
  alternates: { canonical: "/cottage-food-laws" },
};

export default async function CottageFoodLawsIndex() {
  const states = await getStateIndex();

  const bannedCount = states.filter((s) => s.onlineSales === "banned").length;
  const multiProgramme = states.filter((s) => s.programCount > 1).length;

  return (
    <div className="space-y-10">
      <header className="space-y-4">
        <h1 className="text-3xl font-semibold tracking-tight">Cottage food laws, state by state</h1>
        <p className="text-muted-foreground max-w-2xl">
          What you&apos;re allowed to make at home and sell, in all 50 states and DC — the
          programmes each state runs, what they cap your sales at, whether you need a licence or an
          inspection, what has to go on the label, and whether you can take orders online at all.
        </p>
        <p className="text-muted-foreground max-w-2xl text-sm">
          Free and no account needed. We read the statutes and rules ourselves rather than
          summarising somebody else&apos;s summary, and every claim links to the document it came
          from.
        </p>
      </header>

      <section className="grid gap-4 sm:grid-cols-3">
        <Stat value={String(states.length)} label="jurisdictions" />
        <Stat
          value={String(multiProgramme)}
          label="states that run more than one programme, with different rules in each"
        />
        {/* Scoped precisely: in some of these nothing forbids online selling, it just takes you
            out of the exemption. The state page explains which is which. */}
        <Stat
          value={String(bannedCount)}
          label="states where no programme we've recorded permits selling online"
        />
      </section>

      <LegalNotice />

      <section className="space-y-4">
        <h2 className="text-lg font-medium">Pick your state</h2>
        <p className="text-muted-foreground text-sm">
          The badge says whether that state lets a home food business take orders online — which is
          not the same question as whether it lets you cook at home.
        </p>
        <ul className="grid gap-2 sm:grid-cols-2">
          {states.map((s) => (
            <li key={s.stateCode}>
              <Link
                href={`/cottage-food-laws/${s.stateCode.toLowerCase()}`}
                className="hover:bg-muted/50 focus-visible:ring-ring flex items-center justify-between gap-3 rounded-lg border px-4 py-3 focus-visible:ring-2 focus-visible:outline-none"
              >
                <span>
                  <span className="font-medium">{s.stateName}</span>
                  <span className="text-muted-foreground text-sm">
                    {" "}
                    · {s.programCount} programme{s.programCount === 1 ? "" : "s"}
                  </span>
                </span>
                <VerdictBadge verdict={s.onlineSales} />
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <section className="space-y-2 rounded-lg border p-6">
        <h2 className="font-medium">Selling in a state that allows it?</h2>
        <p className="text-muted-foreground text-sm">
          Harvest Local is a marketplace built on these rules. It won&apos;t let you publish a
          listing your state doesn&apos;t permit, it prints a label that matches your programme, and
          it tells you when a filing is due. $20 a month, no commission, 90-day trial.
        </p>
        <p className="pt-2 text-sm">
          <Link href="/sell" className="underline">
            Open a storefront
          </Link>{" "}
          ·{" "}
          <Link href="/shop" className="underline">
            See what people are selling
          </Link>
        </p>
      </section>
    </div>
  );
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div className="rounded-lg border p-4">
      <p className="text-2xl font-semibold tabular-nums">{value}</p>
      <p className="text-muted-foreground pt-1 text-sm">{label}</p>
    </div>
  );
}
