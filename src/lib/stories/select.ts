/**
 * Choosing which seller stories the home page shows, and trimming them to fit.
 *
 * ===========================================================================
 * WHY A ROTATION AND NOT "MOST RECENT"
 * ===========================================================================
 * The obvious ordering is newest first. It is also the one that pays a seller to keep touching their
 * story: a marketplace whose front page rewards editing gets edited, and the sellers who play that
 * game push out the ones who wrote something once and got on with baking.
 *
 * So the order is a rotation: a stable shuffle keyed on the day. Every seller with a story comes up
 * as often as every other, nobody can move themselves up, and it changes on its own so a returning
 * visitor sees different faces. Within a day it is deterministic, so the page is cacheable and two
 * people looking at once see the same thing.
 *
 * The day key is the UTC date, deliberately. Everywhere else in this codebase a date that a reader
 * might act on is computed on their own clock — but nothing here is a claim about time. It only has
 * to change once a day and be the same for everybody, and UTC is the only clock that is.
 */

export interface StoryLike {
  sellerId: string;
  businessName: string;
  storefrontSlug: string;
  homeState: string;
  story: string;
}

/** "YYYY-MM-DD" in UTC — the rotation key. See the note above on why this one is not local. */
export function utcDayKey(now: Date = new Date()): string {
  return now.toISOString().slice(0, 10);
}

/**
 * FNV-1a, 32-bit, with a final avalanche.
 *
 * Two details matter and both were bugs first. **The day key is hashed FIRST**, before the seller
 * id: FNV mixes each byte into an accumulator, so whatever goes in last barely moves the result, and
 * with the day appended the rotation simply did not rotate — consecutive days produced the same
 * three sellers. Seeding with the day makes every following byte depend on it.
 *
 * The final mix is there for the same reason: raw FNV output correlates enough on short, similar
 * inputs ("s1", "s2", "s3") that sorting on it left some sellers permanently near the back. Over 28
 * days only 7 of 12 ever reached the front page, which is exactly the unfairness the rotation is
 * supposed to prevent.
 */
function hash(input: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  // xorshift-multiply avalanche, so a one-character difference reaches every output bit.
  h ^= h >>> 16;
  h = Math.imul(h, 0x21f0aaad) >>> 0;
  h ^= h >>> 15;
  h = Math.imul(h, 0x735a2d97) >>> 0;
  h ^= h >>> 15;
  return h >>> 0;
}

/**
 * A stable daily shuffle, then the first `count`.
 *
 * Sorting on `hash(dayKey + sellerId)` gives each seller a different position each day, decided by
 * their id rather than by anything they can change. Ties break on `sellerId` so the result is
 * total — two sellers colliding on a hash must still come out in a fixed order, or the "same for
 * everybody" property quietly stops holding.
 */
export function pickDailyStories<T extends StoryLike>(
  stories: T[],
  dayKey: string,
  count = 3,
): T[] {
  return [...stories]
    .sort((a, b) => {
      // Day first — see the note on `hash`.
      const ha = hash(dayKey + ":" + a.sellerId);
      const hb = hash(dayKey + ":" + b.sellerId);
      if (ha !== hb) return ha - hb;
      return a.sellerId.localeCompare(b.sellerId);
    })
    .slice(0, count);
}

/** Shortest excerpt worth showing; below this a sentence cut is not taken. */
const MIN_EXCERPT = 40;

/**
 * The first part of a story, cut at a sentence where possible.
 *
 * Never mid-word, and never mid-sentence when a sentence ending is anywhere reasonable — a story
 * chopped at "we started baking in 2019 when my" reads as broken rather than as continued. Falls
 * back to a word boundary with an ellipsis, which is honest about there being more.
 */
export function storyExcerpt(story: string, maxChars = 240): string {
  const text = story.trim().replace(/\s+/g, " ");
  if (text.length <= maxChars) return text;

  const window = text.slice(0, maxChars);

  // Cut at the last sentence ending, as long as it leaves something worth reading. The floor is an
  // absolute number of characters rather than a fraction of the window: the real question is "is
  // this excerpt long enough to tell me anything", and a story opening "Hi." should not reduce the
  // whole card to one word whatever the window happens to be.
  const sentence = Math.max(
    window.lastIndexOf(". "),
    window.lastIndexOf("! "),
    window.lastIndexOf("? "),
  );
  if (sentence >= MIN_EXCERPT) return window.slice(0, sentence + 1);

  const space = window.lastIndexOf(" ");
  return `${(space > 0 ? window.slice(0, space) : window).replace(/[,;:]$/, "")}…`;
}

/**
 * Whether there are enough stories to be worth a section at all.
 *
 * One story on a page headed "Meet the makers" reads as a marketplace with one seller. Better to
 * show nothing than to advertise how thin it is — the rest of the home page already works.
 */
export function worthShowing(stories: StoryLike[]): boolean {
  return stories.length >= 2;
}
