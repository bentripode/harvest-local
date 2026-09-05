/**
 * The document set a seller must have verified before their storefront can go live.
 *
 * Government ID and Tax ID are always required. The cottage-food permit needs two things to be
 * true: the seller lists food (derived from their product categories via
 * `seller_sells_cottage_food()`, never self-declared) AND their state verifiably issues such a
 * permit at all (`seller_requires_food_permit()`,
 * `20260905130000_permit_required_only_where_law_says.sql`). Texas is why the second condition
 * exists — it issues none, so asking for one demanded a document that does not exist. Pure — the
 * seller upload form, the compliance checklist and the admin queue all render from here.
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
export function requiredDocumentTypes(permitRequired: boolean): RequiredDocumentType[] {
  return DOCUMENT_SPECS.filter((d) => !d.conditional || permitRequired).map((d) => d.type);
}

/**
 * How a stored last-4 is rendered. A sensitive number is never held in full outside
 * `tax_id_encrypted`, so this is the most any screen can show — including to the admin reviewing
 * it, who reads the real number off the document in front of them.
 */
export function formatLast4(last4: string | null | undefined): string | null {
  if (!last4) return null;
  return `•••• ${last4}`;
}

/** What to print next to `spec.numberLabel`, given the row. Null when there's nothing to show. */
export function displayNumber(
  spec: DocumentSpec,
  license: Pick<ChecklistLicense, "license_number" | "tax_id_last4">,
): string | null {
  return spec.numberSensitive ? formatLast4(license.tax_id_last4) : license.license_number;
}

export type DocumentStatus = "missing" | "pending" | "verified" | "rejected" | "expired";

/** The minimum a license row needs to be placed on the checklist. */
export interface ChecklistLicense {
  id: string;
  license_type: string;
  license_number: string | null;
  /** The only readable part of a tax ID; null for every other type. */
  tax_id_last4: string | null;
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
 * One row per document type, newest-best first. `permitRequired` is the seller listing food AND
 * their state verifiably issuing a permit at all — see `sellerRequiresFoodPermit`.
 */
export function buildDocumentChecklist(
  licenses: ChecklistLicense[],
  permitRequired: boolean,
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
      required: !spec.conditional || permitRequired,
      status: bestStatus,
      license: best,
    };
  });
}
