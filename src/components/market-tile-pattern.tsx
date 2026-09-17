/**
 * The drawn backdrop on a market tile, for the 88% of markets with no photograph of their own.
 *
 * Deliberately line art and deliberately not a photograph. A stock picture of *a* farmers market
 * sitting under the heading "Abbeville Farmers Market" reads as a picture OF Abbeville Farmers
 * Market — that is the rule in CLAUDE.md, and the Commons sweep demonstrated it going wrong for
 * real when a photograph of Petersburg, Virginia was offered for a market in Petersburg, Alaska.
 * A drawing claims nothing. It just stops the card being a grey box.
 *
 * Everything here is inline SVG: no network request, no dependency, no layout shift, and it themes
 * itself because every stroke is `currentColor` and the parent sets the colour from a token.
 *
 * Pattern ids are namespaced per market. Two cards on one page both defining `#stripes` would have
 * the second silently adopt the first's geometry, which is the sort of bug that only shows up in a
 * full grid.
 */

export const MOTIF_COUNT = 5;

/**
 * Motifs are drawn LARGE and sparse — roughly 90px tiles rather than 30px.
 *
 * The first pass used small ones and every card came out as busy wallpaper the monogram got lost
 * in. A backdrop wants a few big quiet shapes, not a hundred small loud ones.
 */
function Motif({ index, id }: { index: number; id: string }) {
  switch (index) {
    // Awning stripes — the canopy over a market stall.
    case 0:
      return (
        <pattern
          id={id}
          width="72"
          height="72"
          patternUnits="userSpaceOnUse"
          patternTransform="rotate(35)"
        >
          <rect width="34" height="72" fill="currentColor" opacity="0.5" />
        </pattern>
      );

    // A leaf with its midrib. Drawn symmetrically about the stem, because the first attempt curved
    // to one side and a grid of them read as bananas.
    case 1:
      return (
        <pattern
          id={id}
          width="88"
          height="88"
          patternUnits="userSpaceOnUse"
          patternTransform="rotate(12)"
        >
          <path
            d="M44 16c14 10 14 34 0 46-14-12-14-36 0-46Z"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.4"
          />
          <path d="M44 18v44" fill="none" stroke="currentColor" strokeWidth="1.6" />
        </pattern>
      );

    // Crates, stacked the way produce arrives.
    case 2:
      return (
        <pattern id={id} width="92" height="92" patternUnits="userSpaceOnUse">
          <rect
            x="14"
            y="22"
            width="64"
            height="44"
            rx="4"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.4"
          />
          <path d="M14 38h64M36 22v44M56 22v44" stroke="currentColor" strokeWidth="1.6" />
        </pattern>
      );

    // An apple with its stem and leaf.
    case 3:
      return (
        <pattern
          id={id}
          width="90"
          height="90"
          patternUnits="userSpaceOnUse"
          patternTransform="rotate(-8)"
        >
          <circle cx="45" cy="52" r="22" fill="none" stroke="currentColor" strokeWidth="2.4" />
          <path d="M45 30v-8" fill="none" stroke="currentColor" strokeWidth="2" />
          <path
            d="M45 24c7-5 13-3 15 2-5 3-11 2-15-2Z"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
          />
        </pattern>
      );

    // Bunting, strung between stalls.
    default:
      return (
        <pattern id={id} width="104" height="76" patternUnits="userSpaceOnUse">
          <path d="M0 14q26 16 52 0t52 0" fill="none" stroke="currentColor" strokeWidth="2" />
          <path d="M14 19l11 24 12-26Z" fill="none" stroke="currentColor" strokeWidth="2.2" />
          <path d="M64 17l12 26 11-24Z" fill="none" stroke="currentColor" strokeWidth="2.2" />
        </pattern>
      );
  }
}

/**
 * Fills its positioned parent. `aria-hidden` throughout: it carries no information, and the market's
 * name is already the card's heading.
 */
export function MarketTilePattern({ motif, seed }: { motif: number; seed: string }) {
  // A DOM id has to be a valid selector fragment, and a slug can carry anything the importer had.
  const id = `mt-${seed.replace(/[^a-z0-9]/gi, "")}-${motif}`;
  return (
    <svg
      aria-hidden
      className="pointer-events-none absolute inset-0 size-full"
      preserveAspectRatio="xMidYMid slice"
    >
      <defs>
        <Motif index={motif} id={id} />
      </defs>
      <rect width="100%" height="100%" fill={`url(#${id})`} />
    </svg>
  );
}
