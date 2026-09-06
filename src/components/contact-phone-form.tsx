"use client";

import { useActionState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  saveContactPhoneAction,
  type ContactPhoneState,
} from "@/app/(dashboard)/seller/settings/actions";

/**
 * The telephone number that goes on the label, shown only where the seller's own state asks for one.
 *
 * Separate from the mobile number on /account: that one receives order-update texts under its own
 * opt-in and is never published. This one is printed on a jar and, in Tennessee, shown on the
 * listing page itself.
 */
export function ContactPhoneForm({
  initial,
  required,
}: {
  initial: string;
  required: boolean;
}) {
  const [state, action, pending] = useActionState<ContactPhoneState, FormData>(
    saveContactPhoneAction,
    {},
  );

  return (
    <form action={action} className="space-y-3">
      <div className="space-y-2">
        <Label htmlFor="contactPhone">Phone number for the label</Label>
        <Input
          id="contactPhone"
          name="contactPhone"
          type="tel"
          maxLength={40}
          defaultValue={initial}
          placeholder="(615) 555-0134"
        />
        <p className="text-muted-foreground text-xs">
          {required
            ? "Your state requires a phone number on the label, so buyers will see this one. It is written exactly as you type it."
            : "Your state accepts a phone number or an email address. Fill this in if you would rather publish a number than your email."}{" "}
          This is not the mobile number that receives order texts.
        </p>
      </div>
      <div className="flex items-center gap-3">
        <Button type="submit" disabled={pending}>
          {pending ? "Saving…" : "Save phone number"}
        </Button>
        {state.ok ? <span className="text-muted-foreground text-sm">Saved.</span> : null}
        {state.error ? <span className="text-destructive text-sm">{state.error}</span> : null}
      </div>
    </form>
  );
}
