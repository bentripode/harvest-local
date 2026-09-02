"use client";

import { useCallback, useMemo, useSyncExternalStore } from "react";

/**
 * A single-seller basket kept in `localStorage`, exposed through `useSyncExternalStore` so there
 * are no mount effects. Every money value here is display-only — the checkout server action
 * re-prices from the database and never trusts these numbers (CLAUDE.md rule 3). Adding a product
 * from a different seller replaces the basket.
 */

const STORAGE_KEY = "harvest.cart.v1";

export interface CartItem {
  productId: string;
  title: string;
  unitPrice: number; // cents — display only
  quantity: number;
}

export interface Cart {
  sellerId: string;
  sellerSlug: string;
  sellerName: string;
  items: CartItem[];
}

// --- module-level store -----------------------------------------------------

type Listener = () => void;
let listeners: Listener[] = [];
let snapshot: Cart | null = null;
let loaded = false;

function parse(raw: string | null): Cart | null {
  if (!raw) return null;
  try {
    const c = JSON.parse(raw) as Cart;
    return c?.sellerId && Array.isArray(c.items) ? c : null;
  } catch {
    return null;
  }
}

function ensureLoaded() {
  if (loaded) return;
  loaded = true;
  try {
    snapshot = parse(window.localStorage.getItem(STORAGE_KEY));
  } catch {
    snapshot = null;
  }
}

function persist(next: Cart | null) {
  snapshot = next && next.items.length > 0 ? next : null;
  loaded = true;
  try {
    if (snapshot) window.localStorage.setItem(STORAGE_KEY, JSON.stringify(snapshot));
    else window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    // private mode / storage disabled — basket just won't survive a reload
  }
  for (const l of listeners) l();
}

function subscribe(listener: Listener): () => void {
  listeners.push(listener);
  const onStorage = (e: StorageEvent) => {
    if (e.key === STORAGE_KEY) {
      snapshot = parse(e.newValue);
      loaded = true;
      listener();
    }
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners = listeners.filter((l) => l !== listener);
    window.removeEventListener("storage", onStorage);
  };
}

function getSnapshot(): Cart | null {
  ensureLoaded();
  return snapshot;
}

function getServerSnapshot(): Cart | null {
  return null;
}

// --- hook ------------------------------------------------------------------

export interface UseCart {
  cart: Cart | null;
  ready: boolean;
  itemCount: number;
  subtotal: number;
  addItem: (
    seller: { sellerId: string; sellerSlug: string; sellerName: string },
    item: CartItem,
  ) => { replaced: boolean };
  setQuantity: (productId: string, quantity: number) => void;
  removeItem: (productId: string) => void;
  clear: () => void;
}

export function useCart(): UseCart {
  const cart = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  const addItem = useCallback<UseCart["addItem"]>((seller, item) => {
    const current = snapshot;
    const replaced = !!current && current.sellerId !== seller.sellerId;
    const items = replaced || !current ? [] : [...current.items];
    const idx = items.findIndex((i) => i.productId === item.productId);
    if (idx >= 0) items[idx] = { ...items[idx], quantity: items[idx].quantity + item.quantity };
    else items.push(item);
    persist({
      sellerId: seller.sellerId,
      sellerSlug: seller.sellerSlug,
      sellerName: seller.sellerName,
      items,
    });
    return { replaced };
  }, []);

  const setQuantity = useCallback<UseCart["setQuantity"]>((productId, quantity) => {
    if (!snapshot) return;
    const items = snapshot.items
      .map((i) => (i.productId === productId ? { ...i, quantity } : i))
      .filter((i) => i.quantity > 0);
    persist(items.length > 0 ? { ...snapshot, items } : null);
  }, []);

  const removeItem = useCallback<UseCart["removeItem"]>(
    (productId) => setQuantity(productId, 0),
    [setQuantity],
  );

  const clear = useCallback<UseCart["clear"]>(() => persist(null), []);

  return useMemo<UseCart>(() => {
    const items = cart?.items ?? [];
    return {
      cart,
      ready: loaded,
      itemCount: items.reduce((n, i) => n + i.quantity, 0),
      subtotal: items.reduce((sum, i) => sum + i.unitPrice * i.quantity, 0),
      addItem,
      setQuantity,
      removeItem,
      clear,
    };
  }, [cart, addItem, setQuantity, removeItem, clear]);
}

/** Kept for symmetry with the route layout; the store is module-level so this is a passthrough. */
export function CartProvider({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
