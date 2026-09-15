"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { SellerAvatar } from "@/components/seller-avatar";
import { ImageUploader, type UploadedImage } from "@/components/image-uploader";
import {
  saveStorefrontImagesAction,
  type ImagesFormState,
} from "@/app/(dashboard)/seller/story/actions";

function Submit() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="sm" disabled={pending}>
      {pending ? "Saving…" : "Save photos"}
    </Button>
  );
}

/**
 * The seller's mark and their banner.
 *
 * Two images because they answer different questions. The avatar is *who this is* — it travels with
 * the seller onto the gallery, the basket and the dashboard at 28–64px, so it has to read at the
 * size of a thumbnail. The cover is *what they make*, appears once at the top of the storefront,
 * and is the only place a photograph gets any room.
 *
 * Neither is required. `SellerAvatar` draws an initial on a hue derived from the business name when
 * there is no photo, and a missing cover renders no band at all — an empty grey banner looks like a
 * page that failed to load, which is worse than a page that simply doesn't have one.
 */
export function StorefrontImagesForm({
  sellerId,
  businessName,
  initialAvatar,
  initialCover,
}: {
  sellerId: string;
  businessName: string;
  initialAvatar: UploadedImage | null;
  initialCover: UploadedImage | null;
}) {
  const [state, action] = useActionState<ImagesFormState, FormData>(saveStorefrontImagesAction, {});
  const [avatar, setAvatar] = useState<UploadedImage[]>(initialAvatar ? [initialAvatar] : []);
  const [cover, setCover] = useState<UploadedImage[]>(initialCover ? [initialCover] : []);

  return (
    <form action={action} className="space-y-6">
      <input type="hidden" name="avatarPath" value={avatar[0]?.path ?? ""} />
      <input type="hidden" name="avatarUrl" value={avatar[0]?.url ?? ""} />
      <input type="hidden" name="coverPath" value={cover[0]?.path ?? ""} />
      <input type="hidden" name="coverUrl" value={cover[0]?.url ?? ""} />

      <div className="space-y-2">
        <Label>Your photo</Label>
        <p className="text-muted-foreground text-sm">
          A face or your logo. Shown small, beside your name.
        </p>
        <div className="flex items-center gap-4">
          {avatar.length === 0 ? (
            // What a buyer sees today, at the size they'll see it — so "no photo" is a visible
            // choice rather than an empty slot.
            <SellerAvatar name={businessName} size="lg" />
          ) : null}
          <ImageUploader
            sellerId={sellerId}
            kind="avatar"
            shape="circle"
            value={avatar}
            onChange={setAvatar}
            label="Add a photo"
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label>Banner</Label>
        <p className="text-muted-foreground text-sm">
          A wide photo across the top of your storefront. Your stall, your kitchen, what you make.
        </p>
        <ImageUploader
          sellerId={sellerId}
          kind="cover"
          shape="wide"
          value={cover}
          onChange={setCover}
          label="Add a banner"
        />
      </div>

      <div className="flex items-center gap-3">
        <Submit />
        {state.ok ? <span className="text-muted-foreground text-sm">Saved.</span> : null}
        {state.error ? <span className="text-destructive text-sm">{state.error}</span> : null}
      </div>
    </form>
  );
}
