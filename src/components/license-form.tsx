"use client";

import { useActionState, useRef, useState } from "react";
import { useFormStatus } from "react-dom";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createClient } from "@/lib/supabase/client";
import { US_STATES, stateName } from "@/lib/geo/state";
import { addLicenseAction, type LicenseFormState } from "@/app/(dashboard)/seller/compliance/actions";

const TYPES: { value: string; label: string }[] = [
  { value: "cottage_food", label: "Cottage food permit" },
  { value: "food_handler", label: "Food handler card" },
  { value: "business_license", label: "Business license" },
  { value: "id", label: "Government ID" },
  { value: "other", label: "Other" },
];

function Submit({ uploading }: { uploading: boolean }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending || uploading}>
      {pending ? "Saving…" : "Add license"}
    </Button>
  );
}

export function LicenseForm({
  sellerId,
  defaultState,
}: {
  sellerId: string;
  defaultState?: string | null;
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

  return (
    <form action={action} className="space-y-4">
      <input ref={docPathRef} type="hidden" name="documentPath" defaultValue="" />

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="licenseType">Type</Label>
          <select
            id="licenseType"
            name="licenseType"
            required
            defaultValue="cottage_food"
            className="border-input h-8 w-full rounded-lg border bg-transparent px-2.5 text-sm"
          >
            {TYPES.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="issuingState">Issuing state</Label>
          <select
            id="issuingState"
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
        <div className="space-y-1.5">
          <Label htmlFor="licenseNumber">License number (optional)</Label>
          <Input id="licenseNumber" name="licenseNumber" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="issuedDate">Issued date (optional)</Label>
          <Input id="issuedDate" name="issuedDate" type="date" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="expirationDate">Expiry date</Label>
          <Input id="expirationDate" name="expirationDate" type="date" required />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="document">Document (optional)</Label>
          <Input
            id="document"
            type="file"
            accept="image/jpeg,image/png,application/pdf"
            onChange={(e) => upload(e.target.files?.[0])}
          />
          {uploading ? <p className="text-muted-foreground text-xs">Uploading…</p> : null}
          {fileName ? <p className="text-muted-foreground text-xs">Attached: {fileName}</p> : null}
        </div>
      </div>

      {state.error ? <p className="text-destructive text-sm">{state.error}</p> : null}
      {state.ok ? (
        <p className="text-sm text-green-600">License added — an admin will verify it.</p>
      ) : null}
      <Submit uploading={uploading} />
    </form>
  );
}
