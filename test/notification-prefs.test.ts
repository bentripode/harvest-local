import { beforeEach, describe, expect, it, vi } from "vitest";

import { emailEnabled } from "@/lib/notifications/categories";

describe("emailEnabled", () => {
  it("always sends non-suppressible categories (payments, compliance)", () => {
    expect(emailEnabled({ payments: false }, "refund_issued")).toBe(true);
    expect(emailEnabled({ compliance: false }, "license_expired")).toBe(true);
    expect(emailEnabled({ compliance: false }, "revenue_cap_reached")).toBe(true);
  });

  it("defaults to sending when there is no matching opt-out", () => {
    expect(emailEnabled(null, "order_status_changed")).toBe(true);
    expect(emailEnabled({}, "order_status_changed")).toBe(true);
    expect(emailEnabled({ referrals: false }, "order_status_changed")).toBe(true);
  });

  it("suppresses when the category is opted out", () => {
    expect(emailEnabled({ order_updates: false }, "order_status_changed")).toBe(false);
    expect(emailEnabled({ referrals: false }, "referral_reward_earned")).toBe(false);
    expect(emailEnabled({ license_reminders: false }, "license_expiring")).toBe(false);
  });

  it("sends unknown templates rather than dropping them", () => {
    expect(emailEnabled({ order_updates: false }, "something_new")).toBe(true);
  });
});

const h = vi.hoisted(() => ({
  send: vi.fn(),
  inserted: [] as Array<Record<string, unknown>>,
  prefs: {} as Record<string, boolean>,
  profileReads: 0,
}));

vi.mock("@/lib/inngest/client", () => ({
  inngest: {
    send: (...a: unknown[]) => {
      h.send(...a);
      return Promise.resolve();
    },
  },
}));

function fakeAdmin() {
  return {
    from(table: string) {
      if (table === "profiles") {
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: async () => {
                h.profileReads++;
                return { data: { notification_prefs: h.prefs } };
              },
            }),
          }),
        };
      }
      return {
        insert: async (rows: Array<Record<string, unknown>>) => {
          h.inserted.push(...rows);
          return { error: null };
        },
      };
    },
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- the fake admin is structurally what queueNotification touches
const admin = fakeAdmin() as any;

import { queueNotification } from "@/lib/notifications/queue";

beforeEach(() => {
  h.send.mockReset();
  h.inserted = [];
  h.prefs = {};
  h.profileReads = 0;
});

describe("queueNotification + prefs", () => {
  it("drops the email row when the recipient opted out, keeps in_app", async () => {
    h.prefs = { order_updates: false };

    const result = await queueNotification(admin, {
      userId: "buyer-1",
      template: "order_status_changed",
      payload: {},
    });

    expect(result).toBe(true);
    expect(h.inserted.map((r) => r.channel)).toEqual(["in_app"]);
    expect(h.send).not.toHaveBeenCalled(); // no non-in_app channel left to dispatch
  });

  it("sends both channels when opted in", async () => {
    const result = await queueNotification(admin, {
      userId: "buyer-1",
      template: "order_status_changed",
      payload: {},
    });

    expect(result).toBe(true);
    expect(h.inserted.map((r) => r.channel).sort()).toEqual(["email", "in_app"]);
    expect(h.send).toHaveBeenCalledOnce();
  });

  it("returns false and inserts nothing when the only channel is a suppressed email", async () => {
    h.prefs = { referrals: false };

    const result = await queueNotification(admin, {
      userId: "seller-1",
      template: "referral_reward_earned",
      payload: {},
      channels: ["email"],
    });

    expect(result).toBe(false);
    expect(h.inserted).toHaveLength(0);
    expect(h.send).not.toHaveBeenCalled();
  });

  it("skips the profile read for a non-suppressible template", async () => {
    h.prefs = { payments: false };

    await queueNotification(admin, {
      userId: "buyer-1",
      template: "refund_issued",
      payload: {},
    });

    expect(h.profileReads).toBe(0);
    expect(h.inserted.map((r) => r.channel).sort()).toEqual(["email", "in_app"]);
  });
});
