/**
 * A seller's mark.
 *
 * There is no image uploader yet, so every seller is an initial on a tinted ground rather than a
 * photograph — and the tint is derived from the name, so a seller looks the same on the gallery,
 * their storefront and a basket. A single flat grey circle everywhere would read as a missing
 * image; a stable colour reads as an identity, which is what this stands in for until there is a
 * real one.
 *
 * When the uploader lands this takes an optional `src` and nothing else changes.
 */
export function SellerAvatar({
  name,
  size = "md",
  className = "",
}: {
  name: string;
  size?: "sm" | "md" | "lg";
  className?: string;
}) {
  const box =
    size === "lg" ? "size-16 text-2xl" : size === "sm" ? "size-7 text-xs" : "size-10 text-base";

  return (
    <span
      aria-hidden
      className={`font-heading inline-flex shrink-0 items-center justify-center rounded-full font-semibold ${box} ${className}`}
      style={{
        // oklch keeps every one of these at the same lightness and chroma, so no seller gets a
        // louder mark than another — only the hue moves.
        backgroundColor: `oklch(0.90 0.045 ${hue(name)})`,
        color: `oklch(0.40 0.070 ${hue(name)})`,
      }}
    >
      {name.trim().charAt(0).toUpperCase() || "·"}
    </span>
  );
}

/** A stable hue per name. Not security-sensitive — it only has to be spread out and repeatable. */
function hue(name: string): number {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) % 360;
  return h;
}
