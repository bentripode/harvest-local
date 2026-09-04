import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * The Stripe webhook is the only writer of payment state and every delivery must be idempotent
 * (CLAUDE.md rule 2). These tests exercise the signature check and the `stripe_events` ledger gate
 * with the Stripe SDK and the Supabase admin client mocked.
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
  prior?: { processed_at: string | null } | null;
  rpcError?: { message: string } | null;
};

function makeAdmin(cfg: Cfg) {
  const calls = {
    tables: [] as string[],
    inserts: [] as unknown[],
    updates: [] as unknown[],
    rpc: [] as { fn: string; args: unknown }[],
  };

  const builder: Record<string, unknown> = {};
  const chain = () => builder;
  Object.assign(builder, {
    insert: (v: unknown) => {
      calls.inserts.push(v);
      return Promise.resolve({ error: cfg.insertError ?? null });
    },
    update: (v: unknown) => {
      calls.updates.push(v);
      return builder;
    },
    select: chain,
    eq: chain,
    or: chain,
    maybeSingle: () => Promise.resolve({ data: cfg.prior ?? null, error: null }),
    then: (resolve: (r: unknown) => void) => resolve({ data: null, error: null }),
  });

  const admin = {
    from: (t: string) => {
      calls.tables.push(t);
      return builder;
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
      id: "evt_1",
      type: "checkout.session.completed",
    });
    expect(h.current.calls.rpc).toEqual([
      {
        fn: "finalize_paid_order",
        args: expect.objectContaining({ p_order_id: "order_1", p_payment_intent_id: "pi_1" }),
      },
    ]);
    expect(h.current.calls.updates.at(-1)).toMatchObject({ error: null });
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
    expect(h.current.calls.updates.at(-1)).toMatchObject({ error: expect.stringContaining("boom") });
  });
});
