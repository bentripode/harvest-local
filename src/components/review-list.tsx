import { StarRating } from "@/components/star-rating";
import { ReviewResponseForm } from "@/components/review-response-form";
import type { ReviewListItem } from "@/lib/reviews/queries";

export function ReviewList({
  reviews,
  respondable = false,
}: {
  reviews: ReviewListItem[];
  /** Seller view: show a form to write / edit / clear the reply on each review. */
  respondable?: boolean;
}) {
  if (reviews.length === 0) {
    return <p className="text-muted-foreground text-sm">No reviews yet.</p>;
  }

  return (
    <ul className="divide-y rounded-lg border">
      {reviews.map((r) => (
        <li key={r.id} className="space-y-2 p-4">
          <div className="flex items-center gap-2">
            <StarRating value={r.rating} />
            <span className="text-sm font-medium">{r.reviewerName}</span>
            <span className="text-muted-foreground text-xs">
              {new Date(r.createdAt).toLocaleDateString(undefined, { dateStyle: "medium" })}
            </span>
          </div>
          {r.body ? <p className="text-sm">{r.body}</p> : null}

          {respondable ? (
            <ReviewResponseForm
              key={r.respondedAt ?? "none"}
              reviewId={r.id}
              response={r.response}
            />
          ) : r.response ? (
            <div className="border-muted mt-1 border-l-2 pl-3">
              <p className="text-muted-foreground text-xs font-medium">Response from the seller</p>
              <p className="text-sm">{r.response}</p>
            </div>
          ) : null}
        </li>
      ))}
    </ul>
  );
}
