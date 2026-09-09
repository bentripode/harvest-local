import { describe, expect, it } from "vitest";

import {
  pickDailyStories,
  storyExcerpt,
  utcDayKey,
  worthShowing,
  type StoryLike,
} from "@/lib/stories/select";

/**
 * The rotation exists so the front page can't be gamed by editing, and so every seller with a story
 * gets a turn. Both are properties rather than outputs, so that is how they're tested.
 */

const story = (id: string, over: Partial<StoryLike> = {}): StoryLike => ({
  sellerId: id,
  businessName: `Seller ${id}`,
  storefrontSlug: `seller-${id}`,
  homeState: "TX",
  story: "We started baking in a home kitchen in 2019.",
  ...over,
});

const many = Array.from({ length: 12 }, (_, i) => story(`s${i}`));

describe("pickDailyStories", () => {
  it("is deterministic within a day, so two visitors see the same page", () => {
    const a = pickDailyStories(many, "2026-12-12").map((s) => s.sellerId);
    const b = pickDailyStories(many, "2026-12-12").map((s) => s.sellerId);
    expect(a).toEqual(b);
  });

  it("changes from one day to the next", () => {
    const today = pickDailyStories(many, "2026-12-12").map((s) => s.sellerId);
    const tomorrow = pickDailyStories(many, "2026-12-13").map((s) => s.sellerId);
    expect(today).not.toEqual(tomorrow);
  });

  it("does not depend on the order it was handed, so a query's sort can't decide the page", () => {
    const forwards = pickDailyStories(many, "2026-12-12").map((s) => s.sellerId);
    const backwards = pickDailyStories([...many].reverse(), "2026-12-12").map((s) => s.sellerId);
    expect(backwards).toEqual(forwards);
  });

  it("cannot be moved up by editing — position depends only on the id and the day", () => {
    // The whole reason this isn't "most recently updated". Rewriting the story, changing the name,
    // adding a photo: none of it changes where a seller lands.
    const edited = many.map((s) =>
      s.sellerId === "s4"
        ? { ...s, story: "A totally rewritten story.", businessName: "Renamed" }
        : s,
    );
    expect(pickDailyStories(edited, "2026-12-12").map((s) => s.sellerId)).toEqual(
      pickDailyStories(many, "2026-12-12").map((s) => s.sellerId),
    );
  });

  it("gives everyone a turn over a run of days", () => {
    // Fairness, stated as a property: nobody is permanently off the front page.
    const seen = new Set<string>();
    for (let day = 1; day <= 28; day++) {
      const key = `2026-12-${String(day).padStart(2, "0")}`;
      for (const s of pickDailyStories(many, key)) seen.add(s.sellerId);
    }
    expect(seen.size).toBe(many.length);
  });

  it("returns everything when there are fewer than asked for", () => {
    const two = [story("a"), story("b")];
    expect(pickDailyStories(two, "2026-12-12")).toHaveLength(2);
  });

  it("does not mutate what it was given", () => {
    const input = [...many];
    pickDailyStories(input, "2026-12-12");
    expect(input.map((s) => s.sellerId)).toEqual(many.map((s) => s.sellerId));
  });

  it("is empty for nothing", () => {
    expect(pickDailyStories([], "2026-12-12")).toEqual([]);
  });
});

describe("utcDayKey", () => {
  it("is the UTC date", () => {
    expect(utcDayKey(new Date("2026-12-12T23:30:00Z"))).toBe("2026-12-12");
    expect(utcDayKey(new Date("2026-12-13T00:30:00Z"))).toBe("2026-12-13");
  });
});

describe("storyExcerpt", () => {
  it("leaves a short story exactly alone", () => {
    const short = "We bake bread on Saturdays.";
    expect(storyExcerpt(short)).toBe(short);
  });

  it("cuts at a sentence end when there is one to cut at", () => {
    const text =
      "We started in 2019 with one oven and a market stall. " +
      "Now there are two ovens and my sister does the deliveries, which she says she enjoys but I have my doubts about that.";
    const out = storyExcerpt(text, 120);
    expect(out).toBe("We started in 2019 with one oven and a market stall.");
    expect(out.endsWith("…")).toBe(false);
  });

  it("never cuts mid-word", () => {
    const text = "a".repeat(50) + " " + "supercalifragilistic ".repeat(20);
    const out = storyExcerpt(text, 80);
    expect(out.endsWith("…")).toBe(true);
    // Everything before the ellipsis is whole words.
    const body = out.slice(0, -1);
    expect(text.startsWith(body)).toBe(true);
    expect(text[body.length]).toBe(" ");
  });

  it("collapses whitespace so a story with blank lines doesn't blow out the card", () => {
    expect(storyExcerpt("We  bake\n\n  bread.")).toBe("We bake bread.");
  });

  it("does not leave a dangling comma before the ellipsis", () => {
    const text = "Flour, water, salt, starter, patience, and a very old oven that we love dearly.";
    const out = storyExcerpt(text, 20);
    expect(out).not.toMatch(/[,;:]…$/);
  });

  it("ignores a sentence end too near the start to be a useful excerpt", () => {
    // "Hi." then a long paragraph — cutting at "Hi." would show nothing.
    const text = "Hi. " + "We have been making preserves since my grandmother taught me how. ".repeat(4);
    const out = storyExcerpt(text, 200);
    expect(out.startsWith("Hi. We have")).toBe(true);
  });
});

describe("worthShowing", () => {
  it("needs at least two, because one reads as a marketplace with one seller", () => {
    expect(worthShowing([])).toBe(false);
    expect(worthShowing([story("a")])).toBe(false);
    expect(worthShowing([story("a"), story("b")])).toBe(true);
  });
});
