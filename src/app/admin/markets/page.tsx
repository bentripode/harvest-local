import Link from "next/link";

import { MarketLogoRow, type LogoRowMarket } from "@/components/market-logo-row";
import { createClient } from "@/lib/supabase/server";
import { facebookToShow, matchesMarket, parseQuery, websiteToShow } from "@/lib/markets/directory";
import { isUsState, stateName, US_STATES } from "@/lib/geo/state";

export const metadata = { title: "Market pictures — Admin" };

/**
 * Market pictures by hand. The website scan copies a market's own link-preview image, but many
 * markets live only on Facebook, which forbids automated collection — so a person opens the page,
 * saves the logo, and uploads it here. Uploaded pictures are marked `image_source = 'admin'` and
 * the scan never replaces or clears them (20260915100000).
 *
 * Markets with a Facebook page and no picture come first: that is where a logo is one click away.
 */
export default async function AdminMarketsPage({ searchParams }: PageProps<"/admin/markets">) {
  const sp = await searchParams;
  const state = typeof sp.state === "string" && isUsState(sp.state.toUpperCase()) ? sp.state.toUpperCase() : "TX";
  const show = sp.show === "all" ? "all" : "missing";
  const q = parseQuery(sp.q);

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("markets")
    .select(
      "id, slug, name, city, state, postal_code, address_text, website_url, website_status, facebook_url, image_url, image_source, image_source_url",
    )
    .eq("state", state)
    .order("name")
    .limit(2000);
  if (error) throw new Error(error.message);

  const all = data ?? [];
  const withPicture = all.filter((m) => m.image_url).length;
  const rows: LogoRowMarket[] = all
    .filter((m) => (show === "missing" ? !m.image_url : true))
    .filter((m) =>
      matchesMarket(
        { name: m.name, city: m.city, postalCode: m.postal_code, addressText: m.address_text },
        q,
      ),
    )
    .map((m) => ({
      id: m.id,
      name: m.name,
      city: m.city,
      state: m.state,
      slug: m.slug,
      websiteUrl: websiteToShow(m.website_url, m.website_status),
      facebookUrl: facebookToShow(m.facebook_url),
      imageUrl: m.image_url,
      imageSource: m.image_source,
      imageSourceUrl: m.image_source_url,
    }))
    .sort((a, b) => Number(!!b.facebookUrl) - Number(!!a.facebookUrl) || a.name.localeCompare(b.name));

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h1 className="text-2xl sm:text-3xl">Market pictures</h1>
        <p className="text-muted-foreground text-sm">
          {withPicture} of {all.length} {stateName(state)} markets have a picture. Open a market&apos;s
          Facebook page or website, save its logo, and upload it here — it is resized to 480px and
          recorded with the page it came from. The website scan never replaces a picture uploaded
          here. Use the market&apos;s own logo or a photo of the market itself, never a stock photo.
        </p>
      </div>

      <form className="flex flex-wrap items-end gap-3" method="get">
        <label className="space-y-1 text-sm">
          <span className="block">State</span>
          <select
            name="state"
            defaultValue={state}
            className="border-input bg-background h-9 rounded-md border px-2 text-sm"
          >
            {US_STATES.map((s) => (
              <option key={s} value={s}>
                {stateName(s)}
              </option>
            ))}
          </select>
        </label>
        <label className="min-w-0 flex-1 basis-48 space-y-1 text-sm">
          <span className="block">Search</span>
          <input
            name="q"
            defaultValue={q}
            placeholder="Name, town or ZIP"
            className="border-input bg-background h-9 w-full rounded-md border px-2 text-sm"
          />
        </label>
        <label className="space-y-1 text-sm">
          <span className="block">Show</span>
          <select
            name="show"
            defaultValue={show}
            className="border-input bg-background h-9 rounded-md border px-2 text-sm"
          >
            <option value="missing">Without a picture</option>
            <option value="all">All markets</option>
          </select>
        </label>
        <button type="submit" className="bg-primary text-primary-foreground h-9 rounded-md px-4 text-sm">
          Show
        </button>
      </form>

      <p className="text-muted-foreground text-sm">
        {rows.length} {rows.length === 1 ? "market" : "markets"}
        {rows.some((r) => r.facebookUrl) ? " — those with a Facebook page first." : "."}
      </p>

      {rows.length === 0 ? (
        <p className="text-muted-foreground rounded-xl border border-dashed p-6 text-center text-sm">
          Nothing to show.{" "}
          <Link href={`/admin/markets?state=${state}&show=all`} className="underline">
            See all {stateName(state)} markets
          </Link>
        </p>
      ) : (
        <ul className="space-y-3">
          {rows.map((m) => (
            <MarketLogoRow key={m.id} market={m} />
          ))}
        </ul>
      )}
    </div>
  );
}
