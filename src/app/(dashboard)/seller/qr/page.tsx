import Link from "next/link";
import { redirect } from "next/navigation";

import { QrCard } from "@/components/qr-card";
import { getSellerContext } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { buildQrTargets, type QrLevel } from "@/lib/qr/generate";
import { getSellerPickupLocations } from "@/lib/orders/pickup";

export const metadata = { title: "QR codes — Harvest Local" };

/**
 * Codes for the booth.
 *
 * Every target here is a page on our own site that belongs to this seller. There is deliberately no
 * free-text URL box: a QR generator that will encode anything is a phishing tool with our name on
 * it, and the useful cases — the storefront, a listing, the market you're standing in — are all
 * things we already know.
 */
export default async function SellerQrPage({ searchParams }: PageProps<"/seller/qr">) {
  const { profile, seller } = await getSellerContext();
  if (profile.role === "buyer") redirect("/");
  if (!seller) redirect("/seller/onboarding");

  const sp = await searchParams;
  const level: QrLevel = sp?.level === "H" ? "H" : "M";

  const supabase = await createClient();
  const [{ data: products }, locations] = await Promise.all([
    supabase
      .from("products")
      .select("id, title")
      .eq("seller_id", seller.id)
      .eq("status", "active")
      .order("title"),
    getSellerPickupLocations(seller.id),
  ]);

  const markets = locations
    .filter((l) => l.market && l.isActive)
    .map((l) => l.market!)
    .filter((m, i, all) => all.findIndex((x) => x.id === m.id) === i);

  const targets = await buildQrTargets(
    [
      { key: "storefront", label: "My storefront", path: `/s/${seller.storefront_slug}` },
      ...(products ?? []).map((p) => ({
        key: `p-${p.id}`,
        label: p.title,
        // Listings live on the storefront, so a product code lands there with the item in view.
        path: `/s/${seller.storefront_slug}#${p.id}`,
      })),
      ...markets.map((m) => ({
        key: `m-${m.id}`,
        label: `${m.name} (market page)`,
        path: `/markets/${m.state.toLowerCase()}/${m.slug}`,
      })),
    ],
    level,
  );

  const storefront = targets[0];
  const rest = targets.slice(1);

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <div className="print:hidden">
        <h1 className="text-2xl sm:text-3xl">QR codes</h1>
        <p className="text-muted-foreground text-sm">
          Put one on your booth sign, your packaging or a card by the till. Someone who came for
          bread on Saturday can order on Thursday.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-3 text-sm print:hidden">
        <span className="text-muted-foreground">Error correction:</span>
        <Link
          href="/seller/qr"
          className={`rounded-md border px-3 py-1 ${level === "M" ? "border-primary bg-primary/5 font-medium" : ""}`}
        >
          Standard
        </Link>
        <Link
          href="/seller/qr?level=H"
          className={`rounded-md border px-3 py-1 ${level === "H" ? "border-primary bg-primary/5 font-medium" : ""}`}
        >
          Tough
        </Link>
        <span className="text-muted-foreground text-xs">
          &ldquo;Tough&rdquo; still scans with a fold or a coffee ring across it — worth it for
          anything that gets handled.
        </span>
      </div>

      <section className="space-y-3">
        <h2 className="text-sm font-medium print:hidden">Your storefront</h2>
        <div className="mx-auto max-w-sm">
          <QrCard
            label={storefront.label}
            url={storefront.url}
            svg={storefront.svg}
            businessName={seller.business_name}
          />
        </div>
        {/* The printable artifact: the code plus the two lines that make a stranger scan it. */}
        <div className="mx-auto hidden max-w-sm text-center print:block">
          <p className="text-2xl font-semibold">{seller.business_name}</p>
          <p className="text-lg">Order ahead — scan to see what&apos;s available</p>
          <p className="text-sm">{storefront.url}</p>
        </div>
      </section>

      {rest.length > 0 ? (
        <section className="space-y-3 print:hidden">
          <h2 className="text-sm font-medium">Individual pages</h2>
          <p className="text-muted-foreground text-sm">
            A code per listing, for packaging or a shelf card — and one for each market you have a
            stall at, so someone can find the whole market again.
          </p>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {rest.map((t) => (
              <QrCard
                key={t.key}
                label={t.label}
                url={t.url}
                svg={t.svg}
                businessName={seller.business_name}
              />
            ))}
          </div>
        </section>
      ) : null}

      <p className="text-muted-foreground text-sm print:hidden">
        SVG prints at any size without going fuzzy — give a print shop that one if you can. The PNG
        is 2048px square for anywhere that won&apos;t take vector. Print this page for a ready-made
        booth sign.
      </p>
    </div>
  );
}
