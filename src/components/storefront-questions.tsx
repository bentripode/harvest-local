"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { askQuestionAction, type StorefrontFormState } from "@/app/(shop)/storefront/actions";
import type { StorefrontQuestion } from "@/lib/storefront/queries";

/**
 * The public Q&A on a storefront.
 *
 * Only answered questions are public — that is RLS, not a filter here — so what a stranger reads is
 * entirely made of exchanges the seller chose to stand behind. An asker additionally sees their own
 * while it waits, which is why a question can appear here with no answer.
 */

function Submit() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="sm" disabled={pending}>
      {pending ? "Sending…" : "Ask"}
    </Button>
  );
}

export function StorefrontQuestions({
  sellerId,
  sellerName,
  slug,
  questions,
}: {
  sellerId: string;
  sellerName: string;
  slug: string;
  questions: StorefrontQuestion[];
}) {
  const [state, action] = useActionState<StorefrontFormState, FormData>(askQuestionAction, {});

  return (
    <section className="space-y-4">
      <h2 className="text-sm font-medium">Questions</h2>

      {questions.length > 0 ? (
        <ul className="divide-y rounded-lg border">
          {questions.map((q) => (
            <li key={q.id} className="space-y-2 p-4 text-sm">
              <p className="font-medium">{q.body}</p>
              <p className="text-muted-foreground text-xs">
                {q.askerName}
                {q.status === "open" ? " · waiting for an answer" : ""}
              </p>
              {q.answer ? (
                <div className="border-l-2 pl-3">
                  <p className="text-muted-foreground text-xs font-medium">{sellerName}</p>
                  <p>{q.answer}</p>
                </div>
              ) : null}
            </li>
          ))}
        </ul>
      ) : null}

      {state.ok ? (
        <p className="rounded-md border p-3 text-sm">
          Asked. Only {sellerName} can see it until they answer — then it appears here.
        </p>
      ) : (
        <form action={action} className="space-y-2">
          <input type="hidden" name="sellerId" value={sellerId} />
          <input type="hidden" name="slug" value={slug} />
          <label htmlFor="ask" className="text-muted-foreground block text-sm">
            Ask {sellerName} something. It stays private until they answer.
          </label>
          <textarea
            id="ask"
            name="body"
            rows={3}
            maxLength={1000}
            required
            placeholder="Is the sourdough dairy free?"
            className="border-input w-full rounded-md border bg-transparent p-2.5 text-sm"
          />
          <div className="flex items-center gap-3">
            <Submit />
            {state.needsAccount ? (
              <span className="text-muted-foreground text-sm">
                <Link href="/login" className="underline">
                  Sign in
                </Link>{" "}
                to ask.
              </span>
            ) : state.error ? (
              <span className="text-destructive text-sm">{state.error}</span>
            ) : null}
          </div>
        </form>
      )}
    </section>
  );
}
