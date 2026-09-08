import { describe, expect, it } from "vitest";

import {
  chooseSignal,
  detectMove,
  versionChanged,
  type SourceSnapshot,
  type StoredSource,
} from "@/lib/compliance/source-watch";

/**
 * The judgement behind the staleness tripwire.
 *
 * A tripwire that cries wolf is worse than none — people stop looking — which is the same reason an
 * invented deadline is worse than none. So what matters here is what it stays quiet about.
 */

const none: SourceSnapshot = { etag: null, lastModified: null, contentHash: null };
const stored = (over: Partial<StoredSource>): StoredSource => ({
  etag: null,
  lastModified: null,
  contentHash: null,
  signal: null,
  ...over,
});

describe("chooseSignal", () => {
  it("prefers what the publisher says over what the bytes say", () => {
    expect(chooseSignal({ etag: "W/\"a\"", lastModified: "Mon", contentHash: "abc" })).toBe("etag");
    expect(chooseSignal({ etag: null, lastModified: "Mon", contentHash: "abc" })).toBe(
      "last_modified",
    );
    expect(chooseSignal({ etag: null, lastModified: null, contentHash: "abc" })).toBe(
      "content_hash",
    );
  });

  it("is null when there is nothing to go on", () => {
    expect(chooseSignal(none)).toBeNull();
  });
});

describe("detectMove", () => {
  it("says nothing on a first sighting", () => {
    // Reporting every URL as changed on the watcher's first run would train an admin to ignore it.
    const out = detectMove(stored({}), { etag: 'W/"v1"', lastModified: null, contentHash: "a" });
    expect(out.moved).toBe(false);
  });

  it("reports a changed ETag", () => {
    const out = detectMove(
      stored({ etag: 'W/"v1"', signal: "etag" }),
      { etag: 'W/"v2"', lastModified: null, contentHash: null },
    );
    expect(out.moved).toBe(true);
    expect(out.signal).toBe("etag");
    expect(out.reason).toMatch(/ETag/);
  });

  it("stays quiet when the ETag is unchanged", () => {
    const out = detectMove(
      stored({ etag: 'W/"v1"', signal: "etag" }),
      { etag: 'W/"v1"', lastModified: null, contentHash: null },
    );
    expect(out.moved).toBe(false);
  });

  /**
   * A host that starts sending an ETag where it previously sent none would otherwise read as a
   * change on the first run after — a false alarm caused entirely by us switching signals.
   */
  it("keeps comparing on the signal it recorded, not the best one available now", () => {
    const out = detectMove(
      stored({ contentHash: "same", signal: "content_hash" }),
      { etag: 'W/"brand-new"', lastModified: null, contentHash: "same" },
    );
    expect(out.moved).toBe(false);
    expect(out.signal).toBe("content_hash");
  });

  it("says nothing when the chosen signal is missing this time", () => {
    // A host that drops its ETag for one response has not amended the statute.
    const out = detectMove(
      stored({ etag: 'W/"v1"', signal: "etag" }),
      { etag: null, lastModified: null, contentHash: "different" },
    );
    expect(out.moved).toBe(false);
  });

  it("reports a hash change, and says why that is the weaker signal", () => {
    const out = detectMove(
      stored({ contentHash: "aaa", signal: "content_hash" }),
      { etag: null, lastModified: null, contentHash: "bbb" },
    );
    expect(out.moved).toBe(true);
    expect(out.signal).toBe("content_hash");
    expect(out.reason).toMatch(/re-rendered/);
  });
});

describe("versionChanged", () => {
  it("ignores whitespace, because a PDF and an HTML page space it differently", () => {
    expect(
      versionChanged("Amended by Chapter 433, 2026 General Session", "Amended by Chapter 433,  2026\nGeneral Session"),
    ).toBe(false);
  });

  it("catches a new session year — the signal that would have caught Vermont", () => {
    expect(
      versionChanged("Amended by Chapter 433, 2026 General Session", "Amended by Chapter 12, 2027 General Session"),
    ).toBe(true);
  });

  it("says nothing when either side is unrecorded", () => {
    expect(versionChanged(null, "Amended 2027")).toBe(false);
    expect(versionChanged("Amended 2026", null)).toBe(false);
  });
});
