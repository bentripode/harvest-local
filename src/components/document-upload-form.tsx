"use client";

import { useActionState, useRef, useState } from "react";
import { useFormStatus } from "react-dom";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createClient } from "@/lib/supabase/client";
import { US_STATES, stateName } from "@/lib/geo/state";
import type { DocumentSpec } from "@/lib/licenses/requirements";
import {
  addLicenseAction,
  type LicenseFormState,
} from "@/app/(dashboard)/seller/compliance/actions";

/**
 * Upload one required document. The file goes straight from the browser into the private
 * `seller-docs` bucket under the seller's own folder (storage RLS enforces the prefix); only the
 * resulting object key is posted to the server. Fields shown depend on the document type — a tax ID
 * has no expiry or state, an ID and a permit do.
 */
export function DocumentUploadForm({
  spec,
  sellerId,
  defaultState,
  replacing,
}: {
  spec: DocumentSpec;
  sellerId: string;
  defaultState?: string | null;
  /** True when one is already on file — the wording changes to "replace". */
  replacing?: boolean;
}) {
  const [state, action] = useActionState<LicenseFormState, FormData>(addLicenseAction, {});
  const docPathRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [fileName, setFileName] = useState<string | null>(null);

  async function upload(file: File | undefined) {
    if (docPathRef.current) docPathRef.current.value = "";
    setFileName(null);
    if (!file) return;

    setUploading(true);
    try {
      const supabase = createClient();
      const ext = file.name.split(".").pop() ?? "pdf";
      const path = `${sellerId}/licenses/${crypto.randomUUID()}.${ext}`;
      const { error } = await supabase.storage.from("seller-docs").upload(path, file);
      if (error) throw error;
      if (docPathRef.current) docPathRef.current.value = path;
      setFileName(file.name);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Upload failed.");
    } finally {
      setUploading(false);
    }
  }

  const id = (field: string) => `${spec.type}-${field}`;

  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="licenseType" value={spec.type} />
      <input ref={docPathRef} type="hidden" name="documentPath" defaultValue="" />

      <div className="space-y-1.5">
        <Label htmlFor={id("document")}>
          {replacing ? "Replacement photo or PDF" : "Photo or PDF"}
        </Label>
        <Input
          id={id("document")}
          type="file"
          accept="image/jpeg,image/png,application/pdf"
          onChange={(e) => upload(e.target.files?.[0])}
        />
        {uploading ? <p className="text-muted-foreground text-xs">Uploading…</p> : null}
        {fileName ? <p className="text-muted-foreground text-xs">Attached: {fileName}</p> : null}
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        {spec.numberLabel ? (
          <div className="space-y-1.5">
            <Label htmlFor={id("number")}>
              {spec.numberLabel}
              {spec.numberRequired ? "" : " (optional)"}
            </Label>
            <Input
              id={id("number")}
              name="licenseNumber"
              autoComplete="off"
              required={spec.numberRequired}
            />
            {spec.numberSensitive ? (
              <p className="text-muted-foreground text-xs">
                Stored for tax reporting and shown only as the last 4 digits.
              </p>
            ) : null}
          </div>
        ) : null}

        {spec.needsState ? (
          <div className="space-y-1.5">
            <Label htmlFor={id("state")}>Issuing state</Label>
            <select
              id={id("state")}
              name="issuingState"
              required
              defaultValue={defaultState ?? ""}
              className="border-input h-8 w-full rounded-lg border bg-transparent px-2.5 text-sm"
            >
              <option value="" disabled>
                Select a state
              </option>
              {US_STATES.map((s) => (
                <option key={s} value={s}>
                  {stateName(s)}
                </option>
              ))}
            </select>
          </div>
        ) : null}

        {spec.needsExpiry ? (
          <div className="space-y-1.5">
            <Label htmlFor={id("expiry")}>Expiry date</Label>
            <Input id={id("expiry")} name="expirationDate" type="date" required />
          </div>
        ) : null}
      </div>

      {state.error ? <p className="text-destructive text-sm">{state.error}</p> : null}
      {state.ok ? (
        <p className="text-sm text-green-600">Uploaded — an admin will review it.</p>
      ) : null}
      <Submit uploading={uploading} replacing={!!replacing} />
    </form>
  );
}

function Submit({ uploading, replacing }: { uploading: boolean; replacing: boolean }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="sm" disabled={pending || uploading}>
      {pending ? "Submitting…" : replacing ? "Submit replacement" : "Submit for review"}
    </Button>
  );
}
