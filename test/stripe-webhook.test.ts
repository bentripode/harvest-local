import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * The Stripe webhook is the only writer of payment state and every delivery must be idempotent
 * (CLAUDE.md rule 2). These tests exercise the signature check, the `stripe_events` ledger gate,
 * and the `charge.refunded` reconciliation with the Stripe SDK and the Supabase admin client
 * mocked. `makeAdmin` routes queries by table so a handler that reads several tables can be
 * exercised.
 */

const h = vi.hoisted(() => ({
  constructEvent: vi.fn(),
  current: null as ReturnType<typeof makeAdmin> | null,
}));

vi.mock("next/server", () => ({
  NextResponse: {
    json: (body: unknown, init?: { status?: number }) => ({
      status: init?.status ?? 200,
      json: async () => body,
    }),
  },
}));
vi.mock("@/lib/env", () => ({
  env: { STRIPE_WEBHOOK_SECRET: "whsec_main", STRIPE_CONNECT_WEBHOOK_SECRET: undefined },
}));
vi.mock("@/lib/stripe/client", () => ({
  stripe: { webhooks: { constructEvent: (...a: unknown[]) => h.constructEvent(...a) } },
}));
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => h.current!.admin,
}));
vi.mock("@/lib/inngest/client", () => ({
  inngest: { send: vi.fn().mockResolvedValue(undefined) },
}));
vi.mock("@sentry/nextjs", () => ({ captureException: vi.fn() }));
vi.mock("@/lib/notifications/queue", () => ({
  queueNotification: vi.fn().mockResolvedValue(undefined),
  queueNotificationForEach: vi.fn().mockResolvedValue(undefined),
}));

import { POST } from "@/app/api/webhooks/stripe/route";

type Cfg = {
  insertError?: { code: string } | null;
  /** `stripe_events` prior-row lookup. */
  prior?: { processed_at: string | null } | null;
  rpcError?: { message: string } | null;
  /** `orders` row for `unwindOrderForCharge`. */
  order?: unknown;
  /** Rows returned by `orders.update(...).select("id")` — drives `transitioned`. */
  orderUpdateRows?: unknown[];
  /** `refunds` prior-row lookup (an admin-action refund already recorded it). */
  priorRefund?: { id: string } | null;
  /** oldest open `reports` row on the order. */
  openReport?: { id: string } | null;
};

function readData(table: string, cfg: Cfg): unknown {
  switch (table) {
    case "stripe_events":
      return cfg.prior ?? null;
    case "orders":
      return cfg.order ?? null;
    case "refunds":
      return cfg.priorRefund ?? null;
    case "reports":
      return cfg.openReport ?? null;
    default:
      return null;
  }
}

function makeAdmin(cfg: Cfg) {
  const calls = {
    tables: [] as string[],
    inserts: [] as Array<{ table: string; value: unknown }>,
    upserts: [] as Array<{ table: string; value: unknown; opts: unknown }>,
    updates: [] as Array<{ table: string; value: unknown }>,
    rpc: [] as { fn: string; args: unknown }[],
  };

  function builder(table: string) {
    const state = { didUpdate: false };
    const b: Record<string, unknown> = {};
    Object.assign(b, {
      insert: (v: unknown) => {
        calls.inserts.push({ table, value: v });
        return Promise.resolve({ error: table === "stripe_events" ? (cfg.insertError ?? null) : null });
      },
      upsert: (v: unknown, opts: unknown) => {
        calls.upserts.push({ table, value: v, opts });
        return Promise.resolve({ error: null });
      },
      update: (v: unknown) => {
        calls.updates.push({ table, value: v });
        state.didUpdate = true;
        return b;
      },
      select: () => b,
      eq: () => b,
      in: () => b,
      or: () => b,
      order: () => b,
      limit: () => b,
      maybeSingle: () => Promise.resolve({ data: readData(table, cfg), error: null }),
      then: (resolve: (r: unknown) => void) => {
        if (table === "orders" && state.didUpdate) {
          resolve({ data: cfg.orderUpdateRows ?? null, error: null });
        } else {
          resolve({ data: null, error: null });
        }
      },
    });
    return b;
  }

  const admin = {
    from: (t: string) => {
      calls.tables.push(t);
      return builder(t);
    },
    rpc: (fn: string, args: unknown) => {
      calls.rpc.push({ fn, args });
      return Promise.resolve({ error: cfg.rpcError ?? null });
    },
  };

  return { admin, calls };
}

function req(body: string, signature: string | null) {
  return {
    text: async () => body,
    headers: { get: (k: string) => (k.toLowerCase() === "stripe-signature" ? signature : null) },
  } as unknown as Parameters<typeof POST>[0];
}

const checkoutEvent = {
  id: "evt_1",
  type: "checkout.session.completed",
  account: null,
  data: {
    object: {
      payment_status: "paid",
      client_reference_id: "order_1",
      payment_intent: "pi_1",
      total_details: {},
      amount_total: 2000,
    },
  },
};

const refundEvent = {
  id: "evt_refund_1",
  type: "charge.refunded",
  account: null,
  data: {
    object: {
      id: "ch_1",
      amount: 2000,
      amount_refunded: 2000,
      payment_intent: "pi_1",
      refunds: { data: [{ id: "re_1" }] },
    },
  },
};

const refundedOrder = {
  id: "order_1",
  buyer_id: "buyer_1",
  seller_id: "sp_1",
  status: "new",
  promo_code_id: null,
  seller: { profile_id: "seller_user_1", business_name: "Ben's Baked Bread" },
};

function refundCfg(over: Partial<Cfg> = {}): Cfg {
  return {
    insertError: null,
    order: refundedOrder,
    orderUpdateRows: [{ id: "order_1" }],
    priorRefund: null,
    openReport: null,
    ...over,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  h.constructEvent.mockReset();
});

describe("POST /api/webhooks/stripe", () => {
  it("rejects a request with no Stripe-Signature header", async () => {
    h.current = makeAdmin({});
    const res = await POST(req("{}", null));
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "missing signature" });
    expect(h.constructEvent).not.toHaveBeenCalled();
  });

  it("rejects a payload whose signature does not verify", async () => {
    h.current = makeAdmin({});
    h.constructEvent.mockImplementation(() => {
      throw new Error("no match");
    });
    const res = await POST(req("{}", "t=1,v1=bad"));
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "signature verification failed" });
    expect(h.current.calls.inserts).toHaveLength(0);
  });

  it("records a first-seen event and runs its handler once", async () => {
    h.current = makeAdmin({ insertError: null });
    h.constructEvent.mockReturnValue(checkoutEvent);

    const res = await POST(req(JSON.stringify(checkoutEvent), "good"));

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ received: true });
    expect(h.current.calls.inserts[0]).toMatchObject({
      table: "stripe_events",
      value: { id: "evt_1", type: "checkout.session.completed" },
    });
    expect(h.current.calls.rpc).toEqual([
      {
        fn: "finalize_paid_order",
        args: expect.objectContaining({ p_order_id: "order_1", p_payment_intent_id: "pi_1" }),
      },
    ]);
    expect(h.current.calls.updates.at(-1)?.value).toMatchObject({ error: null });
  });

  it("no-ops a duplicate delivery whose first run already completed", async () => {
    h.current = makeAdmin({
      insertError: { code: "23505" },
      prior: { processed_at: "2026-09-03T00:00:00Z" },
    });
    h.constructEvent.mockReturnValue(checkoutEvent);

    const res = await POST(req(JSON.stringify(checkoutEvent), "good"));

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ received: true, duplicate: true });
    expect(h.current.calls.rpc).toHaveLength(0);
  });

  it("re-runs a redelivery that was recorded but never processed", async () => {
    h.current = makeAdmin({
      insertError: { code: "23505" },
      prior: { processed_at: null },
    });
    h.constructEvent.mockReturnValue(checkoutEvent);

    const res = await POST(req(JSON.stringify(checkoutEvent), "good"));

    expect(res.status).toBe(200);
    expect(h.current.calls.rpc).toEqual([
      { fn: "finalize_paid_order", args: expect.objectContaining({ p_order_id: "order_1" }) },
    ]);
  });

  it("returns 500 so Stripe retries when a handler throws", async () => {
    h.current = makeAdmin({ insertError: null, rpcError: { message: "boom" } });
    h.constructEvent.mockReturnValue(checkoutEvent);

    const res = await POST(req(JSON.stringify(checkoutEvent), "good"));

    expect(res.status).toBe(500);
    expect(h.current.calls.updates.at(-1)?.value).toMatchObject({
      error: expect.stringContaining("boom"),
    });
  });
});

describe("charge.refunded → refunds.report_id backfill", () => {
  it("links and resolves the open report for a Stripe-dashboard refund", async () => {
    h.current = makeAdmin(refundCfg({ openReport: { id: "report_1" } }));
    h.constructEvent.mockReturnValue(refundEvent);

    const res = await POST(req(JSON.stringify(refundEvent), "good"));
    expect(res.status).toBe(200);

    const refundUpsert = h.current.calls.upserts.find((u) => u.table === "refunds");
    expect(refundUpsert?.value).toMatchObject({
      order_id: "order_1",
      report_id: "report_1",
      stripe_refund_id: "re_1",
      amount: "20.00",
    });

    const reportUpdate = h.current.calls.updates.find((u) => u.table === "reports");
    expect(reportUpdate?.value).toMatchObject({ status: "refunded" });
  });

  it("mirrors with a null report_id when the order has no open report", async () => {
    h.current = makeAdmin(refundCfg({ openReport: null }));
    h.constructEvent.mockReturnValue(refundEvent);

    await POST(req(JSON.stringify(refundEvent), "good"));

    const refundUpsert = h.current.calls.upserts.find((u) => u.table === "refunds");
    expect(refundUpsert?.value).toMatchObject({ order_id: "order_1", report_id: null });
    expect(h.current.calls.updates.some((u) => u.table === "reports")).toBe(false);
  });

  it("leaves the report alone when the admin action already recorded the refund", async () => {
    h.current = makeAdmin(
      refundCfg({ priorRefund: { id: "rf_1" }, openReport: { id: "report_1" } }),
    );
    h.constructEvent.mockReturnValue(refundEvent);

    await POST(req(JSON.stringify(refundEvent), "good"));

    expect(h.current.calls.upserts.some((u) => u.table === "refunds")).toBe(false);
    expect(h.current.calls.updates.some((u) => u.table === "reports")).toBe(false);
  });

  it("ignores a partial refund entirely", async () => {
    h.current = makeAdmin(refundCfg({ openReport: { id: "report_1" } }));
    h.constructEvent.mockReturnValue({
      ...refundEvent,
      data: { object: { ...refundEvent.data.object, amount_refunded: 500 } },
    });

    await POST(req(JSON.stringify(refundEvent), "good"));

    expect(h.current.calls.upserts).toHaveLength(0);
    expect(h.current.calls.tables).not.toContain("refunds");
  });
});
