import { Badge } from "@/components/ui/badge";

/**
 * What an edit to this programme would cost, before anyone makes it.
 *
 * `products_guard_food_categories` only fires when a PRODUCT is written — nothing re-checks the
 * catalogue when the rule changes underneath it. So an admin flipping an axis to `banned` is
 * unpublishing other people's listings, and until now had no way to see how many.
 *
 * A pure read: this simulates nothing and changes nothing. It answers one question per axis —
 * "if I banned this, what goes down?"
 */

export interface ExposureRow {
  axis: string;
  sellers: number;
  listings: number;
}

const AXIS_LABEL: Record<string, string> = {
  online_orders: "Ban online food sales outright",
  shelf_stable: "Ban shelf-stable food",
  refrigerated: "Ban refrigerated food",
  meat: "Ban meat",
  acidified: "Ban acidified or pickled food",
  low_acid_canned: "Ban low-acid canned goods",
  fermented: "Ban fermented food",
};

export function ProgramExposure({ rows }: { rows: ExposureRow[] }) {
  const total = rows.find((r) => r.axis === "online_orders");
  const axes = rows
    .filter((r) => r.axis !== "online_orders")
    .sort((a, b) => b.listings - a.listings);

  if (!total || total.listings === 0) {
    return (
      <div className="rounded-lg border p-4 text-sm">
        <p className="font-medium">Nothing is riding on this programme yet</p>
        <p className="text-muted-foreground mt-1">
          No live food listings belong to a seller on it, so changing these values unpublishes
          nothing today. That will not stay true — check again before a later edit.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3 rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
      <div>
        <p className="font-medium">What a change here would cost</p>
        <p className="mt-1">
          {total.listings} live food listing{total.listings === 1 ? "" : "s"} from {total.sellers}{" "}
          seller{total.sellers === 1 ? "" : "s"} sit on this programme — including sellers in this
          state who have chosen no programme, if this is the first one. Moving a value to{" "}
          <span className="font-mono">banned</span> moves their listings back to draft and emails
          them.
        </p>
      </div>

      <ul className="space-y-1">
        {axes.map((row) => (
          <li key={row.axis} className="flex items-center justify-between gap-3">
            <span>{AXIS_LABEL[row.axis] ?? row.axis}</span>
            {row.listings === 0 ? (
              <span className="text-amber-700/70">nothing</span>
            ) : (
              <Badge variant="destructive">
                {row.listings} listing{row.listings === 1 ? "" : "s"} · {row.sellers} seller
                {row.sellers === 1 ? "" : "s"}
              </Badge>
            )}
          </li>
        ))}
      </ul>

      <p className="text-xs text-amber-900/80">
        Nothing is deleted, and the seller keeps their work. A value moving away from{" "}
        <span className="font-mono">banned</span> republishes nothing on its own — that is the
        seller&apos;s decision about their own shop — but they are told, because nobody watches a
        draft.
      </p>
    </div>
  );
}
