"use client";

import { useActionState, useMemo, useState } from "react";
import { useFormStatus } from "react-dom";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  chooseFoodProgramAction,
  type ProgramChoiceState,
} from "@/app/(dashboard)/seller/onboarding/program/actions";

export interface PickerProgram {
  id: string;
  name: string;
  summary: string;
  onlineOrders: string;
  venueNote: string | null;
  categoryNote: string | null;
  /** Axis → whether this program bans it, for the categories on offer. */
  bannedAxes: string[];
  requirements: { key: string; label: string; detail: string | null; url: string | null }[];
}

export interface PickerCategory {
  id: string;
  name: string;
  axes: string[];
}

/**
 * The middle of the wizard: pick what you want to make, see which programs cover it.
 *
 * Programs that don't cover the seller's choices stay visible and are marked, rather than
 * disappearing — someone comparing options should be able to see that a program exists and why it
 * doesn't fit, not wonder where it went.
 */
export function ProgramPicker({
  categories,
  programs,
  chosenId,
}: {
  categories: PickerCategory[];
  programs: PickerProgram[];
  chosenId: string | null;
}) {
  const [picked, setPicked] = useState<string[]>([]);
  const [state, action] = useActionState<ProgramChoiceState, FormData>(chooseFoodProgramAction, {});

  const intendedAxes = useMemo(() => {
    const axes = new Set<string>();
    for (const c of categories) {
      if (picked.includes(c.id)) c.axes.forEach((a) => axes.add(a));
    }
    return axes;
  }, [categories, picked]);

  function toggle(id: string) {
    setPicked((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  return (
    <div className="space-y-8">
      <section className="space-y-3">
        <div>
          <h2 className="text-sm font-medium">What do you want to make?</h2>
          <p className="text-muted-foreground text-sm">
            Pick everything you might sell. This decides which programs can cover you — you can
            change it later.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {categories.map((c) => (
            <label
              key={c.id}
              className="has-[:checked]:bg-primary has-[:checked]:text-primary-foreground flex cursor-pointer items-center gap-1.5 rounded-full border px-3 py-1 text-sm"
            >
              <input
                type="checkbox"
                checked={picked.includes(c.id)}
                onChange={() => toggle(c.id)}
                className="sr-only"
              />
              {c.name}
            </label>
          ))}
        </div>
      </section>

      <section className="space-y-3">
        <div>
          <h2 className="text-sm font-medium">
            {programs.length === 1
              ? "Your state's cottage food program"
              : `Your state runs ${programs.length} programs`}
          </h2>
          <p className="text-muted-foreground text-sm">
            {programs.length === 1
              ? "Confirm this is the one you sell under."
              : "They allow different foods and ask for different things. Pick the one you're enrolled in, or intend to be."}
          </p>
        </div>

        <ul className="space-y-3">
          {programs.map((program) => {
            const conflicts = program.bannedAxes.filter((a) => intendedAxes.has(a));
            const covers = picked.length > 0 && conflicts.length === 0;
            const isChosen = chosenId === program.id;

            return (
              <li key={program.id} className="rounded-lg border p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="text-sm font-medium">{program.name}</h3>
                  {isChosen ? <Badge variant="default">your program</Badge> : null}
                  {conflicts.length > 0 ? (
                    <Badge variant="destructive">doesn&apos;t cover what you picked</Badge>
                  ) : covers ? (
                    <Badge variant="secondary">covers everything you picked</Badge>
                  ) : null}
                  {program.onlineOrders !== "allowed" ? (
                    <Badge variant="destructive">no online orders</Badge>
                  ) : null}
                </div>

                <p className="text-muted-foreground mt-1 text-sm">{program.summary}</p>

                {program.requirements.length > 0 ? (
                  <ul className="mt-3 space-y-1.5 text-sm">
                    {program.requirements.map((r) => (
                      <li key={r.key} className="flex flex-wrap items-baseline gap-1.5">
                        <span>{r.label}</span>
                        {r.detail ? (
                          <span className="text-muted-foreground">— {r.detail}</span>
                        ) : null}
                        {r.url ? (
                          <a
                            href={r.url}
                            target="_blank"
                            rel="noreferrer noopener"
                            className="text-primary underline"
                          >
                            open
                          </a>
                        ) : null}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="mt-3 text-sm text-green-700">
                    No licence, inspection or training required.
                  </p>
                )}

                {program.categoryNote ? (
                  <p className="text-muted-foreground mt-2 text-sm">
                    Foods: {program.categoryNote}
                  </p>
                ) : null}
                {program.venueNote && program.venueNote !== "No restrictions" ? (
                  <p className="text-muted-foreground mt-1 text-sm">
                    Where you may sell: {program.venueNote}
                  </p>
                ) : null}

                <form action={action} className="mt-4">
                  <input type="hidden" name="programId" value={program.id} />
                  <Choose chosen={isChosen} />
                </form>
              </li>
            );
          })}
        </ul>

        {state.error ? <p className="text-destructive text-sm">{state.error}</p> : null}
        {state.ok ? (
          <p className="text-sm text-green-700">
            Saved. Listings are now checked against this program rather than against your state as a
            whole.
          </p>
        ) : null}
      </section>
    </div>
  );
}

function Choose({ chosen }: { chosen: boolean }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="sm" variant={chosen ? "outline" : "default"} disabled={pending}>
      {pending ? "Saving…" : chosen ? "Keep this program" : "This is my program"}
    </Button>
  );
}
