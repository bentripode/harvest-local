/**
 * Delivery time windows — free-text labels a seller offers ("Saturdays 9am–12pm") and the buyer
 * picks one at checkout. Pure; shared by the seller settings action and (for the cap) the UI.
 */

export const MAX_WINDOWS = 12;
export const MAX_WINDOW_LEN = 80;

/** A newline-separated textarea → a trimmed, whitespace-collapsed, deduped, capped list. */
export function parseWindows(raw: string): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const line of raw.split(/\r?\n/)) {
    const w = line.trim().replace(/\s+/g, " ").slice(0, MAX_WINDOW_LEN);
    if (!w) continue;
    const key = w.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(w);
    if (out.length >= MAX_WINDOWS) break;
  }
  return out;
}
