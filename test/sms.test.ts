import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/env", () => ({
  env: {
    TWILIO_ACCOUNT_SID: "AC123",
    TWILIO_AUTH_TOKEN: "secret",
    TWILIO_FROM_NUMBER: "+15125550000",
  },
}));

const fetchMock = vi.fn();
vi.stubGlobal("fetch", fetchMock);

import { sendSms } from "@/lib/notifications/sms";

beforeEach(() => {
  fetchMock.mockReset().mockResolvedValue({ ok: true, text: async () => "" });
});

describe("sendSms", () => {
  it("posts to the Twilio Messages endpoint with basic auth and a form body", async () => {
    await sendSms({ to: "+15125551234", body: "Your order is ready." });

    const [url, opts] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://api.twilio.com/2010-04-01/Accounts/AC123/Messages.json");
    expect(opts.method).toBe("POST");
    expect((opts.headers as Record<string, string>).Authorization).toBe(
      `Basic ${btoa("AC123:secret")}`,
    );

    const body = opts.body as URLSearchParams;
    expect(body.get("To")).toBe("+15125551234");
    expect(body.get("From")).toBe("+15125550000");
    expect(body.get("Body")).toBe("Your order is ready.");
  });

  it("throws on a non-2xx response", async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 400, text: async () => '{"message":"bad number"}' });
    await expect(sendSms({ to: "+1", body: "x" })).rejects.toThrow(/twilio 400/);
  });

  it("wraps a network failure", async () => {
    fetchMock.mockRejectedValue(new Error("ECONNRESET"));
    await expect(sendSms({ to: "+1", body: "x" })).rejects.toThrow(/twilio: ECONNRESET/);
  });
});
