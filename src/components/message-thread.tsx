"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";
import { sendMessageAction, markConversationReadAction } from "@/app/messages/actions";

interface ThreadMessage {
  id: string;
  body: string;
  senderId: string;
  createdAt: string;
  readAt: string | null;
}

export function MessageThread({
  conversationId,
  currentUserId,
  initialMessages,
}: {
  conversationId: string;
  currentUserId: string;
  initialMessages: ThreadMessage[];
}) {
  const [messages, setMessages] = useState<ThreadMessage[]>(initialMessages);
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const messagesRef = useRef(messages);
  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  const append = useCallback(
    (m: ThreadMessage, fromOther: boolean) => {
      setMessages((prev) => (prev.some((x) => x.id === m.id) ? prev : [...prev, m]));
      if (fromOther && !document.hidden) void markConversationReadAction(conversationId);
    },
    [conversationId],
  );

  // Live updates. Supabase Realtime (Postgres Changes) is the fast path when the project has it
  // enabled; a 4s visible-tab poll is the reliable fallback. Both feed `append`, which dedupes.
  useEffect(() => {
    const supabase = createClient();

    const channel = supabase
      .channel(`conv:${conversationId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
          filter: `conversation_id=eq.${conversationId}`,
        },
        (payload) => {
          const m = payload.new as Record<string, string | null>;
          append(
            {
              id: m.id as string,
              body: m.body as string,
              senderId: m.sender_id as string,
              createdAt: m.created_at as string,
              readAt: m.read_at,
            },
            m.sender_id !== currentUserId,
          );
        },
      )
      .subscribe();

    let stopped = false;
    async function poll() {
      if (stopped || document.hidden) return;
      const since = messagesRef.current.at(-1)?.createdAt;
      let q = supabase
        .from("messages")
        .select("id, body, sender_id, created_at, read_at")
        .eq("conversation_id", conversationId)
        .order("created_at", { ascending: true });
      if (since) q = q.gte("created_at", since);
      const { data } = await q;
      for (const m of data ?? []) {
        append(
          {
            id: m.id,
            body: m.body,
            senderId: m.sender_id,
            createdAt: m.created_at,
            readAt: m.read_at,
          },
          m.sender_id !== currentUserId,
        );
      }
    }
    const interval = setInterval(poll, 4000);

    return () => {
      stopped = true;
      clearInterval(interval);
      void supabase.removeChannel(channel);
    };
  }, [conversationId, currentUserId, append]);

  // Mark the other party's messages read on open.
  useEffect(() => {
    void markConversationReadAction(conversationId);
  }, [conversationId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const fd = new FormData(form);
    if (!String(fd.get("body") ?? "").trim()) return;

    setSending(true);
    setError(null);
    form.reset();
    const res = await sendMessageAction({}, fd);
    setSending(false);
    if (res.error) setError(res.error);
    else if (res.sent) append(res.sent, false);
  }

  return (
    <>
      <div className="flex-1 space-y-2 overflow-y-auto rounded-lg border p-4">
        {messages.length === 0 ? (
          <p className="text-muted-foreground text-sm">No messages yet — say hello.</p>
        ) : (
          messages.map((m) => {
            const mine = m.senderId === currentUserId;
            return (
              <div key={m.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
                <div
                  className={`max-w-[80%] rounded-2xl px-3 py-2 text-sm ${
                    mine ? "bg-primary text-primary-foreground" : "bg-muted"
                  }`}
                >
                  <p className="whitespace-pre-wrap break-words">{m.body}</p>
                  <time
                    dateTime={m.createdAt}
                    className={`mt-0.5 block text-[10px] ${mine ? "text-primary-foreground/70" : "text-muted-foreground"}`}
                  >
                    {new Date(m.createdAt).toLocaleTimeString(undefined, { timeStyle: "short" })}
                  </time>
                </div>
              </div>
            );
          })
        )}
        <div ref={bottomRef} />
      </div>

      <form ref={formRef} onSubmit={handleSubmit} className="flex items-end gap-2 pt-3">
        <input type="hidden" name="conversationId" value={conversationId} />
        <textarea
          name="body"
          rows={1}
          required
          maxLength={4000}
          placeholder="Message…"
          className="border-input bg-background max-h-32 min-h-9 flex-1 resize-none rounded-md border px-3 py-2 text-sm"
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              formRef.current?.requestSubmit();
            }
          }}
        />
        <Button type="submit" size="sm" disabled={sending}>
          {sending ? "…" : "Send"}
        </Button>
      </form>
      {error ? <p className="text-destructive pt-1 text-sm">{error}</p> : null}
    </>
  );
}
