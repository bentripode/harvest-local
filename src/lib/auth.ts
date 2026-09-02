import "server-only";

import { redirect } from "next/navigation";
import type { User } from "@supabase/supabase-js";

import { createClient } from "@/lib/supabase/server";
import type { Profile, Role, SellerProfile, Subscription } from "@/lib/db/types";

export async function getUser(): Promise<User | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
}

export async function getProfile(): Promise<Profile | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data } = await supabase.from("profiles").select("*").eq("id", user.id).single();
  return data;
}

/** Redirects to /login when there is no session. Returns the user + profile otherwise. */
export async function requireUser(nextPath = "/seller"): Promise<{ user: User; profile: Profile }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/login?next=${encodeURIComponent(nextPath)}`);

  const { data: profile } = await supabase.from("profiles").select("*").eq("id", user.id).single();
  if (!profile) redirect("/login");

  return { user, profile };
}

export async function requireRole(role: Role, nextPath = "/seller") {
  const { user, profile } = await requireUser(nextPath);
  if (profile.role !== role && profile.role !== "admin") {
    redirect("/");
  }
  return { user, profile };
}

export interface SellerContext {
  profile: Profile;
  seller: SellerProfile | null;
  subscription: Subscription | null;
  /** Connect KYC done AND a trialing/active subscription exists. */
  onboardingComplete: boolean;
}

export async function getSellerContext(): Promise<SellerContext> {
  const { user, profile } = await requireUser("/seller");
  const supabase = await createClient();

  const { data: seller } = await supabase
    .from("seller_profiles")
    .select("*")
    .eq("profile_id", user.id)
    .maybeSingle();

  let subscription: Subscription | null = null;
  if (seller) {
    const { data } = await supabase
      .from("subscriptions")
      .select("*")
      .eq("seller_id", seller.id)
      .maybeSingle();
    subscription = data;
  }

  const onboardingComplete =
    !!seller &&
    seller.connect_details_submitted &&
    seller.connect_charges_enabled &&
    !!subscription &&
    ["trialing", "active"].includes(subscription.status);

  return { profile, seller, subscription, onboardingComplete };
}

export type AccessMode = "sellers_only" | "public";

export async function getAccessMode(): Promise<AccessMode> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("platform_settings")
    .select("value")
    .eq("key", "access_mode")
    .maybeSingle();

  const mode = (data?.value as { mode?: string } | null)?.mode;
  return mode === "public" ? "public" : "sellers_only";
}
