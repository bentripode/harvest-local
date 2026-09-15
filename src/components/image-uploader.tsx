"use client";

import { useId, useRef, useState } from "react";
import Image from "next/image";
import { X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";
import {
  IMAGE_BOUNDS,
  fitWithin,
  needsProcessing,
  storagePath,
  type ImageKind,
} from "@/lib/images/resize";

/**
 * Picking a photo, shrinking it, and putting it in the bucket.
 *
 * One component for every image a seller owns — product photos, their mark, their banner, a photo
 * on a post. It was written inline in `product-form` and nowhere else, which is why three of those
 * four had no way to be filled: `seller_posts.image_path` has been in the schema since
 * `20260908290000` and `createPostAction` has accepted an `imagePath` the whole time, with no UI
 * that could supply one.
 *
 * **Every file is fitted to a box before it leaves the device.** A phone camera produces a
 * 4000×3000 JPEG of several megabytes; as an avatar that is a 40px circle the browser downloads in
 * full, once per seller on the gallery, on cell data. `needsProcessing` leaves small in-bounds
 * images alone rather than re-encoding them, because pushing a transparent PNG through a canvas
 * makes it a worse JPEG and often a bigger file.
 *
 * **Uploads happen on pick, not on submit**, which is what makes the preview instant and is also
 * this component's one real flaw: a seller who picks a photo and then abandons the form leaves an
 * object in the bucket that nothing references. Removing a photo deletes it, and replacing an
 * avatar deletes the one it replaced, so the common paths are covered — but an abandoned form is
 * not, and a sweep for unreferenced objects is still owed. Deferring the upload to submit would
 * trade that for a slow, silent Save button, which is the worse end of the deal.
 */

export interface UploadedImage {
  path: string;
  url: string;
}

export function ImageUploader({
  sellerId,
  kind,
  value,
  onChange,
  multiple = false,
  label = "Add a photo",
  shape = "square",
  className,
}: {
  /** seller_profiles.id — the FIRST path segment, which is what the storage policy checks. */
  sellerId: string;
  kind: ImageKind;
  value: UploadedImage[];
  onChange: (next: UploadedImage[]) => void;
  multiple?: boolean;
  label?: string;
  /** How the preview is cropped. Cosmetic — the stored file is never cropped. */
  shape?: "square" | "circle" | "wide";
  className?: string;
}) {
  const inputId = useId();
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleFiles(files: FileList | null) {
    if (!files?.length) return;
    setBusy(true);
    setError(null);

    const supabase = createClient();
    const added: UploadedImage[] = [];

    try {
      for (const file of Array.from(files)) {
        const prepared = await shrink(file, IMAGE_BOUNDS[kind]);
        // Name the object after what it CONTAINS. The canvas re-encodes to JPEG, so building the
        // path from the original file name stored a 1600px JPEG called ".png" — served correctly,
        // because Supabase takes the content type from the blob, but a lie to anyone reading the
        // bucket or handling the file later.
        const path = storagePath(sellerId, kind, prepared.reEncoded ? "photo.jpg" : file.name);

        const { error: upErr } = await supabase.storage
          .from("product-images")
          .upload(path, prepared.blob, { cacheControl: "3600", upsert: false });
        if (upErr) throw upErr;

        const { data } = supabase.storage.from("product-images").getPublicUrl(path);
        added.push({ path, url: data.publicUrl });
      }

      onChange(multiple ? [...value, ...added] : added.slice(-1));
    } catch (err) {
      setError(err instanceof Error ? err.message : "That didn't upload. Try again?");
    } finally {
      setBusy(false);
      // Let the same file be chosen again after a failure, which it otherwise cannot be.
      if (input.current) input.current.value = "";
    }
  }

  async function remove(image: UploadedImage) {
    onChange(value.filter((i) => i.path !== image.path));
    // Best effort: the row no longer points at it either way, and a failed delete is an orphaned
    // object rather than a broken page — not worth blocking the seller with an error.
    try {
      await createClient().storage.from("product-images").remove([image.path]);
    } catch {
      /* leave it in the bucket */
    }
  }

  const box =
    shape === "wide"
      ? "aspect-[3/1] w-full"
      : shape === "circle"
        ? "size-20 rounded-full"
        : "size-24";

  return (
    <div className={`space-y-2 ${className ?? ""}`}>
      {value.length > 0 ? (
        <div className={multiple ? "flex flex-wrap gap-3" : ""}>
          {value.map((img) => (
            <div
              key={img.path}
              className={`bg-muted relative overflow-hidden border ${box} ${
                shape === "circle" ? "" : "rounded-xl"
              }`}
            >
              <Image
                src={img.url}
                alt=""
                fill
                className="object-cover"
                sizes={shape === "wide" ? "(max-width: 768px) 100vw, 640px" : "96px"}
              />
              <button
                type="button"
                onClick={() => remove(img)}
                className="bg-background/85 absolute top-1 right-1 rounded-full p-1 backdrop-blur-sm"
                aria-label="Remove this photo"
              >
                <X className="size-3.5" />
              </button>
            </div>
          ))}
        </div>
      ) : null}

      <input
        ref={input}
        id={inputId}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/avif"
        multiple={multiple}
        disabled={busy}
        onChange={(e) => handleFiles(e.target.files)}
        className="sr-only"
      />
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={busy}
        onClick={() => input.current?.click()}
      >
        {busy ? "Uploading…" : value.length > 0 && !multiple ? "Replace" : label}
      </Button>

      {error ? <p className="text-destructive text-xs">{error}</p> : null}
    </div>
  );
}

/** The bytes to upload, and whether they are still the file the seller picked. */
interface Prepared {
  blob: Blob;
  /** True when the canvas produced JPEG bytes, so the object needs a .jpg name. */
  reEncoded: boolean;
}

/**
 * Fit a file inside a box, re-encoding only when that is actually worth doing.
 *
 * Returns the ORIGINAL File when it is already small enough, so an image that needs nothing is
 * uploaded byte-for-byte rather than round-tripped through a lossy encoder.
 */
async function shrink(file: File, max: number): Promise<Prepared> {
  const untouched: Prepared = { blob: file, reEncoded: false };

  const bitmap = await createImageBitmap(file).catch(() => null);
  // A file the browser cannot decode is not one we can shrink. Let it upload and let the bucket's
  // own MIME allow-list be the thing that refuses it, rather than inventing a second error here.
  if (!bitmap) return untouched;

  try {
    const source = { width: bitmap.width, height: bitmap.height };
    if (!needsProcessing(source, file.size, max)) return untouched;

    const target = fitWithin(source, max);
    const canvas = document.createElement("canvas");
    canvas.width = target.width;
    canvas.height = target.height;

    const ctx = canvas.getContext("2d");
    if (!ctx) return untouched;
    ctx.drawImage(bitmap, 0, 0, target.width, target.height);

    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/jpeg", 0.85),
    );

    // If the encode failed, or somehow came out heavier, keep what we already had.
    return blob && blob.size < file.size ? { blob, reEncoded: true } : untouched;
  } finally {
    bitmap.close();
  }
}
