"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  saveDeliverySettingsAction,
  type DeliverySettingsState,
} from "@/app/(dashboard)/seller/settings/actions";

interface Initial {
  line1: string;
  line2: string;
  city: string;
  postal: string;
  deliveryEnabled: boolean;
  radiusMiles: number;
  baseFee: number;
  perMileFee: number;
}

export function DeliverySettingsForm({
  homeState,
  initial,
}: {
  homeState: string;
  initial: Initial;
}) {
  const [state, action] = useActionState<DeliverySettingsState, FormData>(
    saveDeliverySettingsAction,
    {},
  );
  const [deliveryEnabled, setDeliveryEnabled] = useState(initial.deliveryEnabled);

  return (
    <form action={action} className="space-y-5">
      <fieldset className="space-y-3">
        <legend className="text-sm font-medium">Pickup address ({homeState})</legend>
        <div className="space-y-2">
          <Label htmlFor="line1">Street address</Label>
          <Input id="line1" name="line1" defaultValue={initial.line1} required />
        </div>
        <div className="space-y-2">
          <Label htmlFor="line2">Unit / suite (optional)</Label>
          <Input id="line2" name="line2" defaultValue={initial.line2} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2">
            <Label htmlFor="city">City</Label>
            <Input id="city" name="city" defaultValue={initial.city} required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="postal">ZIP</Label>
            <Input id="postal" name="postal" defaultValue={initial.postal} inputMode="numeric" required />
          </div>
        </div>
        <input type="hidden" name="state" value={homeState} />
      </fieldset>

      <fieldset className="space-y-3 border-t pt-4">
        <label className="flex items-center gap-2 text-sm font-medium">
          <input
            type="checkbox"
            name="deliveryEnabled"
            checked={deliveryEnabled}
            onChange={(e) => setDeliveryEnabled(e.target.checked)}
            className="size-4"
          />
          Offer local delivery
        </label>

        <div className={deliveryEnabled ? "grid grid-cols-3 gap-3" : "hidden"}>
          <div className="space-y-2">
            <Label htmlFor="radiusMiles">Radius (mi)</Label>
            <Input
              id="radiusMiles"
              name="radiusMiles"
              type="number"
              min={1}
              max={100}
              step={1}
              defaultValue={initial.radiusMiles}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="baseFee">Base fee ($)</Label>
            <Input
              id="baseFee"
              name="baseFee"
              type="number"
              min={0}
              step="0.01"
              defaultValue={initial.baseFee.toFixed(2)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="perMileFee">Per mile ($)</Label>
            <Input
              id="perMileFee"
              name="perMileFee"
              type="number"
              min={0}
              step="0.01"
              defaultValue={initial.perMileFee.toFixed(2)}
            />
          </div>
        </div>
        {deliveryEnabled ? (
          <p className="text-muted-foreground text-xs">
            Buyers within the radius are charged base + per-mile × driving miles (rounded up).
          </p>
        ) : null}
      </fieldset>

      {state.error ? <p className="text-destructive text-sm">{state.error}</p> : null}
      {state.ok ? <p className="text-sm text-green-600">Saved.</p> : null}
      <SubmitButton />
    </form>
  );
}

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? "Saving…" : "Save settings"}
    </Button>
  );
}
