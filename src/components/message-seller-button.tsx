import { Button } from "@/components/ui/button";
import { startConversationAction } from "@/app/messages/actions";

/**
 * Opens (or reuses) a thread. Pass `sellerId` for a general inquiry from a storefront, or
 * `orderId` for an order-scoped thread from either party's order page.
 */
export function MessageSellerButton({
  sellerId,
  orderId,
  label,
  variant = "outline",
}: {
  sellerId?: string;
  orderId?: string;
  label: string;
  variant?: "outline" | "default" | "ghost";
}) {
  return (
    <form action={startConversationAction}>
      {sellerId ? <input type="hidden" name="sellerId" value={sellerId} /> : null}
      {orderId ? <input type="hidden" name="orderId" value={orderId} /> : null}
      <Button type="submit" size="sm" variant={variant}>
        {label}
      </Button>
    </form>
  );
}
