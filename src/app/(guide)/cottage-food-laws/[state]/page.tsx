import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";

import { LegalNotice, VerdictBadge } from "@/components/guide/provenance";
import { ProgramSection } from "@/components/guide/program-section";
import { getStateGuide } from "@/lib/compliance/guide";
import type { OnlineVerdict } from "@/lib/compliance/guide-format";
import { isUsState, stateName } from "@/lib/geo/state";

export async function generateMetadata({
  params,
}: PageProps<"/cottage-food-laws/[state]">): Promise<Metadata> {
  const { state } = await params;
  const code = state.toUpperCase();
  if (!isUsState(code)) return { title: "Not found | Harvest Local" };

  const name = stateName(code);
  return {
    title: `${name} cottage food law — what you can make and sell from home | Harvest Local`,
    description: `${name}'s cottage food rules: which programmes exist, sales caps, licences and inspections, what has to go on the label, and whether you can take orders online. Sourced to the statute.`,
    alternates: { canonical: `/cottage-food-laws/${state.toLowerCase()}` },
  };
}

/**
 * The headline answer, in a sentence, before any of the detail.
 *
 * Scoped to "the programmes we've recorded" rather than to the state, and that is not hedging. A
 * ban takes two quite different shapes: Michigan, Mississippi, Nevada and Washington name the
 * internet and forbid it, while South Dakota and New Hampshire forbid nothing — selling online
 * simply falls outside the licence exemption, and a licensed operation in either state is on a
 * route these pages don't model. "No, this state bans it" would be flatly wrong for the second
 * kind. The programme's own `venue_note`, quoted below, says which one applies.
 */
function onlineSalesHeadline(verdict: OnlineVerdict, name: string, count: number): string {
  switch (verdict) {
    case "allowed":
      return `Yes — ${name} lets a home food business take orders online.`;
    case "banned":
      return count > 1
        ? `Not under any of the ${count} ${name} programmes we've recorded.`
        : `Not under ${name}'s cottage food programme.`;
    case "mixed":
      return `It depends which programme you're on. Some ${name} routes permit online orders and some don't.`;
    case "unclear":
      return `${name}'s rules don't say either way.`;
  }
}

export default async function StateCottageFoodPage({
  params,
}: PageProps<"/cottage-food-laws/[state]">) {
  const { state } = await params;
  const code = state.toUpperCase();
  if (!isUsState(code)) notFound();

  const guide = await getStateGuide(code);
  if (!guide) notFound();

  const name = guide.stateName;
  const multi = guide.programs.length > 1;

  return (
    <div className="space-y-10">
      <nav className="text-muted-foreground text-sm">
        <Link href="/cottage-food-laws" className="hover:underline">
          Cottage food laws
        </Link>{" "}
        / <span className="text-foreground">{name}</span>
      </nav>

      <header className="space-y-4">
        <h1 className="text-3xl font-semibold tracking-tight">{name} cottage food law</h1>
        <p className="text-muted-foreground max-w-2xl">
          What {name} lets you make in a home kitchen and sell, who you have to tell, what goes on
          the label, and whether you can take orders online.
        </p>
      </header>

      {/* The question people actually arrive with. */}
      <section className="space-y-3 rounded-lg border p-6">
        <div className="flex flex-wrap items-center gap-3">
          <h2 className="text-lg font-medium">Can I sell online?</h2>
          <VerdictBadge verdict={guide.onlineSales} />
        </div>
        <p>{onlineSalesHeadline(guide.onlineSales, name, guide.programs.length)}</p>
        {guide.onlineSales === "unclear" ? (
          <p className="text-muted-foreground text-sm">
            That means the statute and rules we read are silent on selling channel — not that
            it&apos;s forbidden. Ask your state before you rely on it either way.
          </p>
        ) : null}
        {guide.onlineSales === "banned" ? (
          <p className="text-muted-foreground text-sm">
            Two different things get recorded as &ldquo;not allowed&rdquo;. Some states name the
            internet and forbid it. In others nothing forbids selling online at all — doing it just
            takes you outside the licence exemption and onto a licensed route these pages
            don&apos;t cover. The quoted rule under each programme below says which applies here.
          </p>
        ) : null}
        {guide.onlineSales === "mixed" ? (
          <p className="text-muted-foreground text-sm">
            This is the reason it matters which programme you&apos;re registered under, not just
            which state you&apos;re in. The per-programme answers are below.
          </p>
        ) : null}
      </section>

      {multi ? (
        <section className="space-y-3">
          <h2 className="text-lg font-medium">
            {name} runs {guide.programs.length} different programmes
          </h2>
          <p className="text-muted-foreground max-w-2xl text-sm">
            They are not tiers of the same scheme — they have different caps, permit different
            foods, and can answer to different regulators. Which one you&apos;re on decides what
            you&apos;re allowed to do.
          </p>
          <ul className="grid gap-2 sm:grid-cols-2">
            {guide.programs.map((p) => (
              <li key={p.program.id}>
                <a
                  href={`#${p.program.id}`}
                  className="hover:bg-muted/50 block rounded-lg border px-4 py-3"
                >
                  <span className="font-medium">{p.program.name}</span>
                  <span className="text-muted-foreground block text-sm">{p.summary}</span>
                </a>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <LegalNotice />

      <div className="space-y-10">
        {guide.programs.map((p) => (
          <ProgramSection key={p.program.id} guide={p} stateName={name} />
        ))}
      </div>

      {!guide.anyVerified ? (
        <section className="space-y-2 rounded-lg border border-dashed p-6">
          <h2 className="font-medium">Nobody has signed off {name} yet</h2>
          <p className="text-muted-foreground text-sm">
            We read {name}&apos;s law and recorded what we found, but no one on our team has done a
            second pass over these rows. Our own checks have turned up seeded errors in both
            directions before — a state recorded as permitting something its statute forbids, and a
            state recorded as banning something on nothing at all. If you know {name}&apos;s rules
            and something here is wrong, we want to hear it.
          </p>
        </section>
      ) : null}

      <section className="space-y-2 rounded-lg border p-6">
        <h2 className="font-medium">A marketplace that knows these rules</h2>
        <p className="text-muted-foreground text-sm">
          Harvest Local runs on the data you just read. It won&apos;t let you publish a listing your
          programme doesn&apos;t permit, it prints a label with your state&apos;s required elements
          and its exact disclaimer wording, and it warns you before you cross a sales cap instead of
          after. $20 a month, no cut of your sales, 90 days free.
        </p>
        <p className="pt-2 text-sm">
          <Link href="/signup?role=seller" className="underline">
            Open a storefront
          </Link>{" "}
          ·{" "}
          <Link href="/cottage-food-laws" className="underline">
            Another state
          </Link>
        </p>
      </section>
    </div>
  );
}
