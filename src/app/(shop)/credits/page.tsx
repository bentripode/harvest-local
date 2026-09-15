import Image from "next/image";
import type { Metadata } from "next";

import { allStockCredits } from "@/lib/stock/photos";

export const metadata: Metadata = {
  title: "Photo credits — Harvest Local",
};

/**
 * Who took the stock photographs. Read straight from `src/lib/stock/credits.json`, which
 * `scripts/pexels.mjs` writes on every download, so a new photo is credited here without anyone
 * remembering to add it.
 */
export default function CreditsPage() {
  const credits = allStockCredits();

  return (
    <div className="mx-auto max-w-2xl space-y-6 py-4 sm:py-8">
      <header className="space-y-2">
        <h1 className="text-2xl sm:text-3xl">Photo credits</h1>
        <p className="text-muted-foreground text-sm">
          The photographs on the home page and the category tiles are stock photos from{" "}
          <a href="https://www.pexels.com" className="underline underline-offset-2">
            Pexels
          </a>
          . They illustrate the marketplace and show nobody&apos;s products here — every photo on a
          listing or a storefront belongs to that seller.
        </p>
      </header>

      <ul className="grid gap-3 sm:grid-cols-2">
        {credits.map((c) => (
          <li key={c.path} className="flex items-center gap-3">
            <Image
              src={c.src}
              width={c.width}
              height={c.height}
              alt=""
              sizes="64px"
              className="size-16 shrink-0 rounded-lg object-cover"
              style={{ backgroundColor: c.avgColor }}
            />
            <span className="text-sm">
              Photo by{" "}
              <a href={c.authorUrl} className="underline underline-offset-2">
                {c.author}
              </a>{" "}
              on{" "}
              <a href={c.pexelsUrl} className="underline underline-offset-2">
                Pexels
              </a>
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
