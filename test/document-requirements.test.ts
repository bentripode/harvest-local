import { describe, expect, it } from "vitest";

import {
  buildDocumentChecklist,
  formatLast4,
  requiredDocumentTypes,
  type ChecklistLicense,
} from "@/lib/licenses/requirements";

/** The seller-facing half of the document rules. The DB half is `seller_has_required_documents()`. */

const future = new Date(Date.now() + 365 * 86_400_000).toISOString().slice(0, 10);
const past = new Date(Date.now() - 7 * 86_400_000).toISOString().slice(0, 10);

function license(over: Partial<ChecklistLicense> & { license_type: string }): ChecklistLicense {
  return {
    id: `lic-${Math.random().toString(36).slice(2)}`,
    license_number: null,
    tax_id_last4: null,
    expiration_date: future,
    verification_status: "verified",
    review_note: null,
    created_at: "2026-01-01T00:00:00Z",
    ...over,
  };
}

describe("requiredDocumentTypes", () => {
  it("always asks for ID and tax ID", () => {
    expect(requiredDocumentTypes(false)).toEqual(["id", "tax_id"]);
  });

  it("adds the permit once the seller lists food", () => {
    expect(requiredDocumentTypes(true)).toEqual(["id", "tax_id", "cottage_food"]);
  });
});

describe("buildDocumentChecklist", () => {
  it("marks everything missing for a seller who has uploaded nothing", () => {
    const items = buildDocumentChecklist([], true);
    expect(items).toHaveLength(3);
    expect(items.every((i) => i.status === "missing")).toBe(true);
    expect(items.every((i) => i.required)).toBe(true);
  });

  it("leaves the permit optional until the seller lists food", () => {
    const permit = buildDocumentChecklist([], false).find((i) => i.spec.type === "cottage_food");
    expect(permit?.required).toBe(false);
  });

  it("reads a verified, unexpired document as verified", () => {
    const items = buildDocumentChecklist([license({ license_type: "id" })], false);
    expect(items.find((i) => i.spec.type === "id")?.status).toBe("verified");
  });

  it("treats a verified but lapsed document as expired", () => {
    const items = buildDocumentChecklist(
      [license({ license_type: "id", expiration_date: past })],
      false,
    );
    expect(items.find((i) => i.spec.type === "id")?.status).toBe("expired");
  });

  it("a tax ID with no expiry date never lapses", () => {
    const items = buildDocumentChecklist(
      [license({ license_type: "tax_id", expiration_date: null })],
      false,
    );
    expect(items.find((i) => i.spec.type === "tax_id")?.status).toBe("verified");
  });

  it("a verified document outranks an earlier rejection of the same type", () => {
    const items = buildDocumentChecklist(
      [
        license({ license_type: "id", verification_status: "rejected", review_note: "blurry" }),
        license({ license_type: "id", created_at: "2026-02-01T00:00:00Z" }),
      ],
      false,
    );
    const id = items.find((i) => i.spec.type === "id");
    expect(id?.status).toBe("verified");
    expect(id?.license?.review_note).toBeNull();
  });

  it("a pending re-upload outranks the rejection it replaces", () => {
    const items = buildDocumentChecklist(
      [
        license({ license_type: "tax_id", verification_status: "rejected" }),
        license({ license_type: "tax_id", verification_status: "pending" }),
      ],
      false,
    );
    expect(items.find((i) => i.spec.type === "tax_id")?.status).toBe("pending");
  });

  it("surfaces the rejection note when that's all there is", () => {
    const items = buildDocumentChecklist(
      [
        license({
          license_type: "cottage_food",
          verification_status: "rejected",
          review_note: "the permit number is cut off",
        }),
      ],
      true,
    );
    const permit = items.find((i) => i.spec.type === "cottage_food");
    expect(permit?.status).toBe("rejected");
    expect(permit?.license?.review_note).toBe("the permit number is cut off");
  });
});

describe("formatLast4", () => {
  it("renders the stored last 4", () => {
    expect(formatLast4("6789")).toBe("•••• 6789");
  });

  it("shows nothing when there is no last 4 on file", () => {
    expect(formatLast4(null)).toBeNull();
    expect(formatLast4("")).toBeNull();
  });
});
