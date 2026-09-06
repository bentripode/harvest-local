"use client";

import { useActionState } from "react";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  saveMailingAddressAction,
  type MailingAddressState,
} from "@/app/(dashboard)/seller/settings/actions";

/**
 * The producer's postal address, where a state wants it on the label alongside the address where
 * the food was made — South Dakota lists them as two separate items.
 *
 * Free text rather than the structured address form used for pickup: this one is printed verbatim
 * and never geocoded, so tying it to Mapbox would mean a seller without a token configured could
 * not satisfy their state.
 */
export function MailingAddressForm({ initial }: { initial: string }) {
  const [state, action, pending] = useActionState<MailingAddressState, FormData>(
    saveMailingAddressAction,
    {},
  );

  return (
    <form action={action} className="space-y-3">
      <div className="space-y-2">
        <Label htmlFor="mailingAddress">Mailing address</Label>
        <textarea
          id="mailingAddress"
          name="mailingAddress"
          rows={3}
          maxLength={300}
          defaultValue={initial}
          className="border-input bg-background placeholder:text-muted-foreground focus-visible:ring-ring w-full rounded-md border px-3 py-2 text-sm focus-visible:ring-2 focus-visible:outline-none"
          placeholder="PO Box 12, Pierre, SD 57501"
        />
        <p className="text-muted-foreground text-xs">
          Only needed if your post goes somewhere other than the kitchen. Leave it blank and the
          label carries the production address alone.
        </p>
      </div>
      <div className="flex items-center gap-3">
        <Button type="submit" disabled={pending}>
          {pending ? "Saving…" : "Save address"}
        </Button>
        {state.ok ? <span className="text-muted-foreground text-sm">Saved.</span> : null}
        {state.error ? <span className="text-destructive text-sm">{state.error}</span> : null}
      </div>
    </form>
  );
}
