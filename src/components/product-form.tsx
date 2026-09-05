"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import Image from "next/image";
import { X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { createClient } from "@/lib/supabase/client";
import type { Category, ProductImage, Tag } from "@/lib/db/types";
import type { CategoryPermissions } from "@/lib/compliance/categories";
import {
  MAJOR_ALLERGENS,
  NET_WEIGHT_UNITS,
  formatNetWeight,
} from "@/lib/products/labeling";
import {
  createProductAction,
  updateProductAction,
  type ProductFormState,
} from "@/app/(dashboard)/seller/products/actions";

export interface ProductFormValues {
  id?: string;
  title: string;
  description: string;
  price: string;
  categoryId: string;
  subcategoryId: string;
  quantityAvailable: string;
  status: "draft" | "active";
  tagIds: string[];
  images: ProductImage[];
  ingredients: string;
  netWeightValue: string;
  netWeightUnit: string;
  allergens: string[];
}

export function ProductForm({
  sellerId,
  categories,
  tags,
  initial,
  categoryPermissions = {},
}: {
  sellerId: string;
  categories: Category[];
  tags: Tag[];
  initial?: ProductFormValues;
  /** What this seller's state permits, by category id. Empty = no restrictions known. */
  categoryPermissions?: CategoryPermissions;
}) {
  const isEdit = !!initial?.id;
  const [state, action] = useActionState<ProductFormState, FormData>(
    isEdit ? updateProductAction : createProductAction,
    {},
  );

  const [categoryId, setCategoryId] = useState(initial?.categoryId ?? "");
  const [subcategoryId, setSubcategoryId] = useState(initial?.subcategoryId ?? "");
  const [status, setStatus] = useState(initial?.status ?? "draft");
  const [weightValue, setWeightValue] = useState(initial?.netWeightValue ?? "");
  const [weightUnit, setWeightUnit] = useState(initial?.netWeightUnit ?? "");
  const [images, setImages] = useState<ProductImage[]>(initial?.images ?? []);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const permissionFor = (id: string) => categoryPermissions[id];
  const chosen = permissionFor(categoryId);

  const topLevel = categories.filter((c) => c.parent_id === null);
  const subcategories = categories.filter((c) => c.parent_id === categoryId);

  // Food-ness comes from the catalogue, matching `products_guard_label_fields`. Either level
  // carrying the flag is enough. A listing only needs a complete label once it goes live, so a
  // draft can still be saved half-finished.
  const isFoodCategory = categories.some(
    (c) => (c.id === categoryId || c.id === subcategoryId) && c.requires_food_permit,
  );
  const labelRequired = isFoodCategory && status === "active";

  async function handleUpload(files: FileList | null) {
    if (!files?.length) return;
    setUploading(true);
    setUploadError(null);
    const supabase = createClient();
    try {
      const next: ProductImage[] = [];
      for (const file of Array.from(files)) {
        const ext = file.name.split(".").pop() ?? "jpg";
        const path = `${sellerId}/${crypto.randomUUID()}.${ext}`;
        const { error } = await supabase.storage
          .from("product-images")
          .upload(path, file, { cacheControl: "3600", upsert: false });
        if (error) throw error;
        const { data } = supabase.storage.from("product-images").getPublicUrl(path);
        next.push({ path, url: data.publicUrl });
      }
      setImages((prev) => [...prev, ...next]);
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : "Upload failed.");
    } finally {
      setUploading(false);
    }
  }

  return (
    <form action={action} className="space-y-6">
      {isEdit ? <input type="hidden" name="productId" value={initial!.id} /> : null}
      <input type="hidden" name="images" value={JSON.stringify(images)} />

      <div className="space-y-2">
        <Label htmlFor="title">Title</Label>
        <Input id="title" name="title" defaultValue={initial?.title} required />
      </div>

      <div className="space-y-2">
        <Label htmlFor="description">Description</Label>
        <Textarea id="description" name="description" rows={4} defaultValue={initial?.description} />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="price">Price (USD)</Label>
          <Input
            id="price"
            name="price"
            type="number"
            step="0.01"
            min="0"
            defaultValue={initial?.price}
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="quantityAvailable">Quantity available (optional)</Label>
          <Input
            id="quantityAvailable"
            name="quantityAvailable"
            type="number"
            min="0"
            step="1"
            defaultValue={initial?.quantityAvailable}
          />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="categoryId">Category</Label>
          <select
            id="categoryId"
            name="categoryId"
            required
            value={categoryId}
            onChange={(e) => {
              setCategoryId(e.target.value);
              // The old sub-category belongs to the old parent — keeping it would submit a pairing
              // that isn't offered, and would skew the food-category check.
              setSubcategoryId("");
            }}
            className="border-input bg-background h-9 w-full rounded-md border px-3 text-sm"
          >
            <option value="" disabled>
              Select a category
            </option>
            {topLevel.map((c) => {
              const permission = permissionFor(c.id);
              return (
                <option key={c.id} value={c.id} disabled={permission?.allowed === false}>
                  {c.name}
                  {permission?.allowed === false ? " — not allowed in your state" : ""}
                </option>
              );
            })}
          </select>
          {chosen?.allowed === false ? (
            <p className="text-destructive text-xs">{chosen.reason}</p>
          ) : null}
          {chosen?.qualification ? (
            <p className="text-muted-foreground text-xs">{chosen.qualification}</p>
          ) : null}
        </div>
        <div className="space-y-2">
          <Label htmlFor="subcategoryId">Sub-category (optional)</Label>
          <select
            id="subcategoryId"
            name="subcategoryId"
            value={subcategoryId}
            onChange={(e) => setSubcategoryId(e.target.value)}
            disabled={subcategories.length === 0}
            className="border-input bg-background h-9 w-full rounded-md border px-3 text-sm disabled:opacity-50"
          >
            <option value="">None</option>
            {subcategories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      <fieldset className="space-y-4 rounded-lg border p-4">
        <legend className="px-1 text-sm font-medium">Label details</legend>
        {isFoodCategory ? (
          <p className="text-muted-foreground -mt-1 text-sm">
            Buyers are shown this label before they pay, so a food listing needs its ingredients and
            net weight to go live. You can leave them for now and save as a draft.
          </p>
        ) : (
          <p className="text-muted-foreground -mt-1 text-sm">
            Most states require these on the label of any homemade food. This category isn&apos;t
            food, so they&apos;re optional.
          </p>
        )}

        <div className="space-y-2">
          <Label htmlFor="ingredients">
            Ingredients
            {labelRequired ? <span className="text-destructive"> *</span> : null}
          </Label>
          <Textarea
            id="ingredients"
            name="ingredients"
            rows={4}
            required={labelRequired}
            defaultValue={initial?.ingredients}
            placeholder={"Wheat flour\nWater\nSourdough culture\nSea salt"}
          />
          <p className="text-muted-foreground text-xs">
            One per line, <strong>most to least by weight</strong> — that order is what goes on the
            label, so it isn&apos;t re-sorted. A comma-separated list on one line works too.
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-[1fr_1.4fr]">
          <div className="space-y-2">
            <Label htmlFor="netWeightValue">
              Net quantity
              {labelRequired ? <span className="text-destructive"> *</span> : null}
            </Label>
            <Input
              id="netWeightValue"
              name="netWeightValue"
              type="number"
              step="0.001"
              min="0"
              required={labelRequired}
              value={weightValue}
              onChange={(e) => setWeightValue(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="netWeightUnit">
              Unit
              {labelRequired ? <span className="text-destructive"> *</span> : null}
            </Label>
            <select
              id="netWeightUnit"
              name="netWeightUnit"
              required={labelRequired}
              value={weightUnit}
              onChange={(e) => setWeightUnit(e.target.value)}
              className="border-input h-8 w-full rounded-lg border bg-transparent px-2.5 text-sm"
            >
              <option value="">Choose a unit</option>
              {NET_WEIGHT_UNITS.map((u) => (
                <option key={u.value} value={u.value}>
                  {u.label}
                </option>
              ))}
            </select>
          </div>
        </div>
        {formatNetWeight(weightValue, weightUnit) ? (
          <p className="text-muted-foreground text-xs">
            On the label: <span className="font-mono">{formatNetWeight(weightValue, weightUnit)}</span>
            . Some states require the metric equivalent, so it&apos;s worked out for you.
          </p>
        ) : null}

        <div className="space-y-2">
          <span className="text-sm font-medium">Allergens</span>
          <p className="text-muted-foreground text-xs">
            Tick every one present. These nine are the ones federal law names, and most states
            require them called out.
          </p>
          <div className="flex flex-wrap gap-2">
            {MAJOR_ALLERGENS.map((a) => (
              <label
                key={a.value}
                className="has-[:checked]:bg-primary has-[:checked]:text-primary-foreground flex cursor-pointer items-center gap-1.5 rounded-full border px-3 py-1 text-sm"
              >
                <input
                  type="checkbox"
                  name="allergens"
                  value={a.value}
                  defaultChecked={initial?.allergens.includes(a.value)}
                  className="sr-only"
                />
                {a.label}
              </label>
            ))}
          </div>
        </div>
      </fieldset>

      <fieldset className="space-y-2">
        <legend className="text-sm font-medium">Tags</legend>
        <div className="flex flex-wrap gap-2">
          {tags.map((t) => (
            <label
              key={t.id}
              className="has-[:checked]:bg-primary has-[:checked]:text-primary-foreground flex cursor-pointer items-center gap-1.5 rounded-full border px-3 py-1 text-sm"
            >
              <input
                type="checkbox"
                name="tagIds"
                value={t.id}
                defaultChecked={initial?.tagIds.includes(t.id)}
                className="sr-only"
              />
              {t.name}
            </label>
          ))}
        </div>
      </fieldset>

      <div className="space-y-2">
        <Label htmlFor="imageUpload">Photos</Label>
        <div className="flex flex-wrap gap-3">
          {images.map((img) => (
            <div key={img.path} className="relative size-24 overflow-hidden rounded-md border">
              <Image src={img.url} alt="" fill className="object-cover" sizes="96px" />
              <button
                type="button"
                onClick={() => setImages((prev) => prev.filter((i) => i.path !== img.path))}
                className="bg-background/80 absolute right-1 top-1 rounded-full p-0.5"
                aria-label="Remove photo"
              >
                <X className="size-3.5" />
              </button>
            </div>
          ))}
        </div>
        <Input
          id="imageUpload"
          type="file"
          accept="image/jpeg,image/png,image/webp,image/avif"
          multiple
          disabled={uploading}
          onChange={(e) => handleUpload(e.target.files)}
        />
        {uploading ? <p className="text-muted-foreground text-xs">Uploading…</p> : null}
        {uploadError ? <p className="text-destructive text-xs">{uploadError}</p> : null}
      </div>

      <div className="space-y-2">
        <Label htmlFor="status">Status</Label>
        <select
          id="status"
          name="status"
          value={status}
          onChange={(e) => setStatus(e.target.value as "draft" | "active")}
          className="border-input bg-background h-9 w-full rounded-md border px-3 text-sm"
        >
          <option value="draft">Draft — not visible to buyers</option>
          <option value="active">Active — listed on your storefront</option>
        </select>
      </div>

      {state.error ? <p className="text-destructive text-sm">{state.error}</p> : null}

      <Submit isEdit={isEdit} />
    </form>
  );
}

function Submit({ isEdit }: { isEdit: boolean }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? "Saving…" : isEdit ? "Save changes" : "Create product"}
    </Button>
  );
}
