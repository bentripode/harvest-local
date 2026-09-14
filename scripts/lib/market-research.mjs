/**
 * Validation for researched market details (`data/markets/research-<state>.json`), applied by
 * `scripts/apply-market-research.mjs`. Pure, so the rules are tested rather than trusted: this is
 * data a person or Claude typed after reading listings, and it is published directly.
 *
 * Refuses, never repairs. An entry with a malformed time or an unknown day is an error to fix in
 * the file, not something to half-apply — a half-read schedule reads as the whole one.
 */

const DAYS = { sun: 0, mon: 1, tue: 2, wed: 3, thu: 4, fri: 5, sat: 6 };
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function hhmm(raw) {
  const m = typeof raw === "string" ? raw.trim().match(/^(\d{1,2}):(\d{2})$/) : null;
  if (!m || Number(m[1]) > 23 || Number(m[2]) > 59) return null;
  return `${m[1].padStart(2, "0")}:${m[2]}`;
}

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
 * One research entry → `{ ok: true, value }` or `{ ok: false, errors }`. `value.hours` is null when
 * the entry records none; `value.sourceNote` carries the check date so a buyer sees how old it is.
 */
export function validateEntry(entry) {
  const errors = [];
  const where = `${entry?.state ?? "?"}/${entry?.slug ?? "?"}`;
  if (!/^[A-Z]{2}$/.test(entry?.state ?? "")) errors.push(`${where}: state must be two capital letters`);
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(entry?.slug ?? "")) errors.push(`${where}: bad slug`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(entry?.checked ?? "")) errors.push(`${where}: checked must be YYYY-MM-DD`);

  const website = httpUrl(entry?.website);
  if (website === undefined) errors.push(`${where}: website is not an http(s) URL`);
  const facebook = httpUrl(entry?.facebook);
  if (facebook === undefined || (facebook && !/(^|\.)facebook\.com$/i.test(new URL(facebook).hostname))) {
    errors.push(`${where}: facebook must be a facebook.com URL`);
  }

  let hours = null;
  if (entry?.hours != null) {
    if (!Array.isArray(entry.hours) || entry.hours.length === 0) {
      errors.push(`${where}: hours must be a non-empty array or null`);
    } else {
      hours = [];
      for (const h of entry.hours) {
        const day = DAYS[String(h?.day ?? "").slice(0, 3).toLowerCase()];
        const opens = hhmm(h?.opens);
        const closes = hhmm(h?.closes);
        if (day === undefined) errors.push(`${where}: unknown day "${h?.day}"`);
        else if (!opens || !closes) errors.push(`${where}: times must be HH:MM (24-hour)`);
        else if (closes <= opens) errors.push(`${where}: ${h.day} closes before it opens`);
        else hours.push({ dayOfWeek: day, opens, closes });
      }
    }
    if (!entry.hoursSourceNote) errors.push(`${where}: hours need hoursSourceNote (where they came from)`);
    const src = httpUrl(entry.hoursSourceUrl);
    if (!src) errors.push(`${where}: hours need an http(s) hoursSourceUrl`);
  }

  if (errors.length > 0) return { ok: false, errors };

  const [y, m] = entry.checked.split("-").map(Number);
  return {
    ok: true,
    value: {
      state: entry.state,
      slug: entry.slug,
      website: website ?? null,
      facebook: facebook ?? null,
      hours,
      season: entry.season ? String(entry.season) : null,
      sourceNote: hours ? `${entry.hoursSourceNote}; checked ${MONTHS[m - 1]} ${y}` : null,
      sourceUrl: hours ? httpUrl(entry.hoursSourceUrl) : null,
    },
  };
}
