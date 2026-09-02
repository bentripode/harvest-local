"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  createStorefrontAction,
  startConnectOnboardingAction,
  startSubscriptionAction,
  type FormState,
} from "@/app/(dashboard)/seller/onboarding/actions";

const US_STATES = [
  "AL","AK","AZ","AR","CA","CO","CT","DE","FL","GA","HI","ID","IL","IN","IA","KS","KY","LA","ME",
  "MD","MA","MI","MN","MS","MO","MT","NE","NV","NH","NJ","NM","NY","NC","ND","OH","OK","OR","PA",
  "RI","SC","SD","TN","TX","UT","VT","VA","WA","WV","WI","WY","DC",
];

export function StorefrontForm() {
  const [state, action] = useActionState<FormState, FormData>(createStorefrontAction, {});
  return (
    <form action={action} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="businessName">Business name</Label>
        <Input id="businessName" name="businessName" required />
      </div>
      <div className="space-y-2">
        <Label htmlFor="storefrontSlug">Storefront handle</Label>
        <Input
          id="storefrontSlug"
          name="storefrontSlug"
          placeholder="sarahs-bread"
          pattern="[a-z0-9]+(?:-[a-z0-9]+)*"
          required
        />
        <p className="text-muted-foreground text-xs">harvestlocal.com/s/your-handle</p>
      </div>
      <div className="space-y-2">
        <Label htmlFor="homeState">Selling state</Label>
        <select
          id="homeState"
          name="homeState"
          required
          defaultValue=""
          className="border-input bg-background h-9 w-full rounded-md border px-3 text-sm"
        >
          <option value="" disabled>
            Select a state
          </option>
          {US_STATES.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
        <p className="text-muted-foreground text-xs">
          You can only sell to buyers in this state. This can&apos;t be changed later.
        </p>
      </div>
      <div className="space-y-2">
        <Label htmlFor="bio">Short bio (optional)</Label>
        <Textarea id="bio" name="bio" rows={3} maxLength={600} />
      </div>
      {state.error ? <p className="text-destructive text-sm">{state.error}</p> : null}
      <SubmitButton label="Save storefront" />
    </form>
  );
}

export function ConnectButton({ children }: { children: React.ReactNode }) {
  return (
    <form action={startConnectOnboardingAction}>
      <SubmitButton label={children} />
    </form>
  );
}

export function SubscriptionButton({ children }: { children: React.ReactNode }) {
  return (
    <form action={startSubscriptionAction}>
      <SubmitButton label={children} />
    </form>
  );
}

function SubmitButton({ label }: { label: React.ReactNode }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? "Working…" : label}
    </Button>
  );
}
