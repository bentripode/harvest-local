"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";

import { Button } from "@/components/ui/button";
import {
  saveNotificationPrefsAction,
  type NotificationPrefsState,
} from "@/app/(dashboard)/seller/settings/actions";
import {
  CATEGORY_META,
  type NotificationPrefs,
  type SuppressibleCategory,
} from "@/lib/notifications/categories";

export function NotificationPrefsForm({
  categories,
  prefs,
}: {
  categories: SuppressibleCategory[];
  prefs: NotificationPrefs;
}) {
  const [state, action] = useActionState<NotificationPrefsState, FormData>(
    saveNotificationPrefsAction,
    {},
  );

  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="fields" value={categories.join(",")} />
      <ul className="space-y-3">
        {categories.map((category) => {
          const meta = CATEGORY_META[category];
          return (
            <li key={category} className="flex items-start gap-3">
              <input
                id={`email_${category}`}
                type="checkbox"
                name={`email_${category}`}
                defaultChecked={prefs[category] !== false}
                className="mt-0.5 size-4"
              />
              <label htmlFor={`email_${category}`} className="text-sm">
                <span className="font-medium">{meta.label}</span>
                <span className="text-muted-foreground block text-xs">{meta.description}</span>
              </label>
            </li>
          );
        })}
      </ul>

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
      {pending ? "Saving…" : "Save preferences"}
    </Button>
  );
}
