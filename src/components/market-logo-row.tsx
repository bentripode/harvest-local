"use client";

import { useId, useRef, useState, useTransition } from "react";
import Image from "next/image";
import { Store } from "lucide-react";

import { Button } from "@/components/ui/button";
import { removeMarketLogoAction, uploadMarketLogoAction } from "@/app/admin/markets/actions";
import { fitWithin } from "@/lib/images/resize";
import { LOGO_PX } from "@/lib/markets/logo";

export interface LogoRowMarket {
  id: string;
  name: string;
  city: string | null;
  state: string;
  slug: string;
  websiteUrl: string | null;
  facebookUrl: string | null;
  imageUrl: string | null;
  imageSource: string | null;
  imageSourceUrl: string | null;
}

/**
 * Shrink to the scan's thumbnail size and re-encode as JPEG, on a white ground — most of these are
 * logos, and a transparent PNG drawn onto a JPEG otherwise comes out on black.
 */
async function toThumbnail(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  const { width, height } = fitWithin({ width: bitmap.width, height: bitmap.height }, LOGO_PX);
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("no canvas");
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, width, height);
  ctx.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();
  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("encode"))), "image/jpeg", 0.85),
  );
}

/**
 * One market on /admin/markets: its current picture, where to find one (its Facebook page and
 * website, opened in a new tab so the admin can save the logo by hand), and an upload that
 * records the page the picture came from.
 */
export function MarketLogoRow({ market }: { market: LogoRowMarket }) {
  const inputId = useId();
  const fileInput = useRef<HTMLInputElement>(null);
  const [imageUrl, setImageUrl] = useState(market.imageUrl);
  const [imageSource, setImageSource] = useState(market.imageSource);
  const [sourceUrl, setSourceUrl] = useState(
    market.facebookUrl ?? market.websiteUrl ?? "",
  );
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function upload(file: File) {
    setError(null);
    startTransition(async () => {
      let thumb: Blob;
      try {
        thumb = await toThumbnail(file);
      } catch {
        setError("That file couldn't be read as a picture.");
        return;
      }
      const fd = new FormData();
      fd.set("marketId", market.id);
      fd.set("sourceUrl", sourceUrl);
      fd.set("logo", new File([thumb], "logo.jpg", { type: "image/jpeg" }));
      const res = await uploadMarketLogoAction(fd);
      if (res.error) setError(res.error);
      else {
        setImageUrl(res.imageUrl ?? null);
        setImageSource("admin");
      }
      if (fileInput.current) fileInput.current.value = "";
    });
  }

  function remove() {
    setError(null);
    startTransition(async () => {
      const fd = new FormData();
      fd.set("marketId", market.id);
      const res = await removeMarketLogoAction(fd);
      if (res.error) setError(res.error);
      else {
        setImageUrl(null);
        setImageSource(null);
      }
    });
  }

  return (
    <li className="flex gap-4 rounded-xl border p-3">
      <div
        className={`relative size-20 shrink-0 overflow-hidden rounded-lg ${
          imageUrl ? "border bg-white" : "bg-muted"
        }`}
      >
        {imageUrl ? (
          <Image src={imageUrl} alt="" fill sizes="80px" className="object-contain p-1" />
        ) : (
          <Store aria-hidden className="text-muted-foreground absolute inset-0 m-auto size-7" />
        )}
      </div>

      <div className="min-w-0 flex-1 space-y-2">
        <div>
          <p className="leading-snug font-medium">{market.name}</p>
          <p className="text-muted-foreground text-xs">
            {[market.city, market.state].filter(Boolean).join(", ")}
            {imageUrl ? (
              <>
                {" · "}
                {imageSource === "admin" ? "uploaded by hand" : "from its website"}
              </>
            ) : null}
          </p>
          <p className="flex flex-wrap gap-x-3 text-xs">
            {market.facebookUrl ? (
              <a href={market.facebookUrl} target="_blank" rel="noopener noreferrer" className="underline">
                Facebook ↗
              </a>
            ) : null}
            {market.websiteUrl ? (
              <a href={market.websiteUrl} target="_blank" rel="noopener noreferrer" className="underline">
                Website ↗
              </a>
            ) : null}
            <a
              href={`/markets/${market.state.toLowerCase()}/${market.slug}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-muted-foreground underline"
            >
              Market page ↗
            </a>
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <label htmlFor={`${inputId}-src`} className="sr-only">
            Page the picture came from
          </label>
          <input
            id={`${inputId}-src`}
            type="url"
            value={sourceUrl}
            onChange={(e) => setSourceUrl(e.target.value)}
            placeholder="Page the picture came from"
            className="border-input bg-background h-8 min-w-0 flex-1 basis-56 rounded-md border px-2 text-xs"
          />
          <input
            ref={fileInput}
            id={inputId}
            type="file"
            accept="image/png,image/jpeg,image/webp,image/gif"
            className="sr-only"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) upload(f);
            }}
          />
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={pending}
            onClick={() => fileInput.current?.click()}
          >
            {pending ? "Saving…" : imageUrl ? "Replace picture" : "Upload picture"}
          </Button>
          {imageUrl ? (
            <Button type="button" size="sm" variant="ghost" disabled={pending} onClick={remove}>
              Remove
            </Button>
          ) : null}
        </div>
        {error ? <p className="text-destructive text-xs">{error}</p> : null}
      </div>
    </li>
  );
}
