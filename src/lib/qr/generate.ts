import "server-only";

import { env } from "@/lib/env";
import { joinUrl, qrSvg, type QrLevel } from "@/lib/qr/svg";

/**
 * QR codes for the booth.
 *
 * These sellers stand behind a folding table every Saturday, and the code on the sign is how
 * somebody who came for bread becomes somebody who orders on Thursday — the cheapest bridge there
 * is between the physical channel they already work and the storefront they pay us for.
 *
 * The rendering itself is in `svg.ts`; this is the half that knows where the site lives.
 */

export { qrSvg };
export type { QrLevel };

/** An absolute URL for a path on our own site. A relative path scans into nothing. */
export function absoluteUrl(path: string): string {
  return joinUrl(env.NEXT_PUBLIC_SITE_URL, path);
}

export interface QrTarget {
  key: string;
  label: string;
  /** What the code resolves to — shown under it, so a seller can check before printing 200. */
  url: string;
  svg: string;
}

/** Build the set of codes a seller might want, each already rendered. */
export async function buildQrTargets(
  targets: { key: string; label: string; path: string }[],
  level: QrLevel = "M",
): Promise<QrTarget[]> {
  return Promise.all(
    targets.map(async (t) => {
      const url = absoluteUrl(t.path);
      return { key: t.key, label: t.label, url, svg: await qrSvg(url, { level }) };
    }),
  );
}
