import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/auth", () => ({
  requireUser: vi.fn().mockResolvedValue({ user: { id: "buyer-1" }, profile: {} }),
}));

const h = vi.hoisted(() => ({
  rpc: vi.fn(),
  count: 2,
  geo: { lng: -97.7, lat: 30.3 } as { lng: number; lat: number } | null,
}));

vi.mock("@/lib/geo/geocode", () => ({
  geocodeAddress: vi.fn(async () => h.geo),
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    from: () => ({
      select: () => ({ eq: () => Promise.resolve({ count: h.count }) }),
    }),
    rpc: (...a: unknown[]) => {
      h.rpc(...a);
      return Promise.resolve({ error: null });
    },
  }),
}));

import { addAddressAction } from "@/app/(shop)/account/actions";

function fd(over: Record<string, string> = {}) {
  const f = new FormData();
  const base = { label: "Home", line1: "123 Main St", line2: "", city: "Austin", state: "TX", postal: "78701" };
  for (const [k, v] of Object.entries({ ...base, ...over })) f.append(k, v);
  return f;
}

beforeEach(() => {
  h.rpc.mockReset();
  h.count = 2;
  h.geo = { lng: -97.7, lat: 30.3 };
});

describe("addAddressAction", () => {
  it("geocodes and calls upsert_address with the address", async () => {
    const res = await addAddressAction({}, fd());
    expect(res).toEqual({ ok: true });
    expect(h.rpc).toHaveBeenCalledWith(
      "upsert_address",
      expect.objectContaining({
        p_line1: "123 Main St",
        p_city: "Austin",
        p_state: "TX",
        p_postal: "78701",
        p_label: "Home",
        p_lng: -97.7,
        p_lat: 30.3,
      }),
    );
  });

  it("rejects a bad ZIP without geocoding or writing", async () => {
    const res = await addAddressAction({}, fd({ postal: "12" }));
    expect(res.error).toBeTruthy();
    expect(h.rpc).not.toHaveBeenCalled();
  });

  it("errors when the address can't be geocoded", async () => {
    h.geo = null;
    const res = await addAddressAction({}, fd());
    expect(res.error).toContain("couldn't verify");
    expect(h.rpc).not.toHaveBeenCalled();
  });

  it("refuses past the saved-address cap", async () => {
    h.count = 12;
    const res = await addAddressAction({}, fd());
    expect(res.error).toContain("up to 12");
    expect(h.rpc).not.toHaveBeenCalled();
  });
});
