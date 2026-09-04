import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/auth", () => ({
  requireRole: vi.fn().mockResolvedValue({ user: { id: "seller-user" }, profile: {} }),
}));

const h = vi.hoisted(() => ({
  update: vi.fn(),
  result: { data: [{ id: "review-1" }] as unknown, error: null as unknown },
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    from: () => ({
      update: (v: unknown) => {
        h.update(v);
        return { eq: () => ({ select: () => Promise.resolve(h.result) }) };
      },
    }),
  }),
}));

import { respondToReviewAction } from "@/app/(dashboard)/seller/actions";

function fd(entries: Record<string, string>) {
  const f = new FormData();
  for (const [k, v] of Object.entries(entries)) f.append(k, v);
  return f;
}

beforeEach(() => {
  h.update.mockReset();
  h.result = { data: [{ id: "review-1" }], error: null };
});

describe("respondToReviewAction", () => {
  const id = "11111111-1111-4111-8111-111111111111";

  it("writes the reply and a responded_at timestamp", async () => {
    const res = await respondToReviewAction({}, fd({ reviewId: id, response: "Thanks so much!" }));
    expect(res).toEqual({ ok: true });
    const arg = h.update.mock.calls[0][0] as { response: string; responded_at: string | null };
    expect(arg.response).toBe("Thanks so much!");
    expect(typeof arg.responded_at).toBe("string");
  });

  it("clears the reply (and the timestamp) on an empty string", async () => {
    const res = await respondToReviewAction({}, fd({ reviewId: id, response: "   " }));
    expect(res).toEqual({ ok: true });
    expect(h.update.mock.calls[0][0]).toEqual({ response: null, responded_at: null });
  });

  it("rejects a non-uuid review id without touching the DB", async () => {
    const res = await respondToReviewAction({}, fd({ reviewId: "nope", response: "hi" }));
    expect(res.error).toBeTruthy();
    expect(h.update).not.toHaveBeenCalled();
  });

  it("rejects a reply over 2000 chars", async () => {
    const res = await respondToReviewAction({}, fd({ reviewId: id, response: "x".repeat(2001) }));
    expect(res.error).toBeTruthy();
    expect(h.update).not.toHaveBeenCalled();
  });

  it("reports when RLS matched no row (not the seller's review)", async () => {
    h.result = { data: [], error: null };
    const res = await respondToReviewAction({}, fd({ reviewId: id, response: "hi" }));
    expect(res.error).toBe("That review isn't yours to reply to.");
  });

  it("surfaces the column-guard error in plain language", async () => {
    h.result = { data: null, error: { message: "only a review's response may be edited" } };
    const res = await respondToReviewAction({}, fd({ reviewId: id, response: "hi" }));
    expect(res.error).toBe("You can only edit the reply.");
  });
});
