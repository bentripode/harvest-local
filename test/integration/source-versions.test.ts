import { beforeAll, expect, it } from "vitest";

import { adminDb, describeDb, type Db } from "./helpers";

/**
 * `source_version` — what each source document says about itself.
 *
 * The strong half of the staleness tripwire. A machine cannot invent it, so it was harvested once
 * from all 60 distinct source URLs; what these tests protect is that nothing junk got in, because a
 * wrong amendment line is worse than an absent one — it would read as settled.
 */
describeDb("compliance source versions", () => {
  let admin: Db;

  beforeAll(async () => {
    admin = adminDb();
  });

  it("records a version for the programmes whose documents state one", async () => {
    const { count } = await admin
      .from("state_food_programs")
      .select("id", { count: "exact", head: true })
      .not("source_version", "is", null);
    // A floor rather than a total, and the null rows are deliberate. Two things pull it below the
    // 43 originally harvested: roughly twenty NALC compilations state no currency at all, and
    // repointing a row to its own statute (20260907170000) clears the version it had inherited
    // from the compilation it no longer cites.
    expect(count ?? 0).toBeGreaterThanOrEqual(20);
  });

  it("carries the amendment lines the tripwire most depends on", async () => {
    const { data } = await admin
      .from("state_food_programs")
      .select("state_code, ordinal, source_version")
      .in("state_code", ["UT", "WA", "WI", "VA"]);

    const by = new Map((data ?? []).map((r) => [`${r.state_code}${r.ordinal}`, r.source_version]));
    // Utah's is the example the column's own comment uses.
    expect(by.get("UT2")).toBe("Amended by Chapter 433, 2026 General Session");
    expect(by.get("UT3")).toBe("Amended by Chapter 487, 2025 General Session");
    expect(by.get("WA1")).toMatch(/^\[ 2015 c 203 s 1;/);
    expect(by.get("WI1")).toMatch(/^History: 1987 a\. 399;/);
    // Virginia's chain has to end at the 2026 amendment that removed subdivision 3's cap.
    expect(by.get("VA1")).toMatch(/2026, c\. 605\.$/);
  });

  /**
   * The harvest's first pass matched the word "credited" and produced things like "credited by the
   * American National Standards Institute" as West Virginia's amendment line. Nothing shaped like
   * that may survive: the whole value of this column is that it can be trusted.
   */
  it("contains nothing that is obviously not a version line", async () => {
    const [{ data: programs }, { data: rules }] = await Promise.all([
      admin.from("state_food_programs").select("state_code, source_version"),
      admin.from("state_label_rules").select("source_version"),
    ]);

    const all = [...(programs ?? []), ...(rules ?? [])]
      .map((r) => r.source_version)
      .filter((v): v is string => !!v);

    for (const v of all) {
      expect(v.length).toBeGreaterThan(10);
      expect(v.length).toBeLessThan(400);
      // Every recorded line names a year — a version marker with no date is not one.
      expect(v).toMatch(/\b(?:19|20)\d{2}\b/);
      expect(v).not.toMatch(/credited by|CREDIT UNIONS|CHAPTER 31D/i);
    }
  });

  it("marks Tennessee's enrolled act as immutable rather than dated", async () => {
    const { data } = await admin
      .from("state_food_programs")
      .select("source_version")
      .eq("state_code", "TN")
      .single();
    // A signed public chapter is byte-identical forever, so the tripwire on that URL is inherently
    // silent — and what actually moves is the codified section it amended.
    expect(data?.source_version).toMatch(/immutable/);
    expect(data?.source_version).toMatch(/53-1-118/);
  });
});
