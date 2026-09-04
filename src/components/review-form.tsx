"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { StarRating, StarRatingInput } from "@/components/star-rating";
import {
  submitReviewAction,
  deleteReviewAction,
  type ReviewFormState,
} from "@/app/(shop)/orders/[id]/actions";

export function ReviewForm({ orderId }: { orderId: string }) {
  const [state, action] = useActionState<ReviewFormState, FormData>(submitReviewAction, {});

  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="orderId" value={orderId} />
      <StarRatingInput />
      <Textarea name="body" rows={3} maxLength={2000} placeholder="How was it? (optional)" />
      {state.error ? <p className="text-destructive text-sm">{state.error}</p> : null}
      <SubmitButton />
    </form>
  );
}

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="sm" disabled={pending}>
      {pending ? "Posting…" : "Post review"}
    </Button>
  );
}

export function ExistingReview({
  orderId,
  review,
}: {
  orderId: string;
  review: { id: string; rating: number; body: string | null; created_at: string; response?: string | null };
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <StarRating value={review.rating} />
        <span className="text-muted-foreground text-xs">
          {new Date(review.created_at).toLocaleDateString(undefined, { dateStyle: "medium" })}
        </span>
      </div>
      {review.body ? <p className="text-sm">{review.body}</p> : null}
      {review.response ? (
        <div className="border-muted border-l-2 pl-3">
          <p className="text-muted-foreground text-xs font-medium">Response from the seller</p>
          <p className="text-sm">{review.response}</p>
        </div>
      ) : null}
      <form action={deleteReviewAction}>
        <input type="hidden" name="reviewId" value={review.id} />
        <input type="hidden" name="orderId" value={orderId} />
        <button
          type="submit"
          className="text-muted-foreground hover:text-foreground text-xs underline"
        >
          Remove review
        </button>
      </form>
    </div>
  );
}
