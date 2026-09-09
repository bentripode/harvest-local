import { describe, expect, it } from "vitest";

import {
  launchProgress,
  launchSteps,
  nextStep,
  type LaunchFacts,
} from "@/lib/launch/checklist";

/**
 * The checklist is derived from real state, so the things worth testing are that it never claims a
 * seller has done something they haven't, never nags about something they have, and puts the thing
 * actually blocking them first.
 */

const facts = (over: Partial<LaunchFacts> = {}): LaunchFacts => ({
  isLive: true,
  pauseReason: null,
  sellsFood: true,
  hasProgramChoice: true,
  activeListings: 2,
  draftListings: 0,
  listingsWithGaps: 0,
  hasPickupLocation: true,
  hasStory: true,
  hasUpcomingEvent: true,
  hasPromoCode: true,
  storefrontViews: 12,
  completedOrders: 3,
  reviewCount: 1,
  ...over,
});

const byId = (f: LaunchFacts) => new Map(launchSteps(f).map((s) => [s.id, s]));

describe("the gate comes first", () => {
  it("puts opening the storefront at the top", () => {
    expect(launchSteps(facts({ isLive: false, pauseReason: "license_unverified" }))[0].id).toBe(
      "live",
    );
  });

  it("says WHY it's shut, which is the useful part", () => {
    const step = byId(facts({ isLive: false, pauseReason: "license_unverified" })).get("live")!;
    expect(step.state).toBe("todo");
    expect(step.note).toMatch(/document/i);
  });

  it("distinguishes a holiday from a problem", () => {
    const holiday = byId(facts({ isLive: false, pauseReason: "vacation" })).get("live")!;
    expect(holiday.note).toMatch(/closed your storefront yourself/i);
  });

  it("falls back to a sentence for a reason it doesn't recognise", () => {
    const step = byId(facts({ isLive: false, pauseReason: "something_new" })).get("live")!;
    expect(step.note).toBeTruthy();
  });

  it("stops asking once the storefront is open", () => {
    const step = byId(facts({ isLive: true })).get("live")!;
    expect(step.state).toBe("done");
    expect(step.note).toBeUndefined();
  });
});

describe("it doesn't ask for things that don't apply", () => {
  it("skips the programme step for a seller who lists no food", () => {
    // A candlemaker has no cottage food programme to choose, and asking would be nonsense.
    expect(byId(facts({ sellsFood: false, hasProgramChoice: false })).has("programme")).toBe(false);
  });

  it("asks for it when they do sell food", () => {
    expect(byId(facts({ sellsFood: true, hasProgramChoice: false })).get("programme")!.state).toBe(
      "todo",
    );
  });

  it("only mentions label gaps when there are some", () => {
    expect(byId(facts({ listingsWithGaps: 0 })).has("labels")).toBe(false);
    const withGaps = byId(facts({ listingsWithGaps: 2 })).get("labels")!;
    expect(withGaps.note).toContain("2 listings");
  });

  it("gets the singular right, because '1 listings' reads as a bug", () => {
    expect(byId(facts({ listingsWithGaps: 1 })).get("labels")!.note).toContain("1 listing ");
  });
});

describe("listings", () => {
  it("nudges toward publishing when there is a draft waiting", () => {
    const step = byId(facts({ activeListings: 0, draftListings: 1 })).get("listing")!;
    expect(step.state).toBe("todo");
    expect(step.note).toMatch(/saved as a draft/);
  });

  it("says nothing about drafts when there are none", () => {
    expect(byId(facts({ activeListings: 0, draftListings: 0 })).get("listing")!.note).toBeUndefined();
  });

  it("is done once anything is live, however many drafts remain", () => {
    expect(byId(facts({ activeListings: 1, draftListings: 5 })).get("listing")!.state).toBe("done");
  });
});

describe("visitors are observed, not self-reported", () => {
  it("counts real storefront views rather than offering a checkbox", () => {
    // "Tell your friends" is not a step: we cannot see it, and a checkbox for it would be a lie
    // either way it was ticked. Whether anyone LOOKED is the same question asked honestly.
    const seen = byId(facts({ storefrontViews: 4 })).get("seen")!;
    expect(seen.state).toBe("done");
    expect(seen.note).toBe("4 people have looked at your storefront.");
  });

  it("gets the singular right there too", () => {
    expect(byId(facts({ storefrontViews: 1 })).get("seen")!.note).toBe(
      "1 person has looked at your storefront.",
    );
  });

  it("is reassuring rather than accusing at zero", () => {
    const seen = byId(facts({ storefrontViews: 0 })).get("seen")!;
    expect(seen.state).toBe("todo");
    expect(seen.note).toMatch(/normal on day one/);
  });
});

describe("a step that genuinely can't be done yet is blocked, not todo", () => {
  it("blocks asking for a review before any order exists", () => {
    const step = byId(facts({ completedOrders: 0, reviewCount: 0 })).get("review")!;
    expect(step.state).toBe("blocked");
    // Nothing to click: the seller cannot make this happen, so there is nowhere to send them.
    expect(step.href).toBeNull();
  });

  it("opens it once an order has completed", () => {
    const step = byId(facts({ completedOrders: 1, reviewCount: 0 })).get("review")!;
    expect(step.state).toBe("todo");
    expect(step.href).toBe("/seller/orders");
  });

  it("is done once a review exists", () => {
    expect(byId(facts({ completedOrders: 1, reviewCount: 2 })).get("review")!.state).toBe("done");
  });
});

describe("launchProgress", () => {
  it("counts everything done for a fully set-up seller", () => {
    const { done, total } = launchProgress(launchSteps(facts()));
    expect(done).toBe(total);
  });

  it("does not count a blocked step against them", () => {
    // A seller on day one has no orders and so cannot have a review. Counting that as a failure
    // would make the bar unreachable on the day it matters most.
    const steps = launchSteps(facts({ completedOrders: 0, reviewCount: 0 }));
    const { total } = launchProgress(steps);
    expect(total).toBe(steps.filter((s) => s.state !== "blocked").length);
    expect(steps.some((s) => s.state === "blocked")).toBe(true);
  });
});

describe("nextStep", () => {
  it("is the first thing actually blocking them", () => {
    const steps = launchSteps(facts({ isLive: false, pauseReason: "license_unverified" }));
    expect(nextStep(steps)!.id).toBe("live");
  });

  it("skips past what's already done", () => {
    const steps = launchSteps(facts({ hasStory: false }));
    expect(nextStep(steps)!.id).toBe("story");
  });

  it("never points at a blocked step", () => {
    const steps = launchSteps(facts({ completedOrders: 0, reviewCount: 0, storefrontViews: 5 }));
    expect(nextStep(steps)!.state).toBe("todo");
  });

  it("is null when there is nothing left, rather than inventing a task", () => {
    expect(nextStep(launchSteps(facts()))).toBeNull();
  });
});
