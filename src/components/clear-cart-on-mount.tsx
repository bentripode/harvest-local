"use client";

import { useEffect } from "react";

import { useCart } from "@/components/cart-provider";

/** Drops the local basket once a checkout has succeeded (rendered on the order page). */
export function ClearCartOnMount() {
  const { clear } = useCart();
  useEffect(() => {
    clear();
  }, [clear]);
  return null;
}
