"use client";

import { useRef, useState } from "react";

import { Button } from "@/components/ui/button";

/**
 * One QR, with the two things a seller actually needs: the code big enough to check by eye, and a
 * way to get it out of the browser and onto a sign.
 *
 * The SVG is generated on the server and inlined here, so download is just a blob — no round trip
 * and nothing to go wrong offline. The PNG is drawn from that same SVG at print resolution, for
 * the print shops that will not take vector.
 */
export function QrCard({
  label,
  url,
  svg,
  businessName,
}: {
  label: string;
  url: string;
  svg: string;
  businessName: string;
}) {
  const holder = useRef<HTMLDivElement | null>(null);
  const [busy, setBusy] = useState(false);

  const fileBase = `${businessName} ${label}`
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  function save(blob: Blob, ext: string) {
    const href = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = href;
    a.download = `${fileBase}.${ext}`;
    a.click();
    URL.revokeObjectURL(href);
  }

  function downloadSvg() {
    save(new Blob([svg], { type: "image/svg+xml" }), "svg");
  }

  /** 2048px square — big enough for an A4 sign at print resolution. */
  async function downloadPng() {
    setBusy(true);
    try {
      const size = 2048;
      const img = new Image();
      const source = URL.createObjectURL(new Blob([svg], { type: "image/svg+xml" }));
      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve();
        img.onerror = () => reject(new Error("render failed"));
        img.src = source;
      });

      const canvas = document.createElement("canvas");
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext("2d");
      if (ctx) {
        // The SVG's own quiet zone is white; fill anyway so a transparent PNG never lands on a
        // dark background and stops scanning.
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, size, size);
        ctx.drawImage(img, 0, 0, size, size);
      }
      URL.revokeObjectURL(source);

      const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png"));
      if (blob) save(blob, "png");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-3 rounded-lg border p-4">
      <div>
        <p className="font-medium">{label}</p>
        <p className="text-muted-foreground text-xs break-all">{url}</p>
      </div>

      <div
        ref={holder}
        className="mx-auto w-44 [&_svg]:h-auto [&_svg]:w-full"
        // Server-generated from the `qrcode` package, never from user input.
        dangerouslySetInnerHTML={{ __html: svg }}
      />

      <div className="flex flex-wrap justify-center gap-2 print:hidden">
        <Button type="button" size="sm" variant="outline" onClick={downloadSvg}>
          SVG
        </Button>
        <Button type="button" size="sm" variant="outline" onClick={downloadPng} disabled={busy}>
          {busy ? "Rendering…" : "PNG"}
        </Button>
      </div>
    </div>
  );
}
