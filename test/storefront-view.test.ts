import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({ rpc: vi.fn() }));

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({ rpc: (...a: unknown[]) => h.rpc(...a) }),
}));

import { recordStorefrontViewAction } from "@/app/(shop)/s/[slug]/actions";

const id = "11111111-1111-4111-8111-111111111111";

beforeEach(() => {
  h.rpc.mockReset();
  h.rpc.mockResolvedValue({ error: null });
});

describe("recordStorefrontViewAction", () => {
  it("calls record_storefront_view with the seller id", async () => {
    await recordStorefrontViewAction(id);
    expect(h.rpc).toHaveBeenCalledWith("record_storefront_view", { p_seller_id: id });
  });

  it("ignores a non-uuid without hitting the DB", async () => {
    await recordStorefrontViewAction("not-a-uuid");
    expect(h.rpc).not.toHaveBeenCalled();
  });

  it("swallows an RPC failure — the metric is advisory", async () => {
    h.rpc.mockImplementation(() => Promise.reject(new Error("db down")));
    await expect(recordStorefrontViewAction(id)).resolves.toBeUndefined();
  });
});
