import type { MarketPhoto } from "@/lib/markets/places";

/**
 * A Google Places photograph of a market, with the credit that licenses it.
 *
 * The credit is not decoration and is not collapsible. Google's policy requires that we "always
 * credit the author... using all available resources (avatar, name, and profile link) when space
 * allows", and that "end-users must always have access to view the individual source photo... on
 * Google Maps using the provided googleMapsUri". There is deliberately no prop to hide either, and
 * `getMarketPhoto` returns null rather than hand back a photo whose author is unknown — so a
 * picture without a name attached cannot reach this component in the first place.
 *
 * `unoptimized`, and a plain `<img>` rather than `next/image`: the src is our redirect to a Google
 * URL that changes, and running it through the image optimiser would write a copy into Next's
 * cache on disk — storing Places content, which is exactly what we may not do.
 */
export function MarketGooglePhoto({ photo, alt }: { photo: MarketPhoto; alt: string }) {
  return (
    <figure className="space-y-1.5">
      <div className="bg-muted relative overflow-hidden rounded-xl border">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={photo.src}
          alt={alt}
          width={photo.width}
          height={photo.height}
          loading="lazy"
          className="aspect-[16/9] w-full object-cover"
        />
      </div>
      <figcaption className="text-muted-foreground flex flex-wrap items-center gap-x-1.5 text-xs">
        <span>Photo by</span>
        {photo.credit.profileUrl ? (
          <a
            href={photo.credit.profileUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-foreground underline underline-offset-2"
          >
            {photo.credit.name}
          </a>
        ) : (
          <span className="text-foreground">{photo.credit.name}</span>
        )}
        {photo.sourceUrl ? (
          <>
            <span aria-hidden>·</span>
            <a
              href={photo.sourceUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="underline underline-offset-2"
            >
              View on Google Maps
            </a>
          </>
        ) : null}
      </figcaption>
    </figure>
  );
}
