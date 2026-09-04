import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/env", () => ({
  env: { NEXT_PUBLIC_SITE_URL: "https://harvestlocal.example" },
}));

import { notificationText } from "@/lib/notifications/copy";
import { renderEmail } from "@/lib/notifications/templates";

const base = { order_id: "abcdef12-3456-7890-abcd-ef1234567890", business_name: "Ben's Baked Bread" };

describe("order_status_changed copy", () => {
  it("names the seller and reflects the status", () => {
    expect(notificationText("order_status_changed", { ...base, status: "preparing" })).toBe(
      "Ben's Baked Bread started preparing your order.",
    );
    expect(notificationText("order_status_changed", { ...base, status: "completed" })).toContain(
      "complete",
    );
  });

  it("distinguishes pickup vs delivery on 'ready'", () => {
    expect(
      notificationText("order_status_changed", { ...base, status: "ready", fulfillment_type: "pickup" }),
    ).toContain("ready for pickup");
    expect(
      notificationText("order_status_changed", { ...base, status: "ready", fulfillment_type: "delivery" }),
    ).toContain("packed and ready");
  });

  it("falls back gracefully with a missing business name / unknown status", () => {
    expect(notificationText("order_status_changed", { status: "preparing" })).toBe(
      "the seller started preparing your order.",
    );
    expect(notificationText("order_status_changed", { ...base, status: "weird" })).toBe(
      "Your order from Ben's Baked Bread was updated.",
    );
  });
});

describe("order_status_changed email", () => {
  it("renders a per-order deep link and a status-specific subject", () => {
    const email = renderEmail("order_status_changed", { ...base, status: "ready", fulfillment_type: "pickup" });
    expect(email).not.toBeNull();
    expect(email!.subject).toBe("Your order is ready");
    expect(email!.text).toContain(`https://harvestlocal.example/orders/${base.order_id}`);
    expect(email!.html).toContain(`/orders/${base.order_id}`);
  });

  it("still renders the existing static-path templates", () => {
    const email = renderEmail("refund_issued", { order_id: base.order_id, business_name: "X", amount: 5 });
    expect(email!.text).toContain("https://harvestlocal.example/orders");
  });
});

describe("new_message", () => {
  const p = { conversation_id: "conv-9", message_id: "m-1", sender_name: "Sarah's Bread", order_ref: "abcd1234" };

  it("names the sender and the order in the copy", () => {
    expect(notificationText("new_message", p)).toBe(
      "Sarah's Bread sent you a message about order abcd1234.",
    );
    expect(notificationText("new_message", { ...p, order_ref: null })).toBe(
      "Sarah's Bread sent you a message.",
    );
  });

  it("emails a deep link to the conversation", () => {
    const email = renderEmail("new_message", p);
    expect(email!.subject).toBe("New message from Sarah's Bread");
    expect(email!.text).toContain("https://harvestlocal.example/messages/conv-9");
  });
});
