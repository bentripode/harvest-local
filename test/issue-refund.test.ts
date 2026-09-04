import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/env", () => ({ env: {} }));
vi.mock("@/lib/supabase/server", () => ({ createClient: async () => ({}) }));
vi.mock("@/lib/auth", () => ({
  requireRole: vi.fn().mockResolvedValue({ user: { id: "admin-1" }, profile: {} }),
}));

const h = vi.hoisted(() => ({
  refundsCreate: vi.fn(),
  order: { id: "order-1", status: "completed", total: "30.00", stripe_payment_intent_id: "pi_1" } as
    | Record<string, unknown>
    | null,
  existingRefund: null as { id: string } | null,
}));

vi.mock("@/lib/stripe/client", () => ({
  stripe: { refunds: { create: (...a: unknown[]) => h.refundsCreate(...a) } },
}));

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    from: (table: string) => ({
      select: () => ({
        eq: () => ({
          maybeSingle: async () =>
            table === "orders" ? { data: h.order } : { data: h.existingRefund },
        }),
      }),
      upsert: async () => ({ error: null }),
      update: () => ({ eq: async () => ({ error: null }) }),
    }),
  }),
}));

import { issueRefundAction } from "@/app/admin/actions";

function fd(over: Record<string, string> = {}) {
  const f = new FormData();
  f.append("orderId", "11111111-1111-4111-8111-111111111111");
  for (const [k, v] of Object.entries(over)) f.append(k, v);
  return f;
}

beforeEach(() => {
  h.refundsCreate.mockReset().mockResolvedValue({ id: "re_1", amount: 3000 });
  h.order = { id: "order-1", status: "completed", total: "30.00", stripe_payment_intent_id: "pi_1" };
  h.existingRefund = null;
});

describe("issueRefundAction", () => {
  it("issues a full refund (no amount) — Stripe gets no `amount`", async () => {
    const res = await issueRefundAction({}, fd());
    expect(res).toEqual({ ok: true });
    const [params] = h.refundsCreate.mock.calls[0] as [Record<string, unknown>];
    expect(params).not.toHaveProperty("amount");
    expect(params).toMatchObject({ payment_intent: "pi_1", reverse_transfer: true });
  });

  it("passes a cents amount for a partial refund", async () => {
    h.refundsCreate.mockResolvedValue({ id: "re_2", amount: 1250 });
    const res = await issueRefundAction({}, fd({ amount: "12.50" }));
    expect(res).toEqual({ ok: true });
    expect((h.refundsCreate.mock.calls[0][0] as Record<string, unknown>).amount).toBe(1250);
  });

  it("treats an amount equal to the total as a full refund", async () => {
    await issueRefundAction({}, fd({ amount: "30.00" }));
    expect(h.refundsCreate.mock.calls[0][0]).not.toHaveProperty("amount");
  });

  it("rejects an amount over the order total without calling Stripe", async () => {
    const res = await issueRefundAction({}, fd({ amount: "40" }));
    expect(res.error).toContain("more than the order total");
    expect(h.refundsCreate).not.toHaveBeenCalled();
  });

  it("refuses a second refund on the same order", async () => {
    h.existingRefund = { id: "rf_1" };
    const res = await issueRefundAction({}, fd({ amount: "5" }));
    expect(res.error).toContain("already been refunded");
    expect(h.refundsCreate).not.toHaveBeenCalled();
  });
});
