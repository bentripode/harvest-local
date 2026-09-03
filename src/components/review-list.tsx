import { StarRating } from "@/components/star-rating";
import type { ReviewListItem } from "@/lib/reviews/queries";

export function ReviewList({ reviews }: { reviews: ReviewListItem[] }) {
  if (reviews.length === 0) {
    return <p className="text-muted-foreground text-sm">No reviews yet.</p>;
  }

  return (
    <ul className="divide-y rounded-lg border">
      {reviews.map((r) => (
        <li key={r.id} className="space-y-1.5 p-4">
          <div className="flex items-center gap-2">
            <StarRating value={r.rating} />
            <span className="text-sm font-medium">{r.reviewerName}</span>
            <span className="text-muted-foreground text-xs">
              {new Date(r.createdAt).toLocaleDateString(undefined, { dateStyle: "medium" })}
            </span>
          </div>
          {r.body ? <p className="text-sm">{r.body}</p> : null}
        </li>
      ))}
    </ul>
  );
}
