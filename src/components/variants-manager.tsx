"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  saveVariantsAction,
  type VariantFormState,
} from "@/app/(dashboard)/seller/products/variant-actions";

/**
 * Sizes and scents for one listing.
 *
 * Deliberately below the main product form and not part of it: what varies between options is
 * price, stock and net weight, and nothing else. Ingredients, allergens and handling instructions
 * stay on the product, which is the whole reason variants exist — six scents used to mean six
 * copies of the label data and six chances for it to be wrong.
 */

export interface EditableVariant {
  id?: string;
  name: string;
  price: string;
  quantityAvailable: string;
  netWeightValue: string;
  netWeightUnit: string;
  sku: string;
  isActive: boolean;
}

const UNITS = ["oz", "lb", "g", "kg", "fl_oz", "ml", "count"] as const;

const BLANK: EditableVariant = {
  name: "",
  price: "",
  quantityAvailable: "",
  netWeightValue: "",
  netWeightUnit: "",
  sku: "",
  isActive: true,
};

function Submit() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="sm" disabled={pending}>
      {pending ? "Saving…" : "Save options"}
    </Button>
  );
}

export function VariantsManager({
  productId,
  initial,
  productPrice,
}: {
  productId: string;
  initial: EditableVariant[];
  productPrice: string;
}) {
  const [state, action] = useActionState<VariantFormState, FormData>(saveVariantsAction, {});
  const [rows, setRows] = useState<EditableVariant[]>(initial);

  const update = (i: number, patch: Partial<EditableVariant>) =>
    setRows((prev) => prev.map((r, j) => (j === i ? { ...r, ...patch } : r)));

  const payload = JSON.stringify({ productId, variants: rows });

  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="payload" value={payload} />

      <div>
        <p className="text-sm font-medium">Options</p>
        <p className="text-muted-foreground text-sm">
          {rows.length === 0
            ? `Sells as one thing at ${productPrice}. Add options for sizes or scents — each gets its
          own price and stock.`
            : "Buyers pick one of these. The listing's own price isn't used once options exist."}
        </p>
      </div>

      {rows.length > 0 ? (
        <ul className="space-y-3">
          {rows.map((r, i) => (
            <li key={r.id ?? `new-${i}`} className="space-y-3 rounded-md border p-3">
              <div className="grid gap-3 sm:grid-cols-4">
                <Field
                  label="Name"
                  value={r.name}
                  onChange={(v) => update(i, { name: v })}
                  placeholder="Lavender"
                />
                <Field
                  label="Price"
                  value={r.price}
                  onChange={(v) => update(i, { price: v })}
                  placeholder="12.50"
                  inputMode="decimal"
                />
                <Field
                  label="Stock"
                  value={r.quantityAvailable}
                  onChange={(v) => update(i, { quantityAvailable: v })}
                  placeholder="Unlimited"
                  inputMode="numeric"
                />
                <Field
                  label="SKU"
                  value={r.sku}
                  onChange={(v) => update(i, { sku: v })}
                  placeholder="Optional"
                />
              </div>

              <div className="grid gap-3 sm:grid-cols-4">
                <Field
                  label="Net weight"
                  value={r.netWeightValue}
                  onChange={(v) => update(i, { netWeightValue: v })}
                  placeholder="4"
                  inputMode="decimal"
                />
                <div className="space-y-1.5">
                  <Label htmlFor={`unit-${i}`}>Unit</Label>
                  <select
                    id={`unit-${i}`}
                    value={r.netWeightUnit}
                    onChange={(e) => update(i, { netWeightUnit: e.target.value })}
                    className="border-input h-9 w-full rounded-lg border bg-transparent px-2.5 text-sm"
                  >
                    <option value="">—</option>
                    {UNITS.map((u) => (
                      <option key={u} value={u}>
                        {u === "fl_oz" ? "fl oz" : u}
                      </option>
                    ))}
                  </select>
                </div>
                <label className="flex items-end gap-2 pb-2 text-sm sm:col-span-2">
                  <input
                    type="checkbox"
                    checked={r.isActive}
                    onChange={(e) => update(i, { isActive: e.target.checked })}
                  />
                  Buyers can choose this
                </label>
              </div>

              <div className="flex justify-between">
                <p className="text-muted-foreground text-xs">
                  {/* The reason this field is here and not on the product. */}
                  Only the weight differs per option — ingredients and allergens stay on the
                  listing.
                </p>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setRows((prev) => prev.filter((_, j) => j !== i))}
                >
                  Remove
                </Button>
              </div>
            </li>
          ))}
        </ul>
      ) : null}

      {state.error ? <p className="text-destructive text-sm">{state.error}</p> : null}
      {state.ok ? <p className="text-sm font-medium">Options saved.</p> : null}

      <div className="flex items-center gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => setRows((prev) => [...prev, { ...BLANK }])}
        >
          Add an option
        </Button>
        <Submit />
      </div>
    </form>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  inputMode,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  inputMode?: "text" | "decimal" | "numeric";
}) {
  const id = `v-${label.replace(/\s+/g, "-").toLowerCase()}-${placeholder ?? ""}`;
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        value={value}
        inputMode={inputMode}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}
