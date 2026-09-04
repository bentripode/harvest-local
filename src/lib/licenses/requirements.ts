/**
 * The document set a seller must have verified before their storefront can go live.
 *
 * Government ID and Tax ID are always required; the cottage-food permit is required only when the
 * seller lists food, which is derived from their product categories (`seller_sells_cottage_food()`,
 * `20260904130000_seller_documents.sql`) rather than self-declared. Pure — the seller upload form,
 * the compliance checklist and the admin queue all render from here.
 *
 * The data-layer counterpart is `seller_has_required_documents()`. Keep the two in step: this file
 * decides what the seller is asked for, that function decides whether the storefront may open.
 */

export type RequiredDocumentType = "id" | "tax_id" | "cottage_food";

export interface DocumentSpec {
  type: RequiredDocumentType;
  label: string;
  /** One line under the heading: what to upload. */
  help: string;
  /** Only required when the seller lists food. */
  conditional: boolean;
  needsExpiry: boolean;
  needsState: boolean;
  numberLabel: string | null;
  numberRequired: boolean;
  /** Render masked, never export or log. */
  numberSensitive: boolean;
}

export const DOCUMENT_SPECS: DocumentSpec[] = [
  {
    type: "id",
    label: "Government-issued ID",
    help: "A driver's licence, state ID or passport. The photo page, with the name and expiry legible.",
    conditional: false,
    needsExpiry: true,
    needsState: true,
    numberLabel: "ID number",
    numberRequired: false,
    numberSensitive: false,
  },
  {
    type: "tax_id",
    label: "Tax ID",
    help: "Your SSN card, or the IRS letter showing your EIN. Sole traders can use either.",
    conditional: false,
    // An SSN or EIN has no expiry, and no issuing state that matters to us.
    needsExpiry: false,
    needsState: false,
    numberLabel: "SSN or EIN",
    numberRequired: true,
    numberSensitive: true,
  },
  {
    type: "cottage_food",
    label: "Cottage food permit",
    help: "Your state's cottage-food permit or registration for selling home-made food.",
    conditional: true,
    needsExpiry: true,
    needsState: true,
    numberLabel: "Permit number",
    numberRequired: false,
    numberSensitive: false,
  },
];

export function documentSpec(type: string): DocumentSpec | undefined {
  return DOCUMENT_SPECS.find((d) => d.type === type);
}

/** The types this seller must have verified. Mirrors `seller_has_required_documents()`. */
export function requiredDocumentTypes(sellsCottageFood: boolean): RequiredDocumentType[] {
  return DOCUMENT_SPECS.filter((d) => !d.conditional || sellsCottageFood).map((d) => d.type);
}

/**
 * Last 4 only, for anything flagged `numberSensitive` — an SSN should never be rendered in full,
 * including to the admin reviewing it, who is reading the number off the document anyway.
 */
export function maskNumber(value: string | null | undefined): string | null {
  if (!value) return null;
  const digits = value.replace(/\D/g, "");
  if (digits.length <= 4) return "••••";
  return `•••• ${digits.slice(-4)}`;
}

export type DocumentStatus = "missing" | "pending" | "verified" | "rejected" | "expired";

/** The minimum a license row needs to be placed on the checklist. */
export interface ChecklistLicense {
  id: string;
  license_type: string;
  license_number: string | null;
  expiration_date: string | null;
  verification_status: string;
  review_note: string | null;
  created_at: string;
}

export interface ChecklistItem {
  spec: DocumentSpec;
  required: boolean;
  status: DocumentStatus;
  /** The row the status came from — the best one on file for this type, or null. */
  license: ChecklistLicense | null;
}

/** Rank so the row that decides the seller's status wins over older attempts. */
const RANK: Record<DocumentStatus, number> = {
  verified: 4,
  pending: 3,
  rejected: 2,
  expired: 1,
  missing: 0,
};

function statusOf(license: ChecklistLicense): DocumentStatus {
  if (license.verification_status === "verified") {
    const lapsed =
      !!license.expiration_date && new Date(`${license.expiration_date}T00:00:00Z`) < new Date();
    return lapsed ? "expired" : "verified";
  }
  return license.verification_status as DocumentStatus;
}

/**
 * One row per document type, newest-best first. `sellsCottageFood` comes from the seller's
 * catalogue, so the permit appears as required only once they list food.
 */
export function buildDocumentChecklist(
  licenses: ChecklistLicense[],
  sellsCottageFood: boolean,
): ChecklistItem[] {
  return DOCUMENT_SPECS.map((spec) => {
    const mine = licenses.filter((l) => l.license_type === spec.type);

    let best: ChecklistLicense | null = null;
    let bestStatus: DocumentStatus = "missing";
    for (const license of mine) {
      const status = statusOf(license);
      const better =
        RANK[status] > RANK[bestStatus] ||
        (RANK[status] === RANK[bestStatus] &&
          !!best &&
          license.created_at > best.created_at);
      if (better) {
        best = license;
        bestStatus = status;
      }
    }

    return {
      spec,
      required: !spec.conditional || sellsCottageFood,
      status: bestStatus,
      license: best,
    };
  });
}
