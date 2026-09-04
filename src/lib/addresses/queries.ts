import "server-only";

import { createClient } from "@/lib/supabase/server";

export interface SavedAddress {
  id: string;
  label: string | null;
  line1: string;
  line2: string | null;
  city: string;
  state: string;
  postal: string;
}

/** The signed-in user's saved addresses, newest first. RLS ("addresses: owner all") scopes it. */
export async function getMyAddresses(): Promise<SavedAddress[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("addresses")
    .select("id, label, line1, line2, city, state, postal_code, created_at")
    .order("created_at", { ascending: false });

  return (data ?? []).map((a) => ({
    id: a.id,
    label: a.label,
    line1: a.line1,
    line2: a.line2,
    city: a.city,
    state: a.state,
    postal: a.postal_code,
  }));
}
