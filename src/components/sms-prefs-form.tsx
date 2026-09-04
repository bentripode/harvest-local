"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { saveSmsPrefsAction, type SmsPrefsState } from "@/app/(shop)/account/actions";

export function SmsPrefsForm({
  phone,
  orderTextsOn,
}: {
  phone: string | null;
  orderTextsOn: boolean;
}) {
  const [state, action] = useActionState<SmsPrefsState, FormData>(saveSmsPrefsAction, {});

  return (
    <form action={action} className="space-y-3">
      <div className="space-y-1.5">
        <Label htmlFor="sms-phone">Mobile number (US)</Label>
        <Input
          id="sms-phone"
          name="phone"
          type="tel"
          inputMode="tel"
          autoComplete="tel"
          defaultValue={phone ?? ""}
          placeholder="(512) 555-0123"
        />
      </div>
      <label className="flex items-start gap-2 text-sm">
        <input
          type="checkbox"
          name="sms_order_updates"
          defaultChecked={orderTextsOn}
          className="mt-0.5 size-4"
        />
        <span>
          Text me order updates
          <span className="text-muted-foreground block text-xs">
            Preparing, ready, out for delivery, completed. Standard message rates apply.
          </span>
        </span>
      </label>
      {state.error ? <p className="text-destructive text-sm">{state.error}</p> : null}
      {state.ok ? <p className="text-sm text-green-600">Saved.</p> : null}
      <SubmitButton />
    </form>
  );
}

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant="outline" size="sm" disabled={pending}>
      {pending ? "Saving…" : "Save"}
    </Button>
  );
}
