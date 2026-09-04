"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  respondToReviewAction,
  type ReviewResponseState,
} from "@/app/(dashboard)/seller/actions";

export function ReviewResponseForm({
  reviewId,
  response,
}: {
  reviewId: string;
  response: string | null;
}) {
  const [state, action] = useActionState<ReviewResponseState, FormData>(
    respondToReviewAction,
    {},
  );
  const [editing, setEditing] = useState(false);

  // On a successful save the page revalidates and the parent remounts this component with a fresh
  // `key` (see ReviewList), so `editing` resets to false on its own — no effect needed here.

  if (response && !editing) {
    return (
      <div className="border-muted mt-1 border-l-2 pl-3">
        <p className="text-muted-foreground text-xs font-medium">Your response</p>
        <p className="text-sm">{response}</p>
        <button
          type="button"
          onClick={() => setEditing(true)}
          className="text-muted-foreground hover:text-foreground mt-1 text-xs underline"
        >
          Edit response
        </button>
      </div>
    );
  }

  if (!response && !editing) {
    return (
      <button
        type="button"
        onClick={() => setEditing(true)}
        className="text-muted-foreground hover:text-foreground text-xs underline"
      >
        Reply to this review
      </button>
    );
  }

  return (
    <form action={action} className="mt-1 space-y-2">
      <input type="hidden" name="reviewId" value={reviewId} />
      <Textarea
        name="response"
        rows={3}
        maxLength={2000}
        defaultValue={response ?? ""}
        placeholder="Reply publicly to this review…"
      />
      {state.error ? <p className="text-destructive text-sm">{state.error}</p> : null}
      <div className="flex items-center gap-2">
        <SubmitButton hasExisting={!!response} />
        <button
          type="button"
          onClick={() => setEditing(false)}
          className="text-muted-foreground hover:text-foreground text-xs underline"
        >
          Cancel
        </button>
        {response ? (
          <span className="text-muted-foreground ml-auto text-xs">
            Clear the text and update to remove it.
          </span>
        ) : null}
      </div>
    </form>
  );
}

function SubmitButton({ hasExisting }: { hasExisting: boolean }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="sm" disabled={pending}>
      {pending ? "Saving…" : hasExisting ? "Update reply" : "Post reply"}
    </Button>
  );
}
