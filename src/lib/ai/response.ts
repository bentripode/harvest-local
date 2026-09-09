/**
 * Unpacking what the model actually sent back.
 *
 * Pure and separate from `generate.ts` for one practical reason: that module reads `@/lib/env`,
 * which validates the whole environment at import time and so cannot be loaded by the unit tests.
 * The parsing is the part with edge cases, so it lives where it can be tested.
 */

/**
 * Remove the packaging a model adds despite being asked not to: surrounding quotes, a "Here's a
 * description:" preamble, or a markdown fence. Conservative — it only strips what it is sure of,
 * because mangling the copy is worse than leaving a stray quote for the seller to delete.
 */
export function stripWrapping(raw: string): string {
  let text = raw.trim();

  const fence = /^```[a-z]*\n([\s\S]*?)\n```$/i.exec(text);
  if (fence) text = fence[1].trim();

  // A single leading line that announces the answer and ends in a colon.
  text = text.replace(/^[^\n]{0,80}:\s*\n+/, "").trim();

  // Matching quotes around the whole thing, only when there are none inside.
  const quoted = /^"([^"]+)"$/.exec(text) ?? /^“([^”]+)”$/.exec(text);
  if (quoted) text = quoted[1].trim();

  return text;
}
