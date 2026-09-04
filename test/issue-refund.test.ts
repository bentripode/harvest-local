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
  priorRefunds: [] as { amount: string }[],
  upserts: [] as unknown[],
}));

vi.mock("@/lib/stripe/client", () => ({
  stripe: { refunds: { create: (...a: unknown[]) => h.refundsCreate(...a) } },
}));

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    from: (table: string) => ({
      select: () => ({
        // orders: `.eq(...).maybeSingle()` ; refunds: `.eq(...)` awaited for the prior-rows list
        eq: () => {
          const result =
            table === "orders" ? { data: h.order } : { data: h.priorRefunds };
          return Object.assign(Promise.resolve(result), {
            maybeSingle: async () => result,
          });
        },
      }),
      upsert: async (v: unknown) => {
        h.upserts.push(v);
        return { error: null };
      },
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
  h.priorRefunds = [];
  h.upserts = [];
});

describe("issueRefundAction", () => {
  it("refunds the full remaining balance (no amount) — Stripe gets no `amount`", async () => {
    const res = await issueRefundAction({}, fd());
    expect(res).toEqual({ ok: true });
    const [params, opts] = h.refundsCreate.mock.calls[0] as [Record<string, unknown>, { idempotencyKey: string }];
    expect(params).not.toHaveProperty("amount");
    expect(params).toMatchObject({ payment_intent: "pi_1", reverse_transfer: true });
    expect(opts.idempotencyKey).toBe("refund:11111111-1111-4111-8111-111111111111:0");
  });

  it("passes a cents amount for a partial refund", async () => {
    h.refundsCreate.mockResolvedValue({ id: "re_2", amount: 1250 });
    const res = await issueRefundAction({}, fd({ amount: "12.50" }));
    expect(res).toEqual({ ok: true });
    expect((h.refundsCreate.mock.calls[0][0] as Record<string, unknown>).amount).toBe(1250);
  });

  it("validates against the REMAINING balance, and keys on the cumulative-refunded position", async () => {
    h.priorRefunds = [{ amount: "20.00" }]; // $10 left of $30
    const res = await issueRefundAction({}, fd({ amount: "12" }));
    expect(res.error).toContain("Only $10.00 is left to refund");
    expect(h.refundsCreate).not.toHaveBeenCalled();
  });

  it("allows a further partial while a balance remains", async () => {
    h.priorRefunds = [{ amount: "20.00" }];
    h.refundsCreate.mockResolvedValue({ id: "re_3", amount: 500 });
    const res = await issueRefundAction({}, fd({ amount: "5" }));
    expect(res).toEqual({ ok: true });
    const opts = h.refundsCreate.mock.calls[0][1] as { idempotencyKey: string };
    expect(opts.idempotencyKey).toBe("refund:11111111-1111-4111-8111-111111111111:2000");
    expect(h.upserts[0]).toMatchObject({ stripe_refund_id: "re_3", amount: "5.00" });
  });

  it("refuses once the order is already fully refunded", async () => {
    h.priorRefunds = [{ amount: "30.00" }];
    const res = await issueRefundAction({}, fd({ amount: "5" }));
    expect(res.error).toContain("already fully refunded");
    expect(h.refundsCreate).not.toHaveBeenCalled();
  });
});
