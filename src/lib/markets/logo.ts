/**
 * Market pictures uploaded by hand on /admin/markets. Pure, so the checks are tested.
 *
 * The browser shrinks the picture to `LOGO_PX` and re-encodes it as JPEG before sending it — the
 * same size the website scan stores — so what arrives is small. The server still checks, because a
 * Server Action is reachable by direct POST: whatever was sent must actually be a JPEG, and a small
 * one, before it goes in a public bucket under the market's name.
 */

import { safeWebsiteUrl } from "@/lib/markets/directory";

/** The longest edge kept — the scan's thumbnail size, shown at 80–96px at 2×–5×. */
export const LOGO_PX = 480;

/** A 480px JPEG is 20–150 KB; well above that is not what the browser was asked to send. */
export const MAX_LOGO_BYTES = 600 * 1024;

/** The same object the website scan writes, so the two sources can never leave two copies. */
export function logoStoragePath(state: string, slug: string): string {
  return `${state.toLowerCase()}/${slug}.jpg`;
}

/** JPEG files start FF D8 FF. Checked on the bytes, not the declared type, which is the client's word. */
export function isJpeg(bytes: Uint8Array): boolean {
  return bytes.length > 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
}

export type LogoCheck = { ok: true; sourceUrl: string } | { ok: false; error: string };

/**
 * Whether an upload may be stored. `sourceUrl` is where the person got the picture — usually the
 * market's Facebook page — and is required: every market picture records its provenance, so a
 * takedown request or a second look knows what it is looking at.
 */
export function checkLogoUpload(bytes: Uint8Array, rawSourceUrl: string | null): LogoCheck {
  if (bytes.length === 0) return { ok: false, error: "Choose a picture first." };
  if (bytes.length > MAX_LOGO_BYTES) return { ok: false, error: "That picture is too large." };
  if (!isJpeg(bytes)) return { ok: false, error: "That file isn't a picture we can use." };
  const sourceUrl = safeWebsiteUrl(rawSourceUrl);
  if (!sourceUrl) {
    return { ok: false, error: "Add the page the picture came from (for example its Facebook page)." };
  }
  return { ok: true, sourceUrl };
}
