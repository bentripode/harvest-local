"use client";

import { useEffect } from "react";

import { recordStorefrontViewAction } from "@/app/(shop)/s/[slug]/actions";

/**
 * Records one storefront view per browser session (sessionStorage dedupe). Rendered only for
 * visitors who don't own the storefront. Renders nothing.
 */
export function TrackStorefrontView({ sellerId }: { sellerId: string }) {
  useEffect(() => {
    const key = `sv:${sellerId}`;
    try {
      if (sessionStorage.getItem(key)) return;
      sessionStorage.setItem(key, "1");
    } catch {
      // sessionStorage blocked — fall through and record once for this mount
    }
    void recordStorefrontViewAction(sellerId);
  }, [sellerId]);

  return null;
}
