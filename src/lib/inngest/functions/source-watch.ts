import "server-only";

import { createHash } from "node:crypto";

import { inngest } from "@/lib/inngest/client";
import { createAdminClient } from "@/lib/supabase/admin";
import { queueNotificationForEach } from "@/lib/notifications/queue";
import {
  chooseSignal,
  detectMove,
  type SourceSnapshot,
} from "@/lib/compliance/source-watch";

/**
 * Nightly: has any source document moved since we read it?
 *
 * `compliance_change_log` catches an admin editing a row. This catches the thing that actually went
 * wrong repeatedly during the verification pass — the statute changing while our row sat still.
 * Vermont is the case that nearly got through: three rows cited "VT Admin. Code 12-5-52 §§ 6.1.1
 * and 6.2.1", the rule was replaced, and the replacement also has a 6.1.1 and a 6.2.1. The citation
 * resolved. Only the content underneath had been swapped.
 *
 * No fetch can tell us the law changed. It can tell us the document moved, and then a person looks.
 *
 * COURTESY TO THE PUBLISHERS. Many rows share a URL — Vermont's four programmes cite two documents
 * between them — so the work is deduplicated by URL, and it asks for a HEAD first, falling back to
 * GET only when the host will not answer one. These are state legislature servers and we are a
 * guest on them.
 */

const FETCH_TIMEOUT_MS = 15_000;

async function snapshot(url: string): Promise<SourceSnapshot | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  try {
    // HEAD first: if the host sends validators, that is the whole job and no body moves.
    const head = await fetch(url, {
      method: "HEAD",
      redirect: "follow",
      signal: controller.signal,
      headers: { "user-agent": "HarvestLocal-compliance-watch/1.0" },
    }).catch(() => null);

    if (head?.ok) {
      const etag = head.headers.get("etag");
      const lastModified = head.headers.get("last-modified");
      if (etag || lastModified) return { etag, lastModified, contentHash: null };
    }

    const res = await fetch(url, {
      redirect: "follow",
      signal: controller.signal,
      headers: { "user-agent": "HarvestLocal-compliance-watch/1.0" },
    });
    if (!res.ok) return null;

    const etag = res.headers.get("etag");
    const lastModified = res.headers.get("last-modified");
    const body = Buffer.from(await res.arrayBuffer());
    return {
      etag,
      lastModified,
      contentHash: createHash("sha256").update(body).digest("hex"),
    };
  } catch {
    // A timeout or a refused connection is not a change. Say nothing rather than cry wolf.
    return null;
  } finally {
    clearTimeout(timer);
  }
}

export const sourceWatch = inngest.createFunction(
  {
    id: "compliance-source-watch",
    name: "Compliance source watch",
    // One at a time: these are other people's servers.
    concurrency: { limit: 1 },
    triggers: [{ cron: "0 4 * * *" }],
  },
  async ({ step }) => {
    const admin = createAdminClient();

    const targets = await step.run("load-sources", async () => {
      const [{ data: programs }, { data: rules }] = await Promise.all([
        admin
          .from("state_food_programs")
          .select("id, state_code, name, source_url, source_etag, source_last_modified, source_content_hash, source_signal"),
        admin
          .from("state_label_rules")
          .select("program_id, source_url, source_etag, source_last_modified, source_content_hash, source_signal"),
      ]);

      // Deduplicate by URL — Vermont's four programmes cite two documents between them, and asking
      // a legislature server the same question four times a night is rude and pointless.
      const byUrl = new Map<
        string,
        {
          url: string;
          stored: {
            etag: string | null;
            lastModified: string | null;
            contentHash: string | null;
            signal: string | null;
          };
          programs: string[];
          rules: string[];
        }
      >();

      for (const p of programs ?? []) {
        if (!p.source_url) continue;
        const entry = byUrl.get(p.source_url) ?? {
          url: p.source_url,
          stored: {
            etag: p.source_etag,
            lastModified: p.source_last_modified,
            contentHash: p.source_content_hash,
            signal: p.source_signal,
          },
          programs: [],
          rules: [],
        };
        entry.programs.push(p.id);
        byUrl.set(p.source_url, entry);
      }
      for (const r of rules ?? []) {
        if (!r.source_url) continue;
        const entry = byUrl.get(r.source_url) ?? {
          url: r.source_url,
          stored: {
            etag: r.source_etag,
            lastModified: r.source_last_modified,
            contentHash: r.source_content_hash,
            signal: r.source_signal,
          },
          programs: [],
          rules: [],
        };
        entry.rules.push(r.program_id);
        byUrl.set(r.source_url, entry);
      }

      return [...byUrl.values()];
    });

    const moved: { url: string; reason: string; signal: string }[] = [];
    let checked = 0;
    let unreachable = 0;

    for (const target of targets) {
      const result = await step.run(`check-${target.url}`, async () => {
        const fresh = await snapshot(target.url);
        if (!fresh) return { ok: false as const };

        const verdict = detectMove(
          { ...target.stored, signal: target.stored.signal as never },
          fresh,
        );
        const signal = verdict.signal ?? chooseSignal(fresh);

        const patch = {
          source_etag: fresh.etag,
          source_last_modified: fresh.lastModified,
          source_content_hash: fresh.contentHash,
          source_signal: signal,
          source_fetched_at: new Date().toISOString(),
          // Only stamped on an actual move; a quiet night must not reset the flag an admin has not
          // dealt with yet.
          ...(verdict.moved ? { source_changed_at: new Date().toISOString() } : {}),
        };

        if (target.programs.length > 0) {
          await admin.from("state_food_programs").update(patch).in("id", target.programs);
        }
        if (target.rules.length > 0) {
          await admin.from("state_label_rules").update(patch).in("program_id", target.rules);
        }

        return { ok: true as const, verdict };
      });

      checked += 1;
      if (!result.ok) {
        unreachable += 1;
        continue;
      }
      if (result.verdict.moved) {
        moved.push({
          url: target.url,
          reason: result.verdict.reason ?? "The document moved.",
          signal: result.verdict.signal ?? "content_hash",
        });
      }
    }

    if (moved.length > 0) {
      await step.run("notify-admins", async () => {
        const { data: admins } = await admin.from("profiles").select("id").eq("role", "admin");
        const recipients = (admins ?? []).map((a) => a.id);
        if (recipients.length === 0) return { queued: 0 };

        await queueNotificationForEach(admin, recipients, {
          template: "compliance_source_moved",
          payload: {
            count: moved.length,
            urls: moved.map((m) => m.url),
            // A moved ETag is the publisher saying so; a moved hash may be a re-render. The admin
            // is given the difference rather than one undifferentiated alarm.
            weak: moved.every((m) => m.signal === "content_hash"),
          },
        });
        return { queued: recipients.length };
      });
    }

    return { checked, moved: moved.length, unreachable };
  },
);
