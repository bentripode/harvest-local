"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  createPromoCodeAction,
  type PromoCodeFormState,
} from "@/app/(dashboard)/seller/referrals/actions";

function Submit() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? "Creating…" : "Create code"}
    </Button>
  );
}

export function PromoCodeForm() {
  const [state, action] = useActionState<PromoCodeFormState, FormData>(createPromoCodeAction, {});

  return (
    <form action={action} className="flex flex-wrap items-end gap-3">
      <div className="space-y-1.5">
        <Label htmlFor="code">New referral code</Label>
        <Input
          id="code"
          name="code"
          placeholder="SARAHSBREAD"
          maxLength={20}
          required
          className="w-56 uppercase"
          style={{ textTransform: "uppercase" }}
        />
      </div>
      <Submit />
      {state.error ? <p className="text-destructive w-full text-sm">{state.error}</p> : null}
      {state.ok ? <p className="w-full text-sm text-green-600">Code created.</p> : null}
    </form>
  );
}
