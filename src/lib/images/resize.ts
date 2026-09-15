/**
 * How big an uploaded image should end up.
 *
 * The pure half of the uploader, so it can be tested — the canvas work that uses it cannot run in
 * vitest, but the arithmetic is where the mistakes are.
 *
 * A phone camera produces a 4000×3000 JPEG of several megabytes. Sent as-is that becomes a 40px
 * avatar the browser downloads in full, on a phone, over cell data, once per seller on the gallery.
 * Every upload is therefore fitted to a box before it leaves the device.
 */

/** The longest edge we keep, per kind of image. */
export const IMAGE_BOUNDS = {
  /** Drawn at 28–64px, so 512 covers a 2× retina 256 and any future larger use. */
  avatar: 512,
  /** Full-bleed across a phone and a 5xl storefront column. */
  cover: 1600,
  /** Shown at up to ~384px wide in the feed, but people pinch-zoom photos of food. */
  post: 1600,
  /** The quick view can show one nearly full-screen on a tablet. */
  product: 2000,
} as const;

export type ImageKind = keyof typeof IMAGE_BOUNDS;

export interface Dimensions {
  width: number;
  height: number;
}

/**
 * Fit `source` inside a square box of `max`, preserving aspect ratio.
 *
 * Never enlarges: an image already inside the box is returned unchanged, because upscaling spends
 * bytes to add nothing. Rounds to whole pixels and never returns a zero dimension — a canvas of
 * width 0 throws, and an extremely wide panorama scaled to fit its long edge can round the short
 * one to nothing.
 */
export function fitWithin(source: Dimensions, max: number): Dimensions {
  const { width, height } = source;

  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
    throw new Error("image dimensions must be positive numbers");
  }
  if (max <= 0) throw new Error("max must be positive");

  const longest = Math.max(width, height);
  if (longest <= max) return { width: Math.round(width), height: Math.round(height) };

  const scale = max / longest;
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  };
}

/**
 * Whether re-encoding is worth it.
 *
 * A small PNG screenshot of a label, or an image already inside its box, is left alone: passing it
 * through a canvas would re-encode it as JPEG, lose its transparency and can easily make it BIGGER.
 * Only images that are actually oversized, or actually heavy, get touched.
 */
export function needsProcessing(
  source: Dimensions,
  bytes: number,
  max: number,
  byteBudget = 400_000,
): boolean {
  return Math.max(source.width, source.height) > max || bytes > byteBudget;
}

/**
 * The object name for an upload.
 *
 * The first segment MUST be the seller_profiles id — that is what the storage policy checks, so a
 * path built any other way is refused by Postgres rather than by us. The kind is a second segment
 * so a bucket listing is readable and a future cleanup job can find all of one kind.
 */
export function storagePath(sellerId: string, kind: ImageKind, fileName: string): string {
  const ext = extensionFor(fileName);
  return `${sellerId}/${kind}/${crypto.randomUUID()}.${ext}`;
}

/**
 * A safe extension for an uploaded file name.
 *
 * Never trusts the name: it is attacker-controlled in principle and messy in practice ("IMG_0421",
 * "photo.JPEG", "a.b.c.png", or a name that is all dots). Anything unrecognised becomes `jpg`,
 * which is what the canvas re-encode produces anyway.
 */
export function extensionFor(fileName: string): string {
  const ALLOWED = ["jpg", "jpeg", "png", "webp", "avif"];
  const raw = fileName.split(".").pop()?.toLowerCase() ?? "";
  const cleaned = raw.replace(/[^a-z0-9]/g, "");
  return ALLOWED.includes(cleaned) ? cleaned : "jpg";
}
