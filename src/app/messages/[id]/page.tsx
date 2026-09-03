import Link from "next/link";
import { notFound } from "next/navigation";

import { MessageThread } from "@/components/message-thread";
import { requireUser } from "@/lib/auth";
import { getConversation, getMessages } from "@/lib/messages/queries";

export default async function ConversationPage({ params }: PageProps<"/messages/[id]">) {
  const { id } = await params;
  const { user } = await requireUser(`/messages/${id}`);

  const conversation = await getConversation(id, user.id);
  if (!conversation) notFound();

  const messages = await getMessages(id);

  return (
    <div className="flex h-[calc(100vh-9rem)] flex-col">
      <div className="flex items-baseline justify-between gap-3 pb-3">
        <div>
          <Link href="/messages" className="text-muted-foreground text-xs hover:underline">
            ← All messages
          </Link>
          <h1 className="text-lg font-semibold tracking-tight">{conversation.otherName}</h1>
        </div>
        {conversation.orderId ? (
          <Link
            href={`/orders/${conversation.orderId}`}
            className="text-muted-foreground text-sm hover:underline"
          >
            Order {conversation.orderRef} →
          </Link>
        ) : null}
      </div>

      <MessageThread
        conversationId={id}
        currentUserId={user.id}
        initialMessages={messages}
      />
    </div>
  );
}
