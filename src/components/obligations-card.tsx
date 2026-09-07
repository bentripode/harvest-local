"use client";

import { useActionState } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  markObligationDoneAction,
  type ObligationState,
} from "@/app/(dashboard)/seller/compliance/actions";

/**
 * The recurring duties that are not documents.
 *
 * Sorted soonest-first, with the citation shown so the seller can check the deadline against their
 * own state rather than trusting ours — `state_food_programs.verified_at` is null on essentially
 * every row, and a wrong date here is worse than none.
 */

export interface ObligationView {
  id: string;
  label: string;
  detail: string;
  citation: string | null;
  sourceUrl: string | null;
  dueDate: string;
  daysOut: number;
  periodKey: string;
  lastCompletedAt: string | null;
}

function when(daysOut: number, dueDate: string): { text: string; tone: string } {
  if (daysOut < 0) return { text: `Overdue since ${dueDate}`, tone: "text-destructive font-medium" };
  if (daysOut === 0) return { text: `Due today (${dueDate})`, tone: "text-destructive font-medium" };
  if (daysOut === 1) return { text: `Due tomorrow (${dueDate})`, tone: "text-destructive font-medium" };
  if (daysOut <= 30) return { text: `Due in ${daysOut} days (${dueDate})`, tone: "text-amber-700" };
  return { text: `Due ${dueDate}`, tone: "text-muted-foreground" };
}

function ObligationRow({ obligation }: { obligation: ObligationView }) {
  const [state, action, pending] = useActionState<ObligationState, FormData>(
    markObligationDoneAction,
    {},
  );
  const timing = when(obligation.daysOut, obligation.dueDate);

  return (
    <li className="space-y-2 border-b pb-4 last:border-b-0 last:pb-0">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <span className="text-sm font-medium">{obligation.label}</span>
        <span className={`text-xs ${timing.tone}`}>{timing.text}</span>
      </div>
      <p className="text-muted-foreground text-sm">{obligation.detail}</p>

      {obligation.citation ? (
        <details className="text-xs">
          <summary className="text-muted-foreground cursor-pointer underline underline-offset-2">
            What the rule says
          </summary>
          <blockquote className="text-muted-foreground border-muted-foreground/30 mt-2 border-l-2 pl-3">
            {obligation.citation}
          </blockquote>
          {obligation.sourceUrl ? (
            <a
              href={obligation.sourceUrl}
              target="_blank"
              rel="noreferrer"
              className="text-muted-foreground mt-1 inline-block underline underline-offset-2"
            >
              Read the source
            </a>
          ) : null}
        </details>
      ) : null}

      <form action={action} className="flex flex-wrap items-center gap-3">
        <input type="hidden" name="obligationId" value={obligation.id} />
        <input type="hidden" name="periodKey" value={obligation.periodKey} />
        <Button type="submit" variant="outline" size="sm" disabled={pending}>
          {pending ? "Saving…" : "I've done this"}
        </Button>
        {obligation.lastCompletedAt ? (
          <span className="text-muted-foreground text-xs">
            Last recorded {obligation.lastCompletedAt.slice(0, 10)}
          </span>
        ) : null}
        {state.ok ? <span className="text-muted-foreground text-xs">Recorded.</span> : null}
        {state.error ? <span className="text-destructive text-xs">{state.error}</span> : null}
      </form>
    </li>
  );
}

export function ObligationsCard({ obligations }: { obligations: ObligationView[] }) {
  if (obligations.length === 0) return null;

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium">Recurring deadlines</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-muted-foreground mb-4 text-sm">
          Things your programme asks for again and again — filings, training, renewals. We&apos;ll
          remind you 30 days out, 10 days out and the day before. Telling us you&apos;ve done one
          stops the reminders and restarts the clock; it isn&apos;t sent to your state.
        </p>
        <ul className="space-y-4">
          {obligations.map((o) => (
            <ObligationRow key={o.id} obligation={o} />
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
