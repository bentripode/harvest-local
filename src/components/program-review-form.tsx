"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  reviewFoodProgramAction,
  type ProgramReviewState,
} from "@/app/admin/programs/actions";
import type { StateFoodProgram } from "@/lib/compliance/programs";

/**
 * Editing one state food program, and marking it checked.
 *
 * Saving stamps `verified_at` with the admin's id — the same "saving is the verification act"
 * contract the state rules editor uses. That is the only way the flag is ever set, so the button
 * says what it does rather than just "Save".
 */
export function ProgramReviewForm({ program }: { program: StateFoodProgram }) {
  const [state, action] = useActionState<ProgramReviewState, FormData>(
    reviewFoodProgramAction,
    {},
  );
  const [capBasis, setCapBasis] = useState(program.cap_basis);

  return (
    <form action={action} className="space-y-8">
      <input type="hidden" name="programId" value={program.id} />

      <Field label="Program name">
        <Input name="name" defaultValue={program.name} required maxLength={200} />
      </Field>

      <Section
        title="Selling online"
        hint="Whether this program can transact through the marketplace at all. A ban here stops food listings."
      >
        <Select
          name="online_orders"
          label="Online orders"
          value={program.online_orders}
          options={["allowed", "banned", "unclear"]}
        />
        <Select
          name="mail_delivery"
          label="Mail delivery"
          value={program.mail_delivery}
          options={["allowed", "banned", "restricted", "unclear"]}
        />
        <Field label="Mail note">
          <Input name="mail_note" defaultValue={program.mail_note ?? ""} maxLength={2000} />
        </Field>
        <Select
          name="direct_delivery"
          label="Delivery to a buyer's address"
          value={program.direct_delivery}
          options={["allowed", "banned", "unclear"]}
        />
        <Field label="Venue note" wide>
          <Input name="venue_note" defaultValue={program.venue_note ?? ""} maxLength={2000} />
        </Field>
        <Check name="retail_allowed" label="May sell to retail outlets" checked={!!program.retail_allowed} />
      </Section>

      <Section title="Sales cap" hint="The basis matters as much as the number.">
        <Select
          name="cap_basis"
          label="Cap basis"
          value={capBasis}
          options={["none", "annual_total", "per_product", "per_category"]}
          onChange={setCapBasis}
        />
        <Field label="Cap amount (USD)">
          <Input
            name="revenue_cap"
            type="number"
            step="0.01"
            min="0"
            defaultValue={program.revenue_cap ?? ""}
            disabled={capBasis === "none"}
          />
        </Field>
        {capBasis === "per_category" ? (
          <Select
            name="cap_category"
            label="Cap applies to"
            value={program.cap_category ?? "acidified"}
            options={[
              "shelf_stable",
              "refrigerated",
              "meat",
              "acidified",
              "low_acid_canned",
              "fermented",
            ]}
          />
        ) : null}
        <Field label="Licence threshold (USD)">
          <Input
            name="license_threshold"
            type="number"
            step="0.01"
            min="0"
            defaultValue={program.license_threshold ?? ""}
          />
        </Field>
        <Field label="Cap note" wide>
          <Input name="cap_note" defaultValue={program.cap_note ?? ""} maxLength={2000} />
        </Field>
      </Section>

      <Section
        title="Foods permitted"
        hint="Only a ban blocks a listing; conditional and list-only are shown to the seller as qualifications."
      >
        <Select
          name="cat_shelf_stable"
          label="Shelf-stable"
          value={program.cat_shelf_stable}
          options={["unrestricted", "list_only", "limited", "conditional", "banned", "unclear"]}
        />
        <Select name="cat_refrigerated" label="Refrigerated baked goods" value={program.cat_refrigerated} options={["allowed", "banned", "conditional", "unclear"]} />
        <Select name="cat_meat" label="Meat" value={program.cat_meat} options={["allowed", "banned", "conditional", "unclear"]} />
        <Select name="cat_acidified" label="Acidified or pickled" value={program.cat_acidified} options={["allowed", "banned", "conditional", "unclear"]} />
        <Select name="cat_low_acid_canned" label="Low-acid canned" value={program.cat_low_acid_canned} options={["allowed", "banned", "conditional", "unclear"]} />
        <Select name="cat_fermented" label="Fermented" value={program.cat_fermented} options={["allowed", "banned", "conditional", "unclear"]} />
        <Field label="Category note" wide>
          <Input name="category_note" defaultValue={program.category_note ?? ""} maxLength={2000} />
        </Field>
      </Section>

      <Section title="What a seller must have" hint="These become the seller's onboarding checklist.">
        <Select name="license_required" label="Licence or registration" value={program.license_required} options={["yes", "no", "conditional", "unclear"]} />
        <Field label="Licence note">
          <Input name="license_note" defaultValue={program.license_note ?? ""} maxLength={2000} />
        </Field>
        <Select name="recipe_approval" label="Recipe approval / lab testing" value={program.recipe_approval} options={["yes", "no", "conditional", "unclear"]} />
        <Field label="Recipe note">
          <Input name="recipe_note" defaultValue={program.recipe_note ?? ""} maxLength={2000} />
        </Field>
        <Select name="training_required" label="Food handler training" value={program.training_required} options={["yes", "no", "conditional", "unclear"]} />
        <Field label="Training note">
          <Input name="training_note" defaultValue={program.training_note ?? ""} maxLength={2000} />
        </Field>
        <Field label="Training course link">
          <Input name="training_url" type="url" defaultValue={program.training_url ?? ""} placeholder="https://" />
        </Field>
        <Field label="Application form link">
          <Input name="application_url" type="url" defaultValue={program.application_url ?? ""} placeholder="https://" />
        </Field>
        <Check name="inspection_required" label="Inspection before starting" checked={!!program.inspection_required} />
        <Check name="local_preemption" label="Local ordinances preempted" checked={!!program.local_preemption} />
      </Section>

      <Section title="Source" hint="Where you checked this. Saving records today as the date it was checked.">
        <Field label="Source URL" wide>
          <Input name="source_url" type="url" defaultValue={program.source_url} required />
        </Field>
        <Field label="Amendment line (paste it verbatim)" wide>
          <Input
            name="source_version"
            defaultValue={program.source_version ?? ""}
            placeholder="Amended by Chapter 433, 2026 General Session"
          />
          <p className="text-muted-foreground mt-1 text-xs">
            The line the publisher prints at the foot of the section. It is the strongest staleness
            signal there is: a later re-read that finds a different session year means the law
            moved, full stop. Vermont&apos;s rule was replaced while its section numbers stayed the
            same — this is what would have caught it.
          </p>
        </Field>
        {program.source_changed_at ? (
          <p className="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
            <strong>This source has moved since it was last read</strong> (
            {new Date(program.source_changed_at).toLocaleDateString(undefined, {
              dateStyle: "medium",
            })}
            {program.source_signal === "content_hash"
              ? " — detected by comparing bytes, since this host sends no ETag, so it may be a re-render rather than an amendment"
              : " — reported by the publisher"}
            ). Re-read it before saving.
          </p>
        ) : null}
      </Section>

      {state.error ? <p className="text-destructive text-sm">{state.error}</p> : null}
      {state.ok ? (
        <p className="text-sm text-green-700">
          Saved and marked verified. The food gates read this row immediately.
        </p>
      ) : null}

      <div className="space-y-2 border-t pt-4">
        <div className="flex flex-wrap items-center gap-3">
          <Submit
            intent="verify"
            label={program.verified_at ? "Save & re-verify" : "Save & mark verified"}
            pendingLabel="Verifying…"
          />
          {/*
            A programme row carries around twenty fields. Without this, correcting one of them meant
            claiming you had checked all twenty — which is how a wrong figure stays wrong.
          */}
          <Submit intent="save" label="Save without verifying" pendingLabel="Saving…" ghost />
        </div>
        <p className="text-muted-foreground text-xs">
          <strong>Save &amp; mark verified</strong> records that <strong>you</strong> checked this
          against {program.state_code}&apos;s own rules — not that you read our copy of them.{" "}
          <strong>Save without verifying</strong> corrects a field you have sourced while leaving the
          rest of the row unchecked
          {program.verified_at
            ? "; it clears the current verification, because that check covered the values as they were."
            : "."}
        </p>
      </div>
    </form>
  );
}

function Submit({
  intent,
  label,
  pendingLabel,
  ghost,
}: {
  intent: "verify" | "save";
  label: string;
  pendingLabel: string;
  ghost?: boolean;
}) {
  // `data` is the FormData in flight, so only the button that was clicked shows its pending label.
  const { pending, data } = useFormStatus();
  const isThisOne = pending && data?.get("intent") === intent;
  return (
    <Button
      type="submit"
      name="intent"
      value={intent}
      variant={ghost ? "outline" : "default"}
      disabled={pending}
    >
      {isThisOne ? pendingLabel : label}
    </Button>
  );
}

function Section({
  title,
  hint,
  children,
}: {
  title: string;
  hint: string;
  children: React.ReactNode;
}) {
  return (
    <fieldset className="space-y-3">
      <legend className="text-sm font-medium">{title}</legend>
      <p className="text-muted-foreground -mt-1 text-xs">{hint}</p>
      <div className="grid gap-3 sm:grid-cols-2">{children}</div>
    </fieldset>
  );
}

function Field({
  label,
  wide,
  children,
}: {
  label: string;
  wide?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className={`space-y-1.5 ${wide ? "sm:col-span-2" : ""}`}>
      <Label>{label}</Label>
      {children}
    </div>
  );
}

function Select({
  name,
  label,
  value,
  options,
  onChange,
}: {
  name: string;
  label: string;
  value: string;
  options: string[];
  onChange?: (v: string) => void;
}) {
  const [current, setCurrent] = useState(value);
  return (
    <div className="space-y-1.5">
      <Label htmlFor={name}>{label}</Label>
      <select
        id={name}
        name={name}
        value={current}
        onChange={(e) => {
          setCurrent(e.target.value);
          onChange?.(e.target.value);
        }}
        className="border-input h-8 w-full rounded-lg border bg-transparent px-2.5 text-sm"
      >
        {options.map((o) => (
          <option key={o} value={o}>
            {o.replace(/_/g, " ")}
          </option>
        ))}
      </select>
    </div>
  );
}

function Check({ name, label, checked }: { name: string; label: string; checked: boolean }) {
  return (
    <label className="flex items-center gap-2 text-sm">
      <input type="checkbox" name={name} value="true" defaultChecked={checked} className="size-4" />
      {label}
    </label>
  );
}
