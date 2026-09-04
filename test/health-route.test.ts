import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({ result: Promise.resolve({ error: null as unknown }) }));

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    from: () => ({
      select: () => ({
        limit: () => h.result,
      }),
    }),
  }),
}));

import { GET } from "@/app/api/health/route";

beforeEach(() => {
  h.result = Promise.resolve({ error: null });
});

describe("GET /api/health", () => {
  it("returns 200 and status ok when the database read succeeds", async () => {
    const res = await GET();
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({
      status: "ok",
      checks: { database: "ok" },
      timestamp: expect.any(String),
    });
  });

  it("returns 503 and status degraded when the database read errors", async () => {
    h.result = Promise.resolve({ error: { message: "connection refused" } });
    const res = await GET();
    expect(res.status).toBe(503);
    await expect(res.json()).resolves.toMatchObject({
      status: "degraded",
      checks: { database: "error" },
    });
  });

  it("returns 503 when the database read throws", async () => {
    h.result = Promise.reject(new Error("boom"));
    const res = await GET();
    expect(res.status).toBe(503);
    await expect(res.json()).resolves.toMatchObject({ checks: { database: "error" } });
  });

  it("never caches", async () => {
    const res = await GET();
    expect(res.headers.get("Cache-Control")).toBe("no-store");
  });
});
