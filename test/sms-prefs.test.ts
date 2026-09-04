import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/env", () => ({ env: {} }));
vi.mock("@/lib/geo/geocode", () => ({ geocodeAddress: vi.fn() }));
vi.mock("@/lib/auth", () => ({
  requireUser: vi.fn().mockResolvedValue({ user: { id: "buyer-1" }, profile: {} }),
}));

const h = vi.hoisted(() => ({
  update: vi.fn(),
  currentPrefs: {} as Record<string, boolean>,
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    from: () => ({
      select: () => ({
        eq: () => ({ single: async () => ({ data: { notification_prefs: h.currentPrefs } }) }),
      }),
      update: (v: unknown) => {
        h.update(v);
        return { eq: async () => ({ error: null }) };
      },
    }),
  }),
}));

import { saveSmsPrefsAction } from "@/app/(shop)/account/actions";

function fd(entries: Record<string, string>) {
  const f = new FormData();
  for (const [k, v] of Object.entries(entries)) f.append(k, v);
  return f;
}

beforeEach(() => {
  h.update.mockReset();
  h.currentPrefs = {};
});

describe("saveSmsPrefsAction", () => {
  it("normalises a US number to E.164 and records the opt-in", async () => {
    const res = await saveSmsPrefsAction({}, fd({ phone: "(512) 555-0123", sms_order_updates: "on" }));
    expect(res).toEqual({ ok: true });
    expect(h.update).toHaveBeenCalledWith({
      phone: "+15125550123",
      notification_prefs: { "sms:order_updates": true },
    });
  });

  it("accepts a leading 1 / +1", async () => {
    await saveSmsPrefsAction({}, fd({ phone: "+1 512-555-0123", sms_order_updates: "on" }));
    expect((h.update.mock.calls[0][0] as { phone: string }).phone).toBe("+15125550123");
  });

  it("clears the phone and the opt-in when the field is blank and unchecked", async () => {
    h.currentPrefs = { "sms:order_updates": true, order_updates: false };
    const res = await saveSmsPrefsAction({}, fd({ phone: "" }));
    expect(res).toEqual({ ok: true });
    expect(h.update).toHaveBeenCalledWith({
      phone: null,
      notification_prefs: { order_updates: false },
    });
  });

  it("rejects a malformed number", async () => {
    const res = await saveSmsPrefsAction({}, fd({ phone: "555-0123" }));
    expect(res.error).toMatch(/10-digit/);
    expect(h.update).not.toHaveBeenCalled();
  });

  it("won't opt in without a number on file", async () => {
    const res = await saveSmsPrefsAction({}, fd({ phone: "", sms_order_updates: "on" }));
    expect(res.error).toMatch(/mobile number/);
    expect(h.update).not.toHaveBeenCalled();
  });
});
