import { beforeAll, expect, it } from "vitest";

import { adminDb, describeDb, type Db } from "./helpers";

/**
 * Where `source_url` actually points.
 *
 * The verification pass read primary text for all 51 jurisdictions and recorded the citations in
 * each row's notes — but only updated `source_url` for the later batches, so most rows still cited
 * a National Agricultural Law Center compilation. That was invisible until #82 gave those URLs a
 * job: the staleness watcher was watching NALC's publishing schedule rather than the legislatures'.
 */
describeDb("compliance source URLs", () => {
  let admin: Db;

  beforeAll(async () => {
    admin = adminDb();
  });

  it("has most programmes pointing at primary text rather than a compilation", async () => {
    const { data } = await admin.from("state_food_programs").select("state_code, source_url");
    const onCompilation = (data ?? []).filter((r) => /nationalaglawcenter/.test(r.source_url ?? ""));
    // Around fourteen states' statutes live behind JavaScript viewers or on hosts that refused us,
    // and keep their compilation URL. They are no worse off than before; an unverified pointer
    // would not be an improvement on a verified one.
    //
    // The bound is deliberately loose rather than pinned to an exact count. A row an admin has
    // saved through /admin/programs carries a source_url that exists only in that environment, so
    // the total drifts by a row or two between the hosted database and a build from migrations.
    // What this protects is the shape of the change — 49 rows on a third-party compilation down to
    // a handful — not a number that would fail for an honest reason.
    expect(onCompilation.length).toBeLessThanOrEqual(18);
    expect((data ?? []).length - onCompilation.length).toBeGreaterThanOrEqual(52);
  });

  it("points a sample of repointed states at a URL naming their own statute", async () => {
    const { data } = await admin
      .from("state_food_programs")
      .select("state_code, ordinal, source_url")
      .in("state_code", ["ID", "NE", "SD", "MN", "MO"]);

    const by = new Map((data ?? []).map((r) => [`${r.state_code}${r.ordinal}`, r.source_url ?? ""]));
    // Each was accepted only after fetching it and confirming the document contains the section
    // the row's notes cite.
    expect(by.get("ID1")).toContain("37-205");
    expect(by.get("NE1")).toContain("81-2,245");
    expect(by.get("SD1")).toContain("34-18-38");
    expect(by.get("MN1")).toContain("28A.152");
    expect(by.get("MO1")).toContain("196.298");
  });

  /**
   * A fingerprint describes a document, not a row. Left in place across a repoint, the watcher
   * would compare a legislature's page against a compilation PDF's hash and report a change that
   * never happened — the false alarm that makes a tripwire worthless.
   */
  it("carries no fingerprint from the document a row no longer cites", async () => {
    const { data } = await admin
      .from("state_food_programs")
      .select("state_code, ordinal, source_url, source_version, source_content_hash, source_etag")
      .in("state_code", ["ID", "NE", "SD", "MN", "MO", "OR", "PA"]);

    for (const row of data ?? []) {
      expect(row.source_content_hash).toBeNull();
      expect(row.source_etag).toBeNull();
      // The NALC currency line described the compilation, so it goes with it.
      expect(row.source_version).toBeNull();
    }
  });

  it("leaves the states already on primary text untouched", async () => {
    const { data } = await admin
      .from("state_food_programs")
      .select("state_code, ordinal, source_url, source_version")
      .in("state_code", ["UT", "VA", "WA", "WI"]);

    const by = new Map((data ?? []).map((r) => [`${r.state_code}${r.ordinal}`, r]));
    expect(by.get("UT2")?.source_url).toContain("le.utah.gov");
    expect(by.get("UT2")?.source_version).toBe("Amended by Chapter 433, 2026 General Session");
    expect(by.get("VA1")?.source_version).toMatch(/2026, c\. 605\.$/);
    expect(by.get("WA1")?.source_version).toMatch(/^\[ 2015 c 203 s 1;/);
  });

  /**
   * Label rules were deliberately not repointed: a labelling provision often sits in a different
   * instrument from the venue rule — Delaware's is 16 Del. Admin. Code 4458A, Utah's whole list is
   * R70-560-6 rather than § 4-5-501 — so reusing a statute verified only for the programme's
   * section would trade one unverified pointer for another while looking like progress.
   */
  /**
   * Label rules were held back in #84 and repointed in their own pass, against their OWN cited
   * provision rather than the programme's. Kentucky is why that mattered: its programmes are KRS
   * 217.136 and 217.137 but its labelling is 902 KAR 45:090 — a different instrument, on a
   * different site. Reusing the programme's URL would have pointed at a document that does not
   * contain the rule.
   */
  it("sends a label rule to its own instrument, not the programme's", async () => {
    const { data: rules } = await admin
      .from("state_label_rules")
      .select("source_url, state_food_programs!inner(state_code, ordinal)")
      .eq("state_food_programs.state_code", "KY");
    for (const row of rules ?? []) {
      expect(row.source_url).toContain("902");
      expect(row.source_url).toContain("045/090");
    }

    // Arkansas is the mirror image: programme at 20-57-504, labelling one section along at 505,
    // and the 504 page does not contain 505 — so it was not silently reused.
    const { data: ar } = await admin
      .from("state_label_rules")
      .select("source_url, state_food_programs!inner(state_code)")
      .eq("state_food_programs.state_code", "AR");
    // It now points at the enrolled Act 1040 of 2021, which is where both sections were actually
    // read from once the extractor could open it. The section number is no longer in the URL
    // because the act CREATES 20-57-505 rather than being served per-section — the requirement
    // this test exists for, that a label rule cite its own instrument, is still met.
    expect(ar?.[0]?.source_url).toContain("ACT1040");

    // Ohio and South Dakota were the same near miss and are pinned for the same reason: a statute
    // site links its neighbours, so "the page mentions the section" passed for pages containing
    // none of it. 20260907190000 has the count-occurrences rule that replaced it.
    const { data: others } = await admin
      .from("state_label_rules")
      .select("source_url, state_food_programs!inner(state_code)")
      .in("state_food_programs.state_code", ["OH", "SD"]);
    for (const row of others ?? []) {
      const st = (row.state_food_programs as unknown as { state_code: string }).state_code;
      expect(row.source_url).toContain(st === "OH" ? "3715.023" : "34-18-37");
    }
  });

  /**
   * Texas moved its statutes site to a client-rendered viewer, so the URL we had returned a 250KB
   * application bundle containing none of chapter 437 — the watcher would have fired on a redeploy
   * and stayed silent on an amendment. The Legislature's own file server still serves the file
   * the site renders, and it sends real validators.
   */
  it("points Texas at the file server rather than the application shell", async () => {
    const { data: program } = await admin
      .from("state_food_programs")
      .select("source_url, source_version")
      .eq("state_code", "TX")
      .single();
    expect(program?.source_url).toBe("https://tcss.legis.texas.gov/resources/HS/htm/HS.437.htm");
    expect(program?.source_url).not.toContain("statutes.capitol.texas.gov");
    expect(program?.source_version).toMatch(/Acts 2025, 89th Leg./);

    // The label rule relies on the same chapter — 437.0193 for the label, 437.0194 for the
    // before-payment requirement — so it points at the same document.
    const { data: rule } = await admin
      .from("state_label_rules")
      .select("source_url, state_food_programs!inner(state_code)")
      .eq("state_food_programs.state_code", "TX");
    expect(rule?.[0]?.source_url).toContain("tcss.legis.texas.gov");
  });

  /**
   * Connecticut was the wrong CHAPTER, not the wrong site: chapter 418 returns 140KB of real
   * statute from the right host and contains 21a-100 to 21a-105, none of the cottage food
   * sections. 21a-62f is in chapter 417. A 200 of the right size from the right host is not
   * evidence that the document is the right one.
   */
  it("sends Connecticut to the chapter that actually holds 21a-62f", async () => {
    const { data } = await admin
      .from("state_food_programs")
      .select("source_url")
      .eq("state_code", "CT")
      .single();
    expect(data?.source_url).toContain("chap_417");
    expect(data?.source_url).not.toContain("chap_418");
  });

  /**
   * Georgia's labelling is an administrative rule, published on the Secretary of State's rules
   * site rather than with the code — a different instrument on a different host, which is the
   * whole reason label rules were repointed separately from programmes.
   */
  it("sends Georgia's label rule to the rules site, not the code", async () => {
    const { data } = await admin
      .from("state_label_rules")
      .select("source_url, state_food_programs!inner(state_code)")
      .eq("state_food_programs.state_code", "GA");
    expect(data?.[0]?.source_url).toContain("rules.sos.ga.gov");
    expect(data?.[0]?.source_url).toContain("40-7-19");
  });

  it("has most label rules off the compilations too", async () => {
    const { data } = await admin.from("state_label_rules").select("source_url");
    const onCompilation = (data ?? []).filter((r) =>
      /nationalaglawcenter|ij.org/.test(r.source_url ?? ""),
    );
    // Six of the stragglers have no citation in their notes to verify against at all; the rest sit
    // behind JavaScript viewers or on hosts that refused us. Loose for the same reason as above.
    expect(onCompilation.length).toBeLessThanOrEqual(26);
  });
});
