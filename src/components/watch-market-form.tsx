"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { watchMarketAction, type WatchFormState } from "@/app/(shop)/markets/actions";

function Submit() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? "Adding…" : "Tell me when"}
    </Button>
  );
}

/**
 * Waitlist signup for a market with no sellers yet. Works signed out — the whole point is to
 * capture interest before there is anything to buy, and asking for an account first would
 * collect nothing.
 */
export function WatchMarketForm({
  marketId,
  marketName,
}: {
  marketId: string;
  marketName: string;
}) {
  const [state, action] = useActionState<WatchFormState, FormData>(watchMarketAction, {});

  if (state.ok) {
    return (
      <p className="text-sm font-medium">
        You&apos;re on the list. We&apos;ll email you when a seller joins {marketName}.
      </p>
    );
  }

  return (
    <form action={action} className="mx-auto flex max-w-sm flex-wrap items-end justify-center gap-2">
      <input type="hidden" name="marketId" value={marketId} />
      <div className="flex-1 space-y-1.5 text-left">
        <Label htmlFor={`watch-email-${marketId}`} className="sr-only">
          Email address
        </Label>
        <Input
          id={`watch-email-${marketId}`}
          name="email"
          type="email"
          required
          autoComplete="email"
          placeholder="you@example.com"
        />
      </div>
      <Submit />
      {state.error ? <p className="text-destructive w-full text-sm">{state.error}</p> : null}
    </form>
  );
}
