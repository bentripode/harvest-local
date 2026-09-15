"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { getUser, requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { queueNotification } from "@/lib/notifications/queue";
import { RATE_LIMITS, tryRateLimit } from "@/lib/rate-limit";

/**
 * Posts and questions.
 *
 * Asking is a public write path, so it is rate-limited per CLAUDE.md — and unlike the market
 * waitlist it requires an account, because an answered question is published under a name.
 */

export interface StorefrontFormState {
  error?: string;
  ok?: boolean;
  needsAccount?: boolean;
}

// --- posts -----------------------------------------------------------------

const postSchema = z.object({
  body: z.string().trim().min(1, "Say something.").max(1000),
  imagePath: z.string().trim().max(300).optional().or(z.literal("")),
  imageUrl: z.string().trim().url().max(600).optional().or(z.literal("")),
});

export async function createPostAction(
  _prev: StorefrontFormState,
  formData: FormData,
): Promise<StorefrontFormState> {
  const { user } = await requireRole("seller");

  const parsed = postSchema.safeParse({
    body: formData.get("body"),
    imagePath: formData.get("imagePath") ?? "",
    imageUrl: formData.get("imageUrl") ?? "",
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Check the form." };

  const supabase = await createClient();
  const { data: seller } = await supabase
    .from("seller_profiles")
    .select("id, storefront_slug")
    .eq("profile_id", user.id)
    .maybeSingle();
  if (!seller) return { error: "Set up your storefront first." };

  const { error } = await supabase.from("seller_posts").insert({
    seller_id: seller.id,
    body: parsed.data.body,
    image_path: parsed.data.imagePath || null,
    image_url: parsed.data.imageUrl || null,
  });
  if (error) return { error: error.message };

  revalidatePath(`/s/${seller.storefront_slug}`);
  revalidatePath("/seller");
  return { ok: true };
}

export async function deletePostAction(
  _prev: StorefrontFormState,
  formData: FormData,
): Promise<StorefrontFormState> {
  const { user } = await requireRole("seller");
  const id = z.string().uuid().safeParse(formData.get("id"));
  if (!id.success) return { error: "We couldn't find that post." };

  const supabase = await createClient();
  const { data: seller } = await supabase
    .from("seller_profiles")
    .select("id, storefront_slug")
    .eq("profile_id", user.id)
    .maybeSingle();
  if (!seller) return { error: "Set up your storefront first." };

  const { error } = await supabase
    .from("seller_posts")
    .delete()
    .eq("id", id.data)
    .eq("seller_id", seller.id);
  if (error) return { error: error.message };

  revalidatePath(`/s/${seller.storefront_slug}`);
  revalidatePath("/seller");
  return { ok: true };
}

// --- questions -------------------------------------------------------------

const askSchema = z.object({
  sellerId: z.string().uuid(),
  productId: z.string().uuid().optional().or(z.literal("")),
  body: z.string().trim().min(5, "Ask a bit more than that.").max(1000),
  slug: z.string().trim().max(120).optional(),
});

export async function askQuestionAction(
  _prev: StorefrontFormState,
  formData: FormData,
): Promise<StorefrontFormState> {
  const parsed = askSchema.safeParse({
    sellerId: formData.get("sellerId"),
    productId: formData.get("productId") ?? "",
    body: formData.get("body"),
    slug: formData.get("slug") ?? undefined,
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Check your question." };

  const user = await getUser();
  if (!user) {
    return {
      needsAccount: true,
      error: "Sign in to ask — your name goes on the question once it's answered.",
    };
  }

  const limited = await tryRateLimit(`ask:${user.id}`, RATE_LIMITS.question, "ask questions");
  if (limited) return { error: limited };

  const supabase = await createClient();
  const { error } = await supabase.from("seller_questions").insert({
    seller_id: parsed.data.sellerId,
    product_id: parsed.data.productId || null,
    asker_id: user.id,
    body: parsed.data.body,
  });
  if (error) return { error: "We couldn't post that just now." };

  // The seller has no other way to learn about it — an unanswered question is invisible.
  const admin = createAdminClient();
  const { data: seller } = await admin
    .from("seller_profiles")
    .select("profile_id, business_name")
    .eq("id", parsed.data.sellerId)
    .maybeSingle();
  if (seller?.profile_id) {
    await queueNotification(admin, {
      userId: seller.profile_id,
      template: "question_asked",
      channels: ["in_app", "email"],
      payload: { business_name: seller.business_name },
    });
  }

  if (parsed.data.slug) revalidatePath(`/s/${parsed.data.slug}`);
  return { ok: true };
}

const answerSchema = z.object({
  id: z.string().uuid(),
  answer: z.string().trim().max(2000),
  hide: z.enum(["true", "false"]).optional(),
});

export async function answerQuestionAction(
  _prev: StorefrontFormState,
  formData: FormData,
): Promise<StorefrontFormState> {
  const { user } = await requireRole("seller");

  const parsed = answerSchema.safeParse({
    id: formData.get("id"),
    answer: formData.get("answer") ?? "",
    hide: formData.get("hide") ?? undefined,
  });
  if (!parsed.success) return { error: "Check your answer." };

  const supabase = await createClient();
  const { data: seller } = await supabase
    .from("seller_profiles")
    .select("id, storefront_slug, business_name")
    .eq("profile_id", user.id)
    .maybeSingle();
  if (!seller) return { error: "Set up your storefront first." };

  const hiding = parsed.data.hide === "true";
  if (!hiding && parsed.data.answer.length === 0) {
    return { error: "Write an answer, or hide the question instead." };
  }

  // `seller_questions_answer_status` keeps these two in step at the data layer, so they are always
  // written together.
  const patch = hiding
    ? { status: "hidden" as const, answer: null, answered_at: null }
    : { status: "answered" as const, answer: parsed.data.answer, answered_at: new Date().toISOString() };

  const { data: updated, error } = await supabase
    .from("seller_questions")
    .update(patch)
    .eq("id", parsed.data.id)
    .eq("seller_id", seller.id)
    .select("asker_id")
    .maybeSingle();
  if (error) return { error: error.message };
  if (!updated) return { error: "We couldn't find that question." };

  if (!hiding) {
    const admin = createAdminClient();
    await queueNotification(admin, {
      userId: updated.asker_id,
      template: "question_answered",
      channels: ["in_app", "email"],
      payload: {
        business_name: seller.business_name,
        storefront_slug: seller.storefront_slug,
      },
    });
  }

  revalidatePath(`/s/${seller.storefront_slug}`);
  revalidatePath("/seller");
  return { ok: true };
}
