"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  addAddressAction,
  deleteAddressAction,
  type AddressActionState,
} from "@/app/(shop)/account/actions";
import type { SavedAddress } from "@/lib/addresses/queries";

export function AddressBook({ addresses }: { addresses: SavedAddress[] }) {
  const [state, action] = useActionState<AddressActionState, FormData>(addAddressAction, {});
  const [adding, setAdding] = useState(false);

  // A successful add revalidates the page; the fresh `addresses` prop plus this key collapse the form.
  return (
    <div className="space-y-4" key={addresses.length}>
      {addresses.length === 0 ? (
        <p className="text-muted-foreground text-sm">No saved addresses yet.</p>
      ) : (
        <ul className="divide-y rounded-lg border">
          {addresses.map((a) => (
            <li key={a.id} className="flex items-start justify-between gap-4 p-3 text-sm">
              <div>
                {a.label ? <p className="font-medium">{a.label}</p> : null}
                <p className={a.label ? "text-muted-foreground" : ""}>
                  {a.line1}
                  {a.line2 ? `, ${a.line2}` : ""}, {a.city}, {a.state} {a.postal}
                </p>
              </div>
              <form action={deleteAddressAction}>
                <input type="hidden" name="id" value={a.id} />
                <button
                  type="submit"
                  className="text-muted-foreground hover:text-destructive text-xs underline"
                >
                  Remove
                </button>
              </form>
            </li>
          ))}
        </ul>
      )}

      {adding ? (
        <form action={action} className="space-y-3 rounded-lg border p-3">
          <div className="space-y-1.5">
            <Label htmlFor="a-label">Label (optional)</Label>
            <Input id="a-label" name="label" maxLength={40} placeholder="Home, Work…" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="a-line1">Street address</Label>
            <Input id="a-line1" name="line1" required />
          </div>
          <Input name="line2" placeholder="Unit / suite (optional)" />
          <div className="grid grid-cols-2 gap-2">
            <Input name="city" placeholder="City" required />
            <Input name="postal" placeholder="ZIP" inputMode="numeric" required />
          </div>
          <Input name="state" placeholder="State (e.g. TX)" maxLength={2} required className="uppercase" />
          {state.error ? <p className="text-destructive text-sm">{state.error}</p> : null}
          <div className="flex gap-2">
            <SaveButton />
            <button
              type="button"
              onClick={() => setAdding(false)}
              className="text-muted-foreground hover:text-foreground text-xs underline"
            >
              Cancel
            </button>
          </div>
        </form>
      ) : (
        <Button type="button" variant="outline" size="sm" onClick={() => setAdding(true)}>
          Add an address
        </Button>
      )}
    </div>
  );
}

function SaveButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="sm" disabled={pending}>
      {pending ? "Saving…" : "Save address"}
    </Button>
  );
}
