import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({ rpc: vi.fn() }));

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({ rpc: (...a: unknown[]) => h.rpc(...a) }),
}));

import { RATE_LIMITS, tryRateLimit } from "@/lib/rate-limit";

beforeEach(() => h.rpc.mockReset());

describe("tryRateLimit", () => {
  it("passes the key and limit through to check_rate_limit", async () => {
    h.rpc.mockResolvedValue({ data: [{ allowed: true, retry_after: 0 }], error: null });

    const result = await tryRateLimit("checkout:user-1", RATE_LIMITS.checkout);

    expect(result).toBeNull();
    expect(h.rpc).toHaveBeenCalledWith("check_rate_limit", {
      p_key: "checkout:user-1",
      p_max: RATE_LIMITS.checkout.max,
      p_window_secs: RATE_LIMITS.checkout.windowSecs,
    });
  });

  it("returns a message with the retry hint when the window is exhausted", async () => {
    h.rpc.mockResolvedValue({ data: [{ allowed: false, retry_after: 12 }], error: null });

    const result = await tryRateLimit("message:user-1", RATE_LIMITS.message, "send messages");

    expect(result).toBe("You're trying to send messages too often. Try again in 12 seconds.");
  });

  it("says 'a minute' for retry hints of 60s or more", async () => {
    h.rpc.mockResolvedValue({ data: [{ allowed: false, retry_after: 240 }], error: null });

    expect(await tryRateLimit("report:user-1", RATE_LIMITS.report, "file reports")).toBe(
      "You're trying to file reports too often. Try again in a minute.",
    );
  });

  it("fails open when the limiter errors — checkout must not go down", async () => {
    h.rpc.mockResolvedValue({ data: null, error: { message: "connection reset" } });

    expect(await tryRateLimit("checkout:user-1", RATE_LIMITS.checkout)).toBeNull();
  });

  it("handles a single-object (non-array) RPC result", async () => {
    h.rpc.mockResolvedValue({ data: { allowed: false, retry_after: 5 }, error: null });

    expect(await tryRateLimit("promo:user-1", RATE_LIMITS.promo, "try codes")).toContain("5 seconds");
  });
});
