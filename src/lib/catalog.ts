import "server-only";

import { createClient } from "@/lib/supabase/server";
import type { Category, Tag } from "@/lib/db/types";

export async function getCategories(): Promise<Category[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("categories")
    .select("*")
    .order("sort_order", { ascending: true })
    .order("name", { ascending: true });
  return data ?? [];
}

export async function getTags(): Promise<Tag[]> {
  const supabase = await createClient();
  const { data } = await supabase.from("tags").select("*").order("name", { ascending: true });
  return data ?? [];
}
