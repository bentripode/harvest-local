import Link from "next/link";
import type { Metadata } from "next";

import { Citation, Provenance } from "@/components/guide/provenance";
import { getBrowseState } from "@/lib/geo/browse-state";
import { getPitchExample } from "@/lib/compliance/pitch-example";
import { stripeConfig } from "@/lib/stripe/config";

const PRICE = stripeConfig.sellerMonthlyUsd;
const TRIAL = stripeConfig.sellerTrialDays;

export const metadata: Metadata = {
  title: "Sell on Harvest Local — a marketplace that knows your state's cottage food law",
  description: `$${PRICE} a month, no commission, ${TRIAL} days free. We won't let you publish a listing your state doesn't permit, and we print a label that matches your programme.`,
  alternates: { canonical: "/sell" },
};

export default async function SellPage() {
  const { state } = await getBrowseState();
  const example = state ? await getPitchExample(state) : null;

  return (
    <div className="space-y-14">
      <header className="space-y-5">
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
          Sell what you make. We&apos;ll keep you legal.
        </h1>
        <p className="text-muted-foreground max-w-2xl text-lg">
          A marketplace for people who cook, bake, grow and make at home — built on a reading of
          all 51 jurisdictions&apos; cottage food law, so the rules are enforced by the software
          instead of remembered by you.
        </p>
        <div className="flex flex-wrap gap-3">
          <Stat value={`$${PRICE}`} label="a month" />
          <Stat value="0%" label="commission — we never take a cut of a sale" />
          <Stat value={`${TRIAL} days`} label="free, no card up front" />
        </div>
        <p>
          <Link
            href="/signup?role=seller"
            className="bg-primary text-primary-foreground inline-flex h-11 items-center rounded-lg px-6 font-medium"
          >
            Open a storefront
          </Link>
        </p>
      </header>

      {/* ---------------------------------------------------------------- */}
      {/* The differentiator, demonstrated rather than asserted. */}
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold tracking-tight">
          We will not let you publish a listing that&apos;s illegal in your state
        </h2>
        <p className="text-muted-foreground max-w-2xl">
          No other marketplace can write that sentence, because no other marketplace has read the
          law. Here is one of ours, live from the same data the listing gate uses — follow the link
          and check us.
        </p>

        {example ? (
          <div className="space-y-3 rounded-lg border p-6">
            <p className="font-medium">{example.headline}</p>
            <Citation text={example.citation} />
            <p className="text-muted-foreground text-sm">{example.effect}</p>
            <Provenance
              sourceUrl={example.sourceUrl}
              sourceCheckedAt={example.sourceCheckedAt}
              verifiedAt={example.verifiedAt}
            />
            <p className="text-sm">
              <Link
                href={`/cottage-food-laws/${example.stateCode.toLowerCase()}`}
                className="underline"
              >
                All of {example.stateName}&apos;s rules
              </Link>
            </p>
          </div>
        ) : (
          <div className="space-y-2 rounded-lg border p-6">
            <p className="font-medium">Pick your state and see what applies to you.</p>
            <p className="text-sm">
              <Link href="/cottage-food-laws" className="underline">
                Cottage food laws, state by state
              </Link>{" "}
              — free, no account.
            </p>
          </div>
        )}

        <ul className="grid gap-3 sm:grid-cols-2">
          <Point title="The label prints itself">
            Your state&apos;s required elements, its exact disclaimer wording at the point size the
            rule specifies, and a refusal to print at all if something&apos;s missing — naming the
            field instead of leaving a gap.
          </Point>
          <Point title="We warn you before the cap, not after">
            Your programme&apos;s sales limit, tracked as orders complete, with a heads-up at 50,
            75 and 90 percent. We also know the difference between a cap that means stop and a
            threshold that means get a licence.
          </Point>
          <Point title="Deadlines you&apos;d otherwise miss">
            Licence expiry at 30, 7 and 1 day. Annual filings and renewals for the programmes whose
            text we&apos;ve read.
          </Point>
          <Point title="The programme, not just the state">
            California, Oregon, Utah and Vermont run three or four each, and they don&apos;t permit
            the same things. We ask which one you&apos;re on and hold you to that one.
          </Point>
        </ul>
      </section>

      {/* ---------------------------------------------------------------- */}
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold tracking-tight">What it costs, honestly</h2>
        <p className="text-muted-foreground max-w-2xl">
          We are not the cheapest. We are the cheapest that doesn&apos;t take a cut, and the only
          one that reads the law. Card processing is the same wherever you sell, so this compares
          what the platform itself takes.
        </p>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[540px] border-collapse text-sm">
            <caption className="text-muted-foreground pb-2 text-left text-xs">
              Platform take per month, excluding card processing
            </caption>
            <thead>
              <tr className="border-b-2">
                <th className="py-2 text-left font-medium">You sell</th>
                <th className="py-2 text-left font-medium">Harvest Local</th>
                <th className="py-2 text-left font-medium">A 15% + $0.25 marketplace</th>
                <th className="py-2 text-left font-medium">A $10 flat storefront</th>
              </tr>
            </thead>
            <tbody className="tabular-nums">
              <CostRow gross={500} orders={10} />
              <CostRow gross={2000} orders={40} />
              <CostRow gross={5000} orders={100} />
            </tbody>
          </table>
        </div>

        <p className="text-muted-foreground max-w-2xl text-sm">
          The flat-fee storefront is genuinely $10 cheaper than us. What the extra buys is
          everything in the section above — nobody at that price has read a statute. Against a
          commission marketplace the arithmetic speaks for itself, and it gets worse for them the
          better your month is.
        </p>
      </section>

      {/* ---------------------------------------------------------------- */}
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold tracking-tight">Who does what</h2>
        <div className="grid gap-6 sm:grid-cols-2">
          <div className="space-y-2 rounded-lg border p-5">
            <h3 className="font-medium">Your job</h3>
            <ul className="text-muted-foreground space-y-1.5 text-sm">
              <li>Make the thing.</li>
              <li>Photograph it and set a price.</li>
              <li>Tell us the ingredients, the allergens and the weight — once, per listing.</li>
              <li>Say where and when people can collect.</li>
              <li>Get whatever licence your programme requires. We&apos;ll tell you which.</li>
            </ul>
          </div>
          <div className="space-y-2 rounded-lg border p-5">
            <h3 className="font-medium">Our job</h3>
            <ul className="text-muted-foreground space-y-1.5 text-sm">
              <li>Know your state&apos;s rules and stop you breaking them.</li>
              <li>Print a compliant label, and refuse to print a wrong one.</li>
              <li>Take the money, handle the tax calculation, pay you out.</li>
              <li>Work out the delivery fee from the driving distance.</li>
              <li>Put you on the page for every market you have a stall at.</li>
              <li>Tell your followers when you list something.</li>
            </ul>
          </div>
        </div>
      </section>

      {/* ---------------------------------------------------------------- */}
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold tracking-tight">The questions people actually ask</h2>
        <div className="divide-y rounded-lg border">
          <Faq q="What does it cost, all in?">
            ${PRICE} a month and nothing else from us — no commission, no listing fees, no fee on
            delivery. The only other cost is card processing, which goes to Stripe and not to us,
            and which you&apos;d pay on any platform. {TRIAL} days free to start, no card needed.
          </Faq>
          <Faq q="I already sell on Facebook and text. Why do I need this?">
            You probably don&apos;t need to stop. What you get is a link that takes the order and
            the money without a back-and-forth, and a label that matches your state&apos;s rules.
            Plenty of sellers run both for a while.
          </Faq>
          <Faq q="I'm not technical.">
            Take a photo, type a price, press publish. If your state needs something on the label
            that you haven&apos;t entered, we say which field and where — we don&apos;t leave you
            to find out from an inspector.
          </Faq>
          <Faq q="Do you handle sales tax?">
            We calculate it at checkout through Stripe Tax, based on where the order is collected.
            We do not file or remit it — you are the merchant of record for your own sales, which
            is deliberate: it keeps your tax position yours rather than ours. Some platforms remit
            on your behalf; that also makes them the taxpayer.
          </Faq>
          <Faq q="Can I ship?">
            No. Harvest Local is pickup and local delivery only, inside one state. That is not a
            gap we plan to close — most cottage food programmes permit a narrow list of venues, and
            several forbid mail order outright.
          </Faq>
          <Faq q="Why only my own state?">
            Because cottage food exemptions are state law and almost none of them reach across a
            state line. We enforce it in three places — the database refuses to store a cross-state
            order at all — so it isn&apos;t something a bug can undo.
          </Faq>
          <Faq q="What if your reading of the law is wrong?">
            It might be. Nearly every row is our reading rather than a state&apos;s sign-off, and we
            say so on the page, on the block, and in the email. Every claim links to the document it
            came from so you can check it, and our own checks have found rows wrong in both
            directions. Tell us and we&apos;ll fix it.
          </Faq>
          <Faq q="Is there an app?">
            Not yet. The site works on a phone; there&apos;s nothing to download.
          </Faq>
          <Faq q="What happens when I sell at a market?">
            Add the market as a pickup point and you appear on its page, with your stall times.
            People following that market hear about it.
          </Faq>
          <Faq q="Can I stop for the winter?">
            Yes. Pause the storefront and it stays up, read-only, with your reviews and your link
            intact. Cancel outright whenever you like — no contract, no notice period.
          </Faq>
          <Faq q="How do I get paid?">
            Stripe pays into your bank on their standard schedule for your account. We never hold
            your money: charges are made on your behalf, so you are the merchant of record.
          </Faq>
        </div>
      </section>

      <section className="space-y-3 rounded-lg border p-6">
        <h2 className="text-xl font-semibold tracking-tight">
          {TRIAL} days free. No card, no contract.
        </h2>
        <p className="text-muted-foreground text-sm">
          Long enough to see a whole season. If it isn&apos;t for you, close it and nothing has
          changed.
        </p>
        <p className="pt-1 text-sm">
          <Link href="/signup?role=seller" className="underline">
            Open a storefront
          </Link>{" "}
          ·{" "}
          <Link href="/cottage-food-laws" className="underline">
            Read your state&apos;s rules first
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

/**
 * The arithmetic, computed rather than typed, so the three columns cannot drift apart in prose.
 * The competitor figures are their published rates: 15% + $0.25 per sale on top of a ~$20
 * subscription, and $10 flat.
 */
function CostRow({ gross, orders }: { gross: number; orders: number }) {
  const ours = PRICE;
  const commission = 19.99 + gross * 0.15 + orders * 0.25;
  const flat = 10;

  return (
    <tr className="border-b last:border-0">
      <th scope="row" className="py-2 pr-4 text-left font-normal">
        ${gross.toLocaleString()} over {orders} orders
      </th>
      <td className="py-2 pr-4 font-medium">${ours}</td>
      <td className="py-2 pr-4">${Math.round(commission).toLocaleString()}</td>
      <td className="py-2 pr-4">${flat}</td>
    </tr>
  );
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div className="rounded-lg border px-4 py-3">
      <p className="text-xl font-semibold">{value}</p>
      <p className="text-muted-foreground text-sm">{label}</p>
    </div>
  );
}

function Point({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <li className="rounded-lg border p-4">
      <p className="font-medium">{title}</p>
      <p className="text-muted-foreground pt-1 text-sm">{children}</p>
    </li>
  );
}

function Faq({ q, children }: { q: string; children: React.ReactNode }) {
  return (
    <details className="group p-4">
      <summary className="cursor-pointer list-none font-medium">
        <span className="group-open:hidden">+ </span>
        <span className="hidden group-open:inline">− </span>
        {q}
      </summary>
      <p className="text-muted-foreground pt-2 text-sm">{children}</p>
    </details>
  );
}
