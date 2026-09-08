"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { getUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { US_STATES } from "@/lib/geo/state";
import { BROWSE_STATE_COOKIE, COOKIE_OPTIONS } from "@/lib/geo/browse-state";

export interface StateFormState {
  error?: string;
}

/**
 * Set the state whose sellers you are browsing.
 *
 * Deliberately open to signed-out visitors — discovery is public, and the cookie this writes is
 * only ever read to decide what to *display* (`getBrowseState`). For a signed-in buyer it also
 * writes `profiles.home_state`, because that column is the one checkout actually enforces
 * against; keeping both in step means the shelf a buyer browses and the sellers they may order
 * from are the same set.
 */
export async function setBrowseStateAction(
  _prev: StateFormState,
  formData: FormData,
): Promise<StateFormState> {
  const parsed = z.enum(US_STATES).safeParse(formData.get("state"));
  if (!parsed.success) return { error: "Choose your state." };
  const state = parsed.data;

  const user = await getUser();
  if (user) {
    const supabase = await createClient();
    const { error } = await supabase
      .from("profiles")
      .update({ home_state: state })
      .eq("id", user.id);
    if (error) return { error: error.message };
  }

  (await cookies()).set(BROWSE_STATE_COOKIE, state, COOKIE_OPTIONS);

  revalidatePath("/shop");
  revalidatePath("/checkout");
  return {};
}
