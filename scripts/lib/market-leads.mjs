/**
 * Validation for a market LEAD list (`data/markets/*-leads.json`). Pure, so the rules are tested
 * rather than trusted.
 *
 * A lead is a market some directory names that we have no `markets` row for, plus what a person
 * found when they went and checked it. It is deliberately NOT the same shape as
 * `data/markets/research-<state>.json`: a research entry annotates a market we already have and is
 * keyed on its `slug`, which a lead by definition does not have yet. The two files also differ in
 * what they are for — research is published to the database by
 * `scripts/apply-market-research.mjs`, and **nothing here writes to the database at all**. A lead
 * is a name to go and check; `markets` rows come from the USDA import or an admin.
 *
 * The reason this file exists rather than the leads sitting in a bare array is that the first lead
 * list was not usable and the record had to be able to say so. See the file-level `note` in
 * `homesteading-new-leads.json`: reading four of the 37 against their own source pages turned up
 * two separate classes of defect, one ours and one the directory's, and an unannotated array had
 * nowhere to put that. A lead list whose defects are not written down is one somebody trusts.
 *
 * Refuses, never repairs — same rule as `market-research.mjs`. A verdict recorded without a date
 * or a reason is an assertion nobody can audit, so both are required for every verdict but
 * `pending`.
 */

/**
 * The fixed vocabulary of outcomes. Fixed for the reason `required_elements` and the allergen
 * vocabulary are: a typo in a free-text verdict is a lead that quietly drops out of every count.
 *
 *   pending       nobody has looked yet. The only verdict allowed with no date and no reason.
 *   confirmed     name AND address verified against the market's own site or another primary
 *                 source. The only verdict that means "worth adding".
 *   bad_address   the address does not belong to the market named. Whether that is our parse or
 *                 the directory's own listing goes in `notes` — both happen, and they are
 *                 different problems with different fixes.
 *   bad_state     the state code is wrong, which matters more than the rest of the address
 *                 because state is the field rule 1 turns on.
 *   duplicate     the same market as another lead in this file, or already in `markets`.
 *   closed        verified no longer operating.
 *   not_a_market  the listing is not a farmers market.
 *   unverifiable  looked, and found no primary source either way. Not the same as `pending`.
 */
export const VERDICTS = [
  "pending",
  "confirmed",
  "bad_address",
  "bad_state",
  "duplicate",
  "closed",
  "not_a_market",
  "unverifiable",
];

/** Verdicts that are a finding about the lead rather than the absence of one. */
const DECIDED = VERDICTS.filter((v) => v !== "pending");

const US_STATES = new Set(
  ("AL AK AZ AR CA CO CT DE DC FL GA HI ID IL IN IA KS KY LA ME MD MA MI MN MS MO MT NE NV NH NJ " +
    "NM NY NC ND OH OK OR PA RI SC SD TN TX UT VT VA WA WV WI WY AS GU MP PR VI").split(" "),
);

function httpUrl(raw) {
  if (raw == null) return null;
  try {
    const u = new URL(String(raw));
    return u.protocol === "http:" || u.protocol === "https:" ? u.toString() : undefined;
  } catch {
    return undefined;
  }
}

/**
 * One lead → `{ ok: true, value }` or `{ ok: false, errors }`.
 *
 * `state` is allowed to be absent or wrong-looking, because recording a lead whose state we could
 * not read is the point of having a lead list. What is NOT allowed is a state that is not a real
 * code at all — that is the `"US"` bug `homesteading.mjs` already had to fix once.
 */
export function validateLead(lead) {
  const errors = [];
  const where = lead?.sourceUrl ?? lead?.name ?? "?";

  if (!lead?.name || typeof lead.name !== "string") errors.push(`${where}: name is required`);
  if (httpUrl(lead?.sourceUrl) == null) errors.push(`${where}: sourceUrl must be an http(s) URL`);
  if (httpUrl(lead?.website) === undefined) errors.push(`${where}: website is not an http(s) URL`);

  if (lead?.state != null && !US_STATES.has(String(lead.state))) {
    errors.push(`${where}: state "${lead.state}" is not a two-letter US code`);
  }

  const verdict = lead?.verdict;
  if (!VERDICTS.includes(verdict)) {
    errors.push(`${where}: verdict must be one of ${VERDICTS.join(", ")}`);
  } else if (DECIDED.includes(verdict)) {
    // A finding needs a date and a reason, or nobody can tell a checked lead from a guessed one.
    if (!/^\d{4}-\d{2}-\d{2}$/.test(lead?.checked ?? "")) {
      errors.push(`${where}: verdict "${verdict}" needs checked as YYYY-MM-DD`);
    }
    if (!lead?.notes || String(lead.notes).trim().length === 0) {
      errors.push(`${where}: verdict "${verdict}" needs notes saying what was found`);
    }
  } else if (lead?.checked != null) {
    errors.push(`${where}: pending leads must have checked: null`);
  }

  if (errors.length > 0) return { ok: false, errors };
  return { ok: true, value: lead };
}

/** Every lead in a file, or the errors across all of them — never a partial pass. */
export function validateLeadFile(file) {
  const errors = [];
  if (!file || typeof file !== "object" || Array.isArray(file)) {
    return { ok: false, errors: ["file must be an object with source, scrapedAt, note and leads"] };
  }
  if (httpUrl(file.source) == null) errors.push("source must be an http(s) URL");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(file.scrapedAt ?? "")) {
    errors.push("scrapedAt must be YYYY-MM-DD");
  }
  if (!file.note || String(file.note).trim().length === 0) {
    errors.push("note is required — say what this list is and how much to trust it");
  }
  if (!Array.isArray(file.leads) || file.leads.length === 0) {
    errors.push("leads must be a non-empty array");
    return { ok: false, errors };
  }
  for (const lead of file.leads) {
    const r = validateLead(lead);
    if (!r.ok) errors.push(...r.errors);
  }
  return errors.length > 0 ? { ok: false, errors } : { ok: true, value: file };
}

/**
 * How much of a lead list is left to work through, by verdict.
 *
 * `distinct` deliberately counts leads that are not marked `duplicate`, because the headline "37
 * leads" was wrong the moment two pairs of them turned out to be the same market listed twice.
 */
export function summarise(leads) {
  const byVerdict = Object.fromEntries(VERDICTS.map((v) => [v, 0]));
  for (const lead of leads) {
    if (lead?.verdict in byVerdict) byVerdict[lead.verdict] += 1;
  }
  return {
    total: leads.length,
    distinct: leads.length - byVerdict.duplicate,
    pending: byVerdict.pending,
    usable: byVerdict.confirmed,
    byVerdict,
  };
}
