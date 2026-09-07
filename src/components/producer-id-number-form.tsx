"use client";

import { useActionState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  saveProducerIdNumberAction,
  type ProducerIdNumberState,
} from "@/app/(dashboard)/seller/settings/actions";

/**
 * The number a seller can print instead of their home address.
 *
 * Shown only where the state offers one. The copy leads with why it exists rather than what it is,
 * because a home-based seller reading their settings page has no reason to know that Texas
 * § 437.0193(b-1) exists — they have a reason to care that their address is on every jar.
 */
export function ProducerIdNumberForm({ initial }: { initial: string }) {
  const [state, action, pending] = useActionState<ProducerIdNumberState, FormData>(
    saveProducerIdNumberAction,
    {},
  );

  return (
    <form action={action} className="space-y-3">
      <div className="space-y-2">
        <Label htmlFor="producerIdNumber">State identification number</Label>
        <Input
          id="producerIdNumber"
          name="producerIdNumber"
          maxLength={60}
          defaultValue={initial}
          placeholder="e.g. 123456"
        />
        <p className="text-muted-foreground text-xs">
          Your state issues this so you don&apos;t have to publish your home address. Enter it and
          your labels and listings will show the number instead. Leave it blank and they show your
          address, as now.
        </p>
      </div>
      <div className="flex items-center gap-3">
        <Button type="submit" disabled={pending}>
          {pending ? "Saving…" : "Save number"}
        </Button>
        {state.ok ? <span className="text-muted-foreground text-sm">Saved.</span> : null}
        {state.error ? <span className="text-destructive text-sm">{state.error}</span> : null}
      </div>
    </form>
  );
}
