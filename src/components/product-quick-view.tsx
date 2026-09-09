"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { AddToCart } from "@/components/add-to-cart";
import { LabelDisclosure } from "@/components/label-disclosure";
import { getQuickViewAction } from "@/app/(shop)/quick-view-actions";
import type { QuickView } from "@/lib/products/quick-view";

/**
 * A listing's detail without leaving the gallery.
 *
 * Built on the native `<dialog>` rather than a modal library: it brings focus trapping, Escape to
 * close, inertness of the page behind it and `::backdrop` with no dependency and no chance of
 * getting the accessibility half subtly wrong by hand.
 *
 * The label disclosure renders INLINE and above the basket button, never behind a toggle — the same
 * rule the storefront follows, and for the same reason (a state asking for a "legible statement" is
 * not satisfied by a collapsed accordion). Where a disclosure is required and could not be built,
 * `canAddToBasket` is false and this offers the storefront link instead of a button.
 */
export function ProductQuickView({
  productId,
  triggerLabel = "Quick view",
  className,
}: {
  productId: string;
  triggerLabel?: string;
  className?: string;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const [state, setState] = useState<"idle" | "loading" | "ready" | "error">("idle");
  const [data, setData] = useState<QuickView | null>(null);

  const open = useCallback(async () => {
    ref.current?.showModal();
    // Loaded once and kept: the detail does not change while a modal is open, and re-fetching on
    // every open would spend a round trip to show the same thing.
    if (state === "ready" || state === "loading") return;

    setState("loading");
    try {
      const result = await getQuickViewAction(productId);
      setData(result);
      setState(result ? "ready" : "error");
    } catch {
      setState("error");
    }
  }, [productId, state]);

  function close() {
    ref.current?.close();
  }

  // Clicking the backdrop closes. The dialog element itself fills the whole viewport as far as the
  // click target is concerned, so the test is whether the click landed outside the inner panel.
  function onDialogClick(e: React.MouseEvent<HTMLDialogElement>) {
    if (e.target === ref.current) close();
  }

  return (
    <>
      <Button type="button" variant="outline" size="sm" onClick={open} className={className}>
        {triggerLabel}
      </Button>

      <dialog
        ref={ref}
        onClick={onDialogClick}
        aria-label={data?.title ?? "Product details"}
        className="bg-background text-foreground m-auto w-[min(38rem,calc(100vw-2rem))] rounded-xl border p-0 shadow-lg backdrop:bg-black/50"
      >
        <div className="max-h-[85vh] overflow-y-auto p-5">
          {state === "loading" || state === "idle" ? (
            <p className="text-muted-foreground py-8 text-center text-sm">Loading…</p>
          ) : state === "error" || !data ? (
            <div className="space-y-3 py-6 text-center">
              <p className="text-sm">We couldn&apos;t load this listing.</p>
              <Button type="button" variant="outline" size="sm" onClick={close}>
                Close
              </Button>
            </div>
          ) : (
            <Detail data={data} onClose={close} />
          )}
        </div>
      </dialog>
    </>
  );
}

function Detail({ data, onClose }: { data: QuickView; onClose: () => void }) {
  const { facts } = data;

  // The modal opens over a gallery the buyer scrolled to; sending focus to the heading means a
  // screen reader announces what opened rather than reading from the close button outwards.
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    heading.current?.focus();
  }, []);

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h2
            ref={heading}
            tabIndex={-1}
            className="text-lg font-semibold tracking-tight outline-none"
          >
            {data.title}
          </h2>
          <Link
            href={`/s/${data.sellerSlug}`}
            className="text-muted-foreground text-sm hover:underline"
          >
            {data.sellerName}
          </Link>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="text-muted-foreground hover:text-foreground shrink-0 rounded-md px-2 py-1 text-lg leading-none"
        >
          ×
        </button>
      </div>

      {data.images[0] ? (
        <div className="bg-muted relative aspect-video overflow-hidden rounded-lg border">
          <Image
            src={data.images[0].url}
            alt={data.images[0].alt ?? ""}
            fill
            className="object-cover"
            sizes="(max-width: 640px) 100vw, 38rem"
          />
        </div>
      ) : null}

      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <p className="text-lg font-medium">{facts.priceLabel}</p>
        {facts.netWeight ? (
          <span className="text-muted-foreground text-sm">{facts.netWeight}</span>
        ) : null}
        {facts.availability ? (
          <Badge variant={facts.orderable ? "secondary" : "outline"}>{facts.availability}</Badge>
        ) : null}
      </div>

      {data.description ? <p className="text-sm">{data.description}</p> : null}

      {facts.allergens ? (
        <p className="text-sm">
          <span className="font-medium">Contains:</span> {facts.allergens}
        </p>
      ) : null}

      {data.ingredients.length > 0 ? (
        <div className="text-sm">
          {/* Order is meaningful — states require descending predominance by weight — so it is
              printed as the seller entered it and never re-sorted. */}
          <p className="font-medium">Ingredients</p>
          <p className="text-muted-foreground">{data.ingredients.join(", ")}</p>
        </div>
      ) : null}

      {data.handlingInstructions ? (
        <div className="text-sm">
          <p className="font-medium">Storage &amp; handling</p>
          <p className="text-muted-foreground">{data.handlingInstructions}</p>
        </div>
      ) : null}

      {/* Above the basket button, always inline. */}
      <LabelDisclosure disclosure={data.disclosure ?? undefined} />

      <div className="border-t pt-4">
        {data.canAddToBasket ? (
          <AddToCart
            variants={data.variants}
            seller={{
              sellerId: data.sellerId,
              sellerSlug: data.sellerSlug,
              sellerName: data.sellerName,
            }}
            product={{
              id: data.id,
              title: data.title,
              price: data.price,
              quantityAvailable: data.quantityAvailable,
            }}
          />
        ) : (
          <div className="space-y-2">
            <p className="text-muted-foreground text-sm">
              {facts.orderable
                ? // A required disclosure we couldn't build. The storefront renders it server-side,
                  // so that is where the buyer can complete the purchase.
                  "Open the storefront to see this listing's label information and order."
                : (facts.availability ?? "This listing isn't available right now.")}
            </p>
            <Button asChild size="sm" variant="outline">
              <Link href={`/s/${data.sellerSlug}`}>View storefront</Link>
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
