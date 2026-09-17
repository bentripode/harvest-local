import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import {
  summarise,
  validateLead,
  validateLeadFile,
  VERDICTS,
} from "../scripts/lib/market-leads.mjs";

/** Narrows the validator result so a message can be asserted; `errors` is absent on success. */
const why = (r: { ok: boolean; errors?: string[] }) => (r.errors ?? []).join(" ");

/** A lead that passes, so each test can break exactly one thing. */
const lead = (over: Record<string, unknown> = {}) => ({
  name: "Salisbury Rowan Farmers Market",
  sourceUrl: "https://homesteading.com/directory/farmers-markets/salisbury-rowan-farmers-market-2/",
  addressText: "115 S. Jackson St. Salisbury, NC 28144",
  street: "115 S. Jackson St.",
  city: "Salisbury",
  state: "NC",
  postalCode: "28144",
  phone: "980-643-8863",
  website: "http://salisburyfarmersmarket.com",
  checked: null,
  verdict: "pending",
  notes: "",
  ...over,
});

const file = (over: Record<string, unknown> = {}) => ({
  source: "https://homesteading.com/farmers-markets/",
  scrapedAt: "2026-09-16",
  note: "What this list is and how much to trust it.",
  leads: [lead()],
  ...over,
});

describe("validateLead", () => {
  it("accepts an unread lead", () => {
    expect(validateLead(lead()).ok).toBe(true);
  });

  it("requires a verdict from the fixed vocabulary", () => {
    // Free text here is a lead that silently drops out of every count — the same reason
    // `required_elements` and the allergen list are CHECK-enforced in the database.
    const r = validateLead(lead({ verdict: "probably-fine" }));
    expect(r.ok).toBe(false);
    expect(why(r)).toMatch(/verdict must be one of/);
    expect(validateLead(lead({ verdict: undefined })).ok).toBe(false);
  });

  it("makes a finding carry a date AND a reason", () => {
    // A verdict with neither is an assertion nobody can audit, which is worse than `pending`
    // because it looks like work that was done.
    const bare = validateLead(lead({ verdict: "closed" }));
    expect(bare.ok).toBe(false);
    expect(why(bare)).toMatch(/needs checked/);
    expect(why(bare)).toMatch(/needs notes/);

    const dated = validateLead(lead({ verdict: "closed", checked: "2026-09-17" }));
    expect(dated.ok).toBe(false);
    expect(why(dated)).toMatch(/needs notes/);

    expect(
      validateLead(lead({ verdict: "closed", checked: "2026-09-17", notes: "Town confirmed it shut." }))
        .ok,
    ).toBe(true);
  });

  it("rejects whitespace as a reason", () => {
    const r = validateLead(lead({ verdict: "closed", checked: "2026-09-17", notes: "   " }));
    expect(r.ok).toBe(false);
  });

  it("refuses a checked date on a pending lead", () => {
    // Otherwise "checked 2026-09-17, verdict pending" reads as looked-at-and-inconclusive, which
    // is what `unverifiable` is for.
    expect(validateLead(lead({ checked: "2026-09-17" })).ok).toBe(false);
  });

  it("rejects a state that is not a real code, and allows none at all", () => {
    // The "US" bug homesteading.mjs already had to fix once: a country abbreviation filed 28
    // Arizona markets under a state of "US".
    expect(validateLead(lead({ state: "US" })).ok).toBe(false);
    expect(validateLead(lead({ state: "ZZ" })).ok).toBe(false);
    // A lead whose state we could not read is the point of having a lead list.
    expect(validateLead(lead({ state: null })).ok).toBe(true);
  });

  it("does not police a state that is real but wrong, because only reading the page can", () => {
    // Middlebury, "VI", ZIP 05753 is Vermont — VI is a real code, so no schema can catch this.
    // It is caught by a person and recorded as `bad_state`.
    expect(validateLead(lead({ city: "Middlebury", state: "VI", postalCode: "05753" })).ok).toBe(true);
  });

  it("requires a real source URL and refuses a non-http website", () => {
    expect(validateLead(lead({ sourceUrl: "not a url" })).ok).toBe(false);
    expect(validateLead(lead({ website: "javascript:alert(1)" })).ok).toBe(false);
    expect(validateLead(lead({ website: null })).ok).toBe(true);
  });
});

describe("validateLeadFile", () => {
  it("accepts a well-formed record", () => {
    expect(validateLeadFile(file()).ok).toBe(true);
  });

  it("refuses a bare array, which is raw scraper output rather than a record", () => {
    expect(validateLeadFile([lead()]).ok).toBe(false);
  });

  it("requires provenance and a note", () => {
    expect(validateLeadFile(file({ source: undefined })).ok).toBe(false);
    expect(validateLeadFile(file({ scrapedAt: "Sep 2026" })).ok).toBe(false);
    // The note is where "do not trust this" lives. A record with no note is one somebody trusts.
    expect(validateLeadFile(file({ note: "" })).ok).toBe(false);
  });

  it("reports every bad lead rather than stopping at the first", () => {
    const r = validateLeadFile(
      file({ leads: [lead({ verdict: "nope" }), lead({ state: "US" }), lead()] }),
    );
    expect(r.ok).toBe(false);
    expect(r.errors?.length ?? 0).toBeGreaterThanOrEqual(2);
  });
});

describe("summarise", () => {
  it("counts duplicates out of the distinct total", () => {
    // "37 leads" was wrong the moment two pairs turned out to be one market listed twice.
    const s = summarise([
      lead(),
      lead(),
      lead({ verdict: "duplicate", checked: "2026-09-17", notes: "Same as the one above." }),
    ]);
    expect(s.total).toBe(3);
    expect(s.distinct).toBe(2);
    expect(s.pending).toBe(2);
    expect(s.usable).toBe(0);
  });

  it("counts only confirmed leads as usable", () => {
    const decided = (verdict: string) =>
      lead({ verdict, checked: "2026-09-17", notes: "Checked against the market's own site." });
    const s = summarise([decided("confirmed"), decided("bad_address"), decided("unverifiable")]);
    expect(s.usable).toBe(1);
  });
});

describe("the homesteading lead record", () => {
  const record = JSON.parse(readFileSync("data/markets/homesteading-new-leads.json", "utf8"));

  it("is valid against its own rules", () => {
    const r = validateLeadFile(record);
    expect(r.ok, why(r)).toBe(true);
  });

  it("still warns that nothing in it is importable", () => {
    // If this ever fails it is because somebody confirmed a lead, which is good — but the file's
    // note has to stop saying nothing is usable at the same time.
    expect(summarise(record.leads).usable).toBe(0);
    expect(record.note).toMatch(/NOT A USABLE WORKLIST/);
  });

  it("records a date and a reason for every finding", () => {
    for (const l of record.leads) {
      if (l.verdict === "pending") continue;
      expect(l.checked, l.name).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(String(l.notes).trim().length, l.name).toBeGreaterThan(0);
    }
  });

  it("uses no verdict outside the vocabulary", () => {
    for (const l of record.leads) expect(VERDICTS).toContain(l.verdict);
  });
});
