"use client";

import { useActionState, useState, useTransition } from "react";
import { useFormStatus } from "react-dom";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  clearBrowseOriginAction,
  setBrowseOriginAction,
  type OriginState,
} from "@/app/(shop)/shop/actions";

/**
 * Where to measure from. A ZIP costs a geocode; the browser's own position costs nothing, so it
 * posts coordinates straight through.
 *
 * Presentational only — this changes the order things appear in, never who a buyer may order from.
 */
function Submit() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="sm" variant="outline" disabled={pending}>
      {pending ? "Finding…" : "Set"}
    </Button>
  );
}

export function OriginPicker({ current }: { current: string | null }) {
  const [state, action] = useActionState<OriginState, FormData>(setBrowseOriginAction, {});
  const [geoError, setGeoError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function useMyLocation() {
    setGeoError(null);
    if (!("geolocation" in navigator)) {
      setGeoError("Your browser can't share a location.");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const data = new FormData();
        data.set("kind", "point");
        data.set("lng", String(pos.coords.longitude));
        data.set("lat", String(pos.coords.latitude));
        startTransition(() => {
          void setBrowseOriginAction({}, data);
        });
      },
      () => setGeoError("We couldn't get your location."),
      { maximumAge: 600_000, timeout: 8000 },
    );
  }

  return (
    <div className="space-y-2">
      <form action={action} className="flex flex-wrap items-end gap-2">
        <input type="hidden" name="kind" value="zip" />
        <div className="space-y-1.5">
          <Label htmlFor="origin-zip" className="text-xs">
            {current ? `Distances from ${current}` : "Sort by distance"}
          </Label>
          <Input
            id="origin-zip"
            name="zip"
            inputMode="numeric"
            pattern="[0-9]{5}"
            maxLength={5}
            placeholder="ZIP code"
            className="h-8 w-28"
          />
        </div>
        <Submit />
        <Button type="button" size="sm" variant="ghost" onClick={useMyLocation} disabled={pending}>
          {pending ? "Locating…" : "Use my location"}
        </Button>
        {current ? (
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={() => startTransition(() => void clearBrowseOriginAction())}
          >
            Clear
          </Button>
        ) : null}
      </form>
      {state.error || geoError ? (
        <p className="text-destructive text-sm">{state.error ?? geoError}</p>
      ) : null}
    </div>
  );
}
