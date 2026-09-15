"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  savePickupLocationAction,
  deletePickupLocationAction,
  type PickupLocationState,
} from "@/app/(dashboard)/seller/settings/pickup-actions";
import { describePrepTime, summarizeSlots, type PickupSlot } from "@/lib/orders/pickup-schedule";
import { DAY_NAMES } from "@/lib/time/wall-clock";

/**
 * Where buyers collect. A seller works two or three markets plus their own porch, so this is a
 * list, not a field — each entry with its own times, its own notice period and, for a booth, a
 * link to the market it's at.
 */

export interface EditableLocation {
  id: string;
  label: string;
  description: string | null;
  city: string | null;
  postalCode: string | null;
  prepHours: number;
  isActive: boolean;
  market: { id: string; name: string; slug: string; state: string; city: string | null } | null;
  slots: PickupSlot[];
}

interface MarketOption {
  id: string;
  name: string;
  city: string | null;
}

type DraftSlot = {
  mode: "weekly" | "once";
  dayOfWeek: number;
  specificDate: string;
  opens: string;
  closes: string;
  weeksOfMonth: number[];
};

const NEW_SLOT: DraftSlot = {
  mode: "weekly",
  dayOfWeek: 6,
  specificDate: "",
  opens: "09:00",
  closes: "12:00",
  weeksOfMonth: [],
};

function Submit({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="sm" disabled={pending}>
      {pending ? "Saving…" : label}
    </Button>
  );
}

export function PickupLocationsManager({
  locations,
  markets,
  homeState,
}: {
  locations: EditableLocation[];
  markets: MarketOption[];
  homeState: string;
}) {
  const [editing, setEditing] = useState<string | null>(null);

  return (
    <div className="space-y-4">
      <ul className="space-y-3">
        {locations.map((loc) => (
          <li key={loc.id} className="rounded-lg border p-4">
            {editing === loc.id ? (
              <LocationForm
                location={loc}
                markets={markets}
                homeState={homeState}
                onDone={() => setEditing(null)}
              />
            ) : (
              <LocationSummary loc={loc} onEdit={() => setEditing(loc.id)} />
            )}
          </li>
        ))}
      </ul>

      {editing === "new" ? (
        <div className="rounded-lg border p-4">
          <LocationForm
            location={null}
            markets={markets}
            homeState={homeState}
            onDone={() => setEditing(null)}
          />
        </div>
      ) : (
        <Button type="button" variant="outline" size="sm" onClick={() => setEditing("new")}>
          Add a pickup point
        </Button>
      )}
    </div>
  );
}

function LocationSummary({ loc, onEdit }: { loc: EditableLocation; onEdit: () => void }) {
  const [state, action] = useActionState<PickupLocationState, FormData>(
    deletePickupLocationAction,
    {},
  );
  const schedule = summarizeSlots(loc.slots);
  const notice = describePrepTime(loc.prepHours);

  return (
    <div className="space-y-1.5">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="font-medium">
            {loc.label}
            {!loc.isActive ? (
              <span className="text-muted-foreground text-sm font-normal"> · hidden</span>
            ) : null}
          </p>
          <p className="text-muted-foreground text-sm">
            {loc.market ? `${loc.market.name}` : loc.city ? loc.city : "No address"}
            {loc.market?.city ? ` · ${loc.market.city}` : ""}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button type="button" variant="ghost" size="sm" onClick={onEdit}>
            Edit
          </Button>
          <form action={action}>
            <input type="hidden" name="id" value={loc.id} />
            <Button type="submit" variant="ghost" size="sm">
              Remove
            </Button>
          </form>
        </div>
      </div>

      {loc.description ? <p className="text-sm">{loc.description}</p> : null}

      {schedule.length > 0 ? (
        <ul className="text-muted-foreground text-sm">
          {schedule.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
      ) : (
        <p className="text-muted-foreground text-sm">
          No pickup times yet — buyers can&apos;t choose this one until you add some.
        </p>
      )}

      {notice ? <p className="text-muted-foreground text-xs">Needs {notice}</p> : null}
      {state.error ? <p className="text-destructive text-sm">{state.error}</p> : null}
    </div>
  );
}

function LocationForm({
  location,
  markets,
  homeState,
  onDone,
}: {
  location: EditableLocation | null;
  markets: MarketOption[];
  homeState: string;
  onDone: () => void;
}) {
  const [state, action] = useActionState<PickupLocationState, FormData>(
    savePickupLocationAction,
    {},
  );

  const [kind, setKind] = useState<"market" | "address">(location?.market ? "market" : "address");
  const [marketId, setMarketId] = useState(location?.market?.id ?? "");
  const [label, setLabel] = useState(location?.label ?? "");
  const [description, setDescription] = useState(location?.description ?? "");
  const [prepHours, setPrepHours] = useState(String(location?.prepHours ?? 0));
  const [isActive, setIsActive] = useState(location?.isActive ?? true);
  const [slots, setSlots] = useState<DraftSlot[]>(
    (location?.slots ?? []).map((s) => ({
      mode: s.specificDate ? "once" : "weekly",
      dayOfWeek: s.dayOfWeek ?? 6,
      specificDate: s.specificDate ?? "",
      opens: s.opens.slice(0, 5),
      closes: s.closes.slice(0, 5),
      weeksOfMonth: s.weeksOfMonth,
    })),
  );

  // Address fields are only filled when editing an address-backed location; the server re-geocodes.
  const [line1, setLine1] = useState("");
  const [line2, setLine2] = useState("");
  const [city, setCity] = useState(location?.city ?? "");
  const [postal, setPostal] = useState(location?.postalCode ?? "");

  if (state.ok) onDone();

  const payload = JSON.stringify({
    id: location?.id,
    kind,
    marketId: marketId || undefined,
    label,
    description,
    line1,
    line2,
    city,
    state: homeState,
    postal,
    prepHours: Number(prepHours) || 0,
    isActive,
    slots: slots.map((s) => ({
      dayOfWeek: s.mode === "weekly" ? s.dayOfWeek : null,
      specificDate: s.mode === "once" ? s.specificDate || null : null,
      opens: s.opens,
      closes: s.closes,
      weeksOfMonth: s.mode === "weekly" ? s.weeksOfMonth : [],
    })),
  });

  const update = (i: number, patch: Partial<DraftSlot>) =>
    setSlots((prev) => prev.map((s, j) => (j === i ? { ...s, ...patch } : s)));

  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="payload" value={payload} />

      <div className="flex flex-wrap gap-4 text-sm">
        <label className="flex items-center gap-2">
          <input
            type="radio"
            checked={kind === "market"}
            onChange={() => setKind("market")}
            disabled={markets.length === 0}
          />
          A market stall
        </label>
        <label className="flex items-center gap-2">
          <input type="radio" checked={kind === "address"} onChange={() => setKind("address")} />
          Somewhere else
        </label>
      </div>

      {kind === "market" ? (
        <div className="space-y-1.5">
          <Label htmlFor="market">Which market</Label>
          {markets.length === 0 ? (
            <p className="text-muted-foreground text-sm">
              We don&apos;t have any {homeState} markets in the directory yet.
            </p>
          ) : (
            <select
              id="market"
              value={marketId}
              onChange={(e) => setMarketId(e.target.value)}
              className="border-input h-9 w-full rounded-lg border bg-transparent px-2.5 text-sm"
            >
              <option value="">Choose a market</option>
              {markets.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                  {m.city ? ` — ${m.city}` : ""}
                </option>
              ))}
            </select>
          )}
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Street" value={line1} onChange={setLine1} placeholder="12 Orchard Lane" />
          <Field label="Line 2" value={line2} onChange={setLine2} placeholder="Optional" />
          <Field label="Town or city" value={city} onChange={setCity} />
          <Field label="ZIP" value={postal} onChange={setPostal} />
          <p className="text-muted-foreground sm:col-span-2 text-xs">
            Buyers only see the town until they&apos;ve ordered.
          </p>
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-2">
        <Field
          label="What buyers should call it"
          value={label}
          onChange={setLabel}
          placeholder={kind === "market" ? "Saturday market stall" : "Front porch"}
        />
        <Field
          label="Hours of notice you need"
          value={prepHours}
          onChange={setPrepHours}
          type="number"
        />
      </div>

      <Field
        label="How to find you"
        value={description}
        onChange={setDescription}
        placeholder="White tent by the north entrance"
      />

      <div className="space-y-2">
        <p className="text-sm font-medium">When can people collect?</p>
        {slots.length === 0 ? (
          <p className="text-muted-foreground text-sm">
            Add at least one time — buyers can&apos;t pick this place without one.
          </p>
        ) : null}

        <ul className="space-y-2">
          {slots.map((s, i) => (
            <li key={i} className="space-y-2 rounded-md border p-3">
              <div className="flex flex-wrap items-center gap-2 text-sm">
                <select
                  value={s.mode}
                  onChange={(e) => update(i, { mode: e.target.value as DraftSlot["mode"] })}
                  className="border-input h-8 rounded-lg border bg-transparent px-2 text-sm"
                >
                  <option value="weekly">Every week</option>
                  <option value="once">One-off date</option>
                </select>

                {s.mode === "weekly" ? (
                  <select
                    value={s.dayOfWeek}
                    onChange={(e) => update(i, { dayOfWeek: Number(e.target.value) })}
                    className="border-input h-8 rounded-lg border bg-transparent px-2 text-sm"
                  >
                    {DAY_NAMES.map((d, idx) => (
                      <option key={d} value={idx}>
                        {d}
                      </option>
                    ))}
                  </select>
                ) : (
                  <input
                    type="date"
                    value={s.specificDate}
                    onChange={(e) => update(i, { specificDate: e.target.value })}
                    className="border-input h-8 rounded-lg border bg-transparent px-2 text-sm"
                  />
                )}

                <input
                  type="time"
                  value={s.opens}
                  onChange={(e) => update(i, { opens: e.target.value })}
                  className="border-input h-8 rounded-lg border bg-transparent px-2 text-sm"
                />
                <span className="text-muted-foreground">to</span>
                <input
                  type="time"
                  value={s.closes}
                  onChange={(e) => update(i, { closes: e.target.value })}
                  className="border-input h-8 rounded-lg border bg-transparent px-2 text-sm"
                />

                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setSlots((prev) => prev.filter((_, j) => j !== i))}
                >
                  Remove
                </Button>
              </div>

              {s.mode === "weekly" ? (
                <div className="flex flex-wrap items-center gap-3 text-xs">
                  <span className="text-muted-foreground">Only on the</span>
                  {[1, 2, 3, 4, 5].map((w) => (
                    <label key={w} className="flex items-center gap-1">
                      <input
                        type="checkbox"
                        checked={s.weeksOfMonth.includes(w)}
                        onChange={(e) =>
                          update(i, {
                            weeksOfMonth: e.target.checked
                              ? [...s.weeksOfMonth, w].sort((a, b) => a - b)
                              : s.weeksOfMonth.filter((x) => x !== w),
                          })
                        }
                      />
                      {w}
                      {["st", "nd", "rd", "th", "th"][w - 1]}
                    </label>
                  ))}
                  <span className="text-muted-foreground">
                    {s.weeksOfMonth.length === 0 ? "(every week)" : "of the month"}
                  </span>
                </div>
              ) : null}
            </li>
          ))}
        </ul>

        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => setSlots((prev) => [...prev, { ...NEW_SLOT }])}
        >
          Add a time
        </Button>
      </div>

      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={isActive}
          onChange={(e) => setIsActive(e.target.checked)}
        />
        Buyers can choose this pickup point
      </label>

      {state.error ? <p className="text-destructive text-sm">{state.error}</p> : null}

      <div className="flex items-center gap-2">
        <Submit label={location ? "Save changes" : "Add pickup point"} />
        <Button type="button" variant="ghost" size="sm" onClick={onDone}>
          Cancel
        </Button>
      </div>
    </form>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
}) {
  const id = `f-${label.replace(/\s+/g, "-").toLowerCase()}`;
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        type={type}
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}
