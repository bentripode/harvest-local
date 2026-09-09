import QRCode from "qrcode";

/**
 * QR rendering — pure, so it can be tested without the environment. The site-URL half lives in
 * `generate.ts`, the way `pickup-format.ts` splits from `pickup.ts`.
 *
 * SVG rather than PNG: a QR on a sign gets printed at whatever size the sign is, and vector
 * survives that. A raster export at the wrong resolution is the classic way a booth sign ends up
 * unscannable. Generating it ourselves also means no URL of ours passes through a third-party QR
 * service, and no sign stops working when a free API disappears.
 */

export type QrLevel = "L" | "M" | "Q" | "H";

/** Join an origin and a path without doubling or dropping the slash between them. */
export function joinUrl(base: string, path: string): string {
  const origin = base.replace(/\/+$/, "");
  const rest = path.replace(/^\/+/, "");
  return rest ? `${origin}/${rest}` : origin;
}

/**
 * The QR as an SVG string, ready to inline or hand over as a download.
 *
 * `margin: 2` is not decoration — the quiet zone is part of the spec, and a code cropped tight to
 * its edge is one a phone struggles to find against a busy tablecloth.
 */
export async function qrSvg(
  url: string,
  { level = "M", scale = 8 }: { level?: QrLevel; scale?: number } = {},
): Promise<string> {
  return QRCode.toString(url, {
    type: "svg",
    errorCorrectionLevel: level,
    margin: 2,
    scale,
    color: { dark: "#000000", light: "#ffffff" },
  });
}
