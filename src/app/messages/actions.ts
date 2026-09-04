"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { RATE_LIMITS, tryRateLimit } from "@/lib/rate-limit";

export interface SentMessage {
  id: string;
  body: string;
  senderId: string;
  createdAt: string;
  readAt: string | null;
}

export interface SendState {
  error?: string;
  sent?: SentMessage;
}

/** Open (or reuse) a thread with a seller — general, or scoped to an order — then go to it. */
export async function startConversationAction(formData: FormData): Promise<void> {
  const { user } = await requireUser("/messages");

  if (await tryRateLimit(`conversation:${user.id}`, RATE_LIMITS.conversation)) {
    redirect("/messages");
  }

  const parsed = z
    .object({
      sellerId: z.string().uuid().optional(),
      orderId: z.string().uuid().optional(),
    })
    .safeParse({
      sellerId: formData.get("sellerId") || undefined,
      orderId: formData.get("orderId") || undefined,
    });
  if (!parsed.success || (!parsed.data.sellerId && !parsed.data.orderId)) {
    redirect("/messages");
  }

  const supabase = await createClient();
  const { data: conversationId, error } = await supabase.rpc("get_or_create_conversation", {
    p_seller_id: parsed.data.sellerId ?? "00000000-0000-0000-0000-000000000000",
    p_order_id: parsed.data.orderId ?? undefined,
  });
  if (error || !conversationId) {
    console.error("[messages] get_or_create_conversation:", error?.message);
    redirect("/messages");
  }

  redirect(`/messages/${conversationId}`);
}

export async function sendMessageAction(
  _prev: SendState,
  formData: FormData,
): Promise<SendState> {
  const { user } = await requireUser("/messages");

  const limited = await tryRateLimit(`message:${user.id}`, RATE_LIMITS.message, "send messages");
  if (limited) return { error: limited };

  const parsed = z
    .object({
      conversationId: z.string().uuid(),
      body: z.string().trim().min(1, "Type a message.").max(4000),
    })
    .safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid message." };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("messages")
    .insert({
      conversation_id: parsed.data.conversationId,
      sender_id: user.id,
      body: parsed.data.body,
    })
    .select("id, body, sender_id, created_at, read_at")
    .single();
  if (error || !data) {
    return {
      error: /row-level security|violates/i.test(error?.message ?? "")
        ? "You're not part of this conversation."
        : error?.message ?? "Could not send.",
    };
  }

  revalidatePath("/messages");
  return {
    sent: {
      id: data.id,
      body: data.body,
      senderId: data.sender_id,
      createdAt: data.created_at,
      readAt: data.read_at,
    },
  };
}

export async function markConversationReadAction(conversationId: string): Promise<void> {
  await requireUser("/messages");
  const supabase = await createClient();
  await supabase.rpc("mark_conversation_read", { p_conversation_id: conversationId });
  revalidatePath("/messages");
}
