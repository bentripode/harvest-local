import "server-only";

import { createClient } from "@/lib/supabase/server";

/**
 * Messaging reads, all RLS-scoped to the signed-in user. A "conversation" is between a buyer and a
 * seller; the current user is one of them. The *other* party's display name is resolved here.
 */

export interface ConversationSummary {
  id: string;
  otherName: string;
  orderRef: string | null;
  lastMessageAt: string | null;
  snippet: string | null;
  unread: number;
}

export interface ThreadMessage {
  id: string;
  body: string;
  senderId: string;
  createdAt: string;
  readAt: string | null;
}

export interface ConversationHeader {
  id: string;
  otherName: string;
  orderId: string | null;
  orderRef: string | null;
}

/** The seller_profile ids the current user owns (usually 0 or 1). */
async function mySellerIds(userId: string): Promise<string[]> {
  const supabase = await createClient();
  const { data } = await supabase.from("seller_profiles").select("id").eq("profile_id", userId);
  return (data ?? []).map((s) => s.id);
}

export async function getConversations(userId: string): Promise<ConversationSummary[]> {
  const supabase = await createClient();
  const sellerIds = await mySellerIds(userId);

  const { data: convos } = await supabase
    .from("conversations")
    .select(
      "id, buyer_id, seller_id, order_id, last_message_at, buyer:profiles!conversations_buyer_id_fkey(display_name), seller:seller_profiles!conversations_seller_id_fkey(business_name)",
    )
    .order("last_message_at", { ascending: false, nullsFirst: false });

  const list = convos ?? [];
  if (list.length === 0) return [];

  const ids = list.map((c) => c.id);
  const { data: msgs } = await supabase
    .from("messages")
    .select("conversation_id, body, sender_id, read_at, created_at")
    .in("conversation_id", ids)
    .order("created_at", { ascending: false });

  const lastByConvo = new Map<string, { body: string }>();
  const unreadByConvo = new Map<string, number>();
  for (const m of msgs ?? []) {
    if (!lastByConvo.has(m.conversation_id)) lastByConvo.set(m.conversation_id, { body: m.body });
    if (!m.read_at && m.sender_id !== userId) {
      unreadByConvo.set(m.conversation_id, (unreadByConvo.get(m.conversation_id) ?? 0) + 1);
    }
  }

  return list.map((c) => {
    const iAmBuyer = c.buyer_id === userId || !sellerIds.includes(c.seller_id);
    const otherName = iAmBuyer
      ? (c.seller as { business_name?: string } | null)?.business_name ?? "Seller"
      : (c.buyer as { display_name?: string } | null)?.display_name ?? "Buyer";
    return {
      id: c.id,
      otherName,
      orderRef: c.order_id ? c.order_id.slice(0, 8) : null,
      lastMessageAt: c.last_message_at,
      snippet: lastByConvo.get(c.id)?.body ?? null,
      unread: unreadByConvo.get(c.id) ?? 0,
    };
  });
}

export async function getConversation(
  conversationId: string,
  userId: string,
): Promise<ConversationHeader | null> {
  const supabase = await createClient();
  const sellerIds = await mySellerIds(userId);

  const { data: c } = await supabase
    .from("conversations")
    .select(
      "id, buyer_id, seller_id, order_id, buyer:profiles!conversations_buyer_id_fkey(display_name), seller:seller_profiles!conversations_seller_id_fkey(business_name)",
    )
    .eq("id", conversationId)
    .maybeSingle();
  if (!c) return null;

  const iAmBuyer = c.buyer_id === userId || !sellerIds.includes(c.seller_id);
  const otherName = iAmBuyer
    ? (c.seller as { business_name?: string } | null)?.business_name ?? "Seller"
    : (c.buyer as { display_name?: string } | null)?.display_name ?? "Buyer";

  return {
    id: c.id,
    otherName,
    orderId: c.order_id,
    orderRef: c.order_id ? c.order_id.slice(0, 8) : null,
  };
}

export async function getMessages(
  conversationId: string,
  limit = 100,
): Promise<ThreadMessage[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("messages")
    .select("id, body, sender_id, created_at, read_at")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: true })
    .limit(limit);
  return (data ?? []).map((m) => ({
    id: m.id,
    body: m.body,
    senderId: m.sender_id,
    createdAt: m.created_at,
    readAt: m.read_at,
  }));
}

export async function getUnreadMessageCount(userId: string): Promise<number> {
  const supabase = await createClient();
  const { count } = await supabase
    .from("messages")
    .select("id", { count: "exact", head: true })
    .is("read_at", null)
    .neq("sender_id", userId);
  return count ?? 0;
}
