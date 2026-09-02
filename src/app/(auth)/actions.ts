"use server";

import { redirect } from "next/navigation";
import { z } from "zod";

import { createClient } from "@/lib/supabase/server";
import { env } from "@/lib/env";

export interface AuthState {
  error?: string;
}

const credentials = z.object({
  email: z.string().email("Enter a valid email address."),
  password: z.string().min(8, "Password must be at least 8 characters."),
});

const signUpSchema = credentials.extend({
  displayName: z.string().min(1, "Tell us your name.").max(80),
  role: z.enum(["buyer", "seller"]).default("seller"),
  next: z.string().optional(),
});

export async function signInAction(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const parsed = credentials
    .extend({ next: z.string().optional() })
    .safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({
    email: parsed.data.email,
    password: parsed.data.password,
  });
  if (error) return { error: error.message };

  redirect(safeNext(parsed.data.next));
}

export async function signUpAction(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const parsed = signUpSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }
  const { email, password, displayName, role, next } = parsed.data;

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { display_name: displayName, role },
      emailRedirectTo: `${env.NEXT_PUBLIC_SITE_URL}/auth/confirm`,
    },
  });
  if (error) return { error: error.message };

  // When email confirmation is enabled there is no session yet.
  if (!data.session) {
    redirect("/login?checkEmail=1");
  }

  redirect(safeNext(next, role === "seller" ? "/seller" : "/"));
}

function safeNext(next: string | undefined, fallback = "/seller"): string {
  if (next && next.startsWith("/") && !next.startsWith("//")) return next;
  return fallback;
}
