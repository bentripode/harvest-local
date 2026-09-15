import Image from "next/image";

/**
 * A seller's mark.
 *
 * Their photo where they have uploaded one, and otherwise an initial on a tinted ground — with the
 * tint derived from the business name, so a seller looks the same on the gallery, their storefront
 * and a basket.
 *
 * The initial is the fallback rather than a grey silhouette, and that matters more than it sounds:
 * most sellers will never upload anything, so the no-photo case is the common one, and the same
 * grey person repeated down a gallery reads as a page that failed to load. A stable colour reads as
 * an identity.
 */
export function SellerAvatar({
  name,
  src,
  size = "md",
  className = "",
}: {
  name: string;
  /** The seller's uploaded photo, if they have one. */
  src?: string | null;
  size?: "sm" | "md" | "lg";
  className?: string;
}) {
  const box =
    size === "lg" ? "size-16 text-2xl" : size === "sm" ? "size-7 text-xs" : "size-10 text-base";
  const px = size === "lg" ? 64 : size === "sm" ? 28 : 40;

  if (src) {
    return (
      <span
        className={`bg-muted relative inline-block shrink-0 overflow-hidden rounded-full ${box} ${className}`}
      >
        <Image src={src} alt="" fill className="object-cover" sizes={`${px}px`} />
      </span>
    );
  }

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
