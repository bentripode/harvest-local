"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { getUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

/**
 * Follow and unfollow.
 *
 * Requires an account, and says so rather than silently doing nothing: a follow is a promise to
 * email someone, so there has to be someone to email. Guests get pointed at sign-in — and on a
 * market page they still have the address-free waitlist from 20260908220000.
 *
 * RLS is the gate on the write itself ("follows: owner follows" checks `profile_id = auth.uid()`),
 * so the id is never taken from the form.
 */

export interface FollowState {
  error?: string;
  following?: boolean;
  needsAccount?: boolean;
}

const schema = z.object({
  target: z.enum(["seller", "market", "product"]),
  id: z.string().uuid(),
  /** Where to revalidate afterwards, so the count on the page the user is looking at is right. */
  path: z.string().startsWith("/").max(200).optional(),
});

export async function toggleFollowAction(
  _prev: FollowState,
  formData: FormData,
): Promise<FollowState> {
  const parsed = schema.safeParse({
    target: formData.get("target"),
    id: formData.get("id"),
    path: formData.get("path") ?? undefined,
  });
  if (!parsed.success) return { error: "We couldn't save that." };

  const user = await getUser();
  if (!user) {
    return {
      needsAccount: true,
      error: "Sign in to follow this and get an email when there's something new.",
    };
  }

  const supabase = await createClient();
  const { target, id, path } = parsed.data;

  const { data: existing } = await supabase
    .from("follows")
    .select("id")
    .eq("target_type", target)
    .eq("target_id", id)
    .maybeSingle();

  if (existing) {
    const { error } = await supabase.from("follows").delete().eq("id", existing.id);
    if (error) return { error: "We couldn't unfollow that just now." };
    if (path) revalidatePath(path);
    return { following: false };
  }

  const { error } = await supabase
    .from("follows")
    .insert({ profile_id: user.id, target_type: target, target_id: id });
  // 23505 = already following, which is the state they asked for.
  if (error && error.code !== "23505") {
    return { error: "We couldn't follow that just now." };
  }

  if (path) revalidatePath(path);
  return { following: true };
}
