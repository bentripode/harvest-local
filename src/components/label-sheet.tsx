"use client";

import { useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { canPrint, renderLabel, type LabelRule, type LabelSource } from "@/lib/labels/render";

/**
 * The printable label, and the placard where a state wants one.
 *
 * Production date and lot code are asked for here rather than stored on the product: they are
 * per-batch, and a date printed from a stored value is stale by the next bake.
 *
 * A label is a legal document, so this refuses to print when the state's rule requires a field the
 * seller hasn't filled in — with the missing fields named and where to fix each one — rather than
 * producing something that looks official and isn't.
 */
export function LabelSheet({
  rule,
  source,
  stateName,
  disclaimerFontNote,
}: {
  rule: LabelRule;
  source: LabelSource;
  stateName: string;
  disclaimerFontNote: string | null;
}) {
  const [productionDate, setProductionDate] = useState("");
  const [lotCode, setLotCode] = useState("");
  const [copies, setCopies] = useState(1);

  const rendered = useMemo(
    () => renderLabel(rule, { ...source, productionDate: productionDate || null, lotCode: lotCode || null }),
    [rule, source, productionDate, lotCode],
  );
  const ready = canPrint(rendered);

  return (
    <div className="space-y-6">
      <section className="space-y-4 print:hidden">
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="space-y-2">
            <Label htmlFor="productionDate">Production date</Label>
            <Input
              id="productionDate"
              type="date"
              value={productionDate}
              onChange={(e) => setProductionDate(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="lotCode">Lot or batch code</Label>
            <Input
              id="lotCode"
              value={lotCode}
              onChange={(e) => setLotCode(e.target.value)}
              placeholder="e.g. B-2026-09-04"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="copies">Labels per sheet</Label>
            <Input
              id="copies"
              type="number"
              min="1"
              max="24"
              value={copies}
              onChange={(e) => setCopies(Math.max(1, Math.min(24, Number(e.target.value) || 1)))}
            />
          </div>
        </div>
        <p className="text-muted-foreground text-xs">
          These two are per batch, so they aren&apos;t saved with the product — fill them in each
          time you print.
        </p>
      </section>

      {rendered.ruleUnknown ? (
        <div className="border-destructive/30 bg-destructive/5 rounded-lg border p-4 text-sm print:hidden">
          <p className="text-destructive font-medium">
            We don&apos;t have {stateName}&apos;s labelling rules on file
          </p>
          <p className="text-muted-foreground mt-1">
            Rather than print a label that might be wrong, we&apos;re printing nothing. Check{" "}
            {stateName}&apos;s own guidance for what the label must carry.
            {rendered.notes ? ` ${rendered.notes}` : ""}
          </p>
        </div>
      ) : rendered.missing.length > 0 ? (
        <div className="border-destructive/30 bg-destructive/5 rounded-lg border p-4 text-sm print:hidden">
          <p className="text-destructive font-medium">
            {stateName} requires {rendered.missing.length}{" "}
            {rendered.missing.length === 1 ? "thing" : "things"} you haven&apos;t added yet
          </p>
          <ul className="text-muted-foreground mt-2 space-y-1">
            {rendered.missing.map((m) => (
              <li key={m.element}>
                <span className="font-medium">{m.label}</span> —{" "}
                {m.fix === "product"
                  ? "add it on the product"
                  : m.fix === "profile"
                    ? "add it in your storefront settings"
                    : m.fix === "licence"
                      ? "comes from a verified permit on your compliance page"
                      : "fill it in above"}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="flex flex-wrap items-center gap-3 print:hidden">
        <Button onClick={() => window.print()} disabled={!ready}>
          Print {copies > 1 ? `${copies} labels` : "label"}
        </Button>
        {!ready ? (
          <span className="text-muted-foreground text-sm">
            Printing is off until the label is complete.
          </span>
        ) : null}
      </div>

      {ready ? (
        <>
          <div className="space-y-3">
            <h2 className="text-sm font-medium print:hidden">Preview</h2>
            <div className="label-grid">
              {Array.from({ length: copies }, (_, i) => (
                <LabelCard key={i} rendered={rendered} fontNote={disclaimerFontNote} />
              ))}
            </div>
          </div>

          {rule.placardRequired && rule.placardText ? (
            <div className="space-y-3">
              <h2 className="text-sm font-medium print:hidden">
                Point-of-sale sign — {stateName} requires this displayed as well
              </h2>
              <div className="placard">{rule.placardText}</div>
            </div>
          ) : null}
        </>
      ) : null}

      <style>{`
        .label-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
          gap: 12px;
        }
        .label-card {
          border: 1px solid #999;
          border-radius: 2px;
          padding: 10px 12px;
          background: #fff;
          color: #000;
          font-size: 11px;
          line-height: 1.35;
          break-inside: avoid;
        }
        .label-card .name { font-weight: 700; font-size: 13px; margin-bottom: 4px; }
        .label-card .cap {
          text-transform: uppercase;
          letter-spacing: .04em;
          font-size: 8px;
          color: #444;
        }
        .label-card .row { margin-bottom: 3px; }
        .label-card .disclaimer {
          margin-top: 6px;
          padding-top: 5px;
          border-top: 1px solid #ccc;
        }
        .placard {
          border: 2px solid #000;
          background: #fff;
          color: #000;
          padding: 24px;
          text-align: center;
          font-size: 22px;
          font-weight: 700;
          line-height: 1.3;
          break-inside: avoid;
        }
        @media print {
          @page { margin: 12mm; }
          body * { visibility: hidden; }
          .label-grid, .label-grid *, .placard, .placard * { visibility: visible; }
          .label-grid { position: absolute; left: 0; top: 0; width: 100%; }
        }
      `}</style>
    </div>
  );
}

function LabelCard({
  rendered,
  fontNote,
}: {
  rendered: ReturnType<typeof renderLabel>;
  fontNote: string | null;
}) {
  const disclaimerStyle: React.CSSProperties = {
    // The state names a minimum point size; honour it rather than scaling to fit.
    fontSize: rendered.disclaimerMinPt ? `${rendered.disclaimerMinPt}pt` : "8pt",
    textTransform: rendered.disclaimerAllCaps ? "uppercase" : "none",
    fontFamily: fontNote?.includes("Times") ? "'Times New Roman', Times, serif" : undefined,
  };

  return (
    <div className="label-card">
      {rendered.lines.map((line) => (
        <div key={line.element} className={line.caption ? "row" : "name"}>
          {line.caption ? <div className="cap">{line.caption}</div> : null}
          <div>{line.value}</div>
        </div>
      ))}
      {rendered.disclaimer ? (
        <div className="disclaimer" style={disclaimerStyle}>
          {rendered.disclaimer}
        </div>
      ) : null}
    </div>
  );
}
