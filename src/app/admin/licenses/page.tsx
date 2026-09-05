import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { LicenseReviewForm } from "@/components/license-review-form";
import { daysUntil } from "@/lib/compliance";
import { getLicenseQueue, type AdminLicense } from "@/lib/licenses/queries";
import { licenseTypeLabel } from "@/lib/licenses/labels";
import { stateName } from "@/lib/geo/state";
import type { LicenseStatus } from "@/lib/db/types";

export const metadata = { title: "Licenses — Admin" };

const STATUS_VARIANT: Record<LicenseStatus, "default" | "secondary" | "destructive"> = {
  verified: "default",
  pending: "secondary",
  rejected: "destructive",
  expired: "destructive",
};

export default async function AdminLicensesPage() {
  const licenses = await getLicenseQueue();
  const pending = licenses.filter((l) => l.status === "pending");
  const reviewed = licenses.filter((l) => l.status !== "pending");

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Licenses</h1>
        <p className="text-muted-foreground text-sm">
          Cottage-food permits and IDs sellers have uploaded. Verifying one is what puts it in front
          of the daily expiry scan — renewal reminders and the auto-pause at expiry only run on
          verified documents.
        </p>
      </div>

      <Section title={`Awaiting review (${pending.length})`} licenses={pending} />
      {reviewed.length > 0 ? (
        <Section
          title="Reviewed"
          licenses={reviewed}
          hint="A decision can be changed — re-verifying a rejected document, or withdrawing a verification."
        />
      ) : null}
    </div>
  );
}

function Section({
  title,
  licenses,
  hint,
}: {
  title: string;
  licenses: AdminLicense[];
  hint?: string;
}) {
  return (
    <section className="space-y-3">
      <h2 className="text-sm font-medium">{title}</h2>
      {hint ? <p className="text-muted-foreground -mt-2 text-xs">{hint}</p> : null}
      {licenses.length === 0 ? (
        <p className="text-muted-foreground text-sm">Nothing here.</p>
      ) : (
        <ul className="space-y-4">
          {licenses.map((l) => {
            // A tax ID has no expiry date; only the dated documents can lapse.
            const days = l.expirationDate ? daysUntil(l.expirationDate) : null;
            const lapsed = days != null && days < 0;
            return (
              <li key={l.id} className="rounded-lg border p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant={STATUS_VARIANT[l.status]}>{l.status}</Badge>
                      <span className="text-sm font-medium">
                        {licenseTypeLabel(l.licenseType)}
                        {l.issuingState ? ` · ${stateName(l.issuingState)}` : ""}
                      </span>
                      {l.sellerIsPaused ? (
                        <Badge variant="destructive">
                          storefront paused{l.sellerPauseReason ? ` · ${l.sellerPauseReason}` : ""}
                        </Badge>
                      ) : null}
                    </div>
                    <p className="text-muted-foreground text-sm">
                      {l.storefrontSlug ? (
                        <Link href={`/s/${l.storefrontSlug}`} className="hover:text-foreground underline">
                          {l.businessName}
                        </Link>
                      ) : (
                        l.businessName
                      )}
                      {l.licenseNumber ? (
                        <>
                          {" "}
                          · no. <span className="font-mono">{l.licenseNumber}</span>
                        </>
                      ) : null}
                      {l.issuedDate ? <> · issued {l.issuedDate}</> : null} · submitted{" "}
                      {new Date(l.createdAt).toLocaleDateString(undefined, { dateStyle: "medium" })}
                    </p>
                    {l.expirationDate == null ? (
                      <p className="text-muted-foreground text-sm">No expiry date</p>
                    ) : (
                      <p className={lapsed ? "text-destructive text-sm" : "text-muted-foreground text-sm"}>
                        Expires {l.expirationDate}
                        {lapsed
                          ? " — already lapsed"
                          : days === 0
                            ? " — today"
                            : ` — in ${days} day${days === 1 ? "" : "s"}`}
                      </p>
                    )}
                  </div>

                  {l.hasDocument ? (
                    <Button asChild size="sm" variant="outline">
                      <a
                        href={`/admin/licenses/${l.id}/document`}
                        target="_blank"
                        rel="noreferrer noopener"
                      >
                        View document
                      </a>
                    </Button>
                  ) : (
                    <span className="text-muted-foreground text-xs">No document attached</span>
                  )}
                </div>

                {l.reviewNote ? (
                  <p className="text-muted-foreground bg-muted/40 mt-3 rounded-md border p-2 text-sm">
                    <span className="font-medium">Note to the seller:</span> {l.reviewNote}
                  </p>
                ) : null}
                {l.reviewedAt ? (
                  <p className="text-muted-foreground mt-2 text-xs">
                    Reviewed{" "}
                    {new Date(l.reviewedAt).toLocaleDateString(undefined, { dateStyle: "medium" })}
                  </p>
                ) : null}

                {l.status === "expired" ? null : l.hasDocument ? (
                  <div className="mt-3">
                    <LicenseReviewForm licenseId={l.id} />
                  </div>
                ) : (
                  <div className="mt-3 space-y-2">
                    <p className="text-muted-foreground text-sm">
                      Nothing to review until the seller uploads the document. You can still reject
                      it to tell them why.
                    </p>
                    {/* Reject only: there is no document to have examined, so there is nothing to
                        verify. Without this the sentence above promises a control that isn't here
                        and the row sits in the queue forever. */}
                    <LicenseReviewForm licenseId={l.id} rejectOnly />
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
