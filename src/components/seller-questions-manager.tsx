"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";

import { Button } from "@/components/ui/button";
import { ImageUploader, type UploadedImage } from "@/components/image-uploader";
import {
  answerQuestionAction,
  createPostAction,
  deletePostAction,
  type StorefrontFormState,
} from "@/app/(shop)/storefront/actions";
import type { StorefrontPost, StorefrontQuestion } from "@/lib/storefront/queries";

function Submit({ label, busy }: { label: string; busy: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="sm" disabled={pending}>
      {pending ? busy : label}
    </Button>
  );
}

/**
 * The seller's side of both features.
 *
 * Answering is what publishes a question, so the copy says so — a seller should know that the thing
 * they're replying to is currently private, and that their reply is not.
 */
export function SellerPostComposer({
  posts,
  sellerId,
}: {
  posts: StorefrontPost[];
  sellerId: string;
}) {
  const [state, action] = useActionState<StorefrontFormState, FormData>(createPostAction, {});
  const [body, setBody] = useState("");
  // `createPostAction` has accepted an imagePath since it was written; until the uploader existed
  // there was no UI that could supply one, so every post went out without a photo.
  const [photo, setPhoto] = useState<UploadedImage[]>([]);

  return (
    <div className="space-y-4">
      <form
        action={(fd) => {
          setBody("");
          setPhoto([]);
          return action(fd);
        }}
        className="space-y-2"
      >
        <label htmlFor="post-body" className="text-muted-foreground block text-sm">
          Tell people what&apos;s going on — what&apos;s baking, what&apos;s sold out, when
          you&apos;re back.
        </label>
        <textarea
          id="post-body"
          name="body"
          rows={3}
          maxLength={1000}
          required
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="No bread this Saturday — back on the 14th with the usual."
          className="border-input w-full rounded-md border bg-transparent p-2.5 text-sm"
        />
        <input type="hidden" name="imagePath" value={photo[0]?.path ?? ""} />
        <input type="hidden" name="imageUrl" value={photo[0]?.url ?? ""} />
        <ImageUploader
          sellerId={sellerId}
          kind="post"
          value={photo}
          onChange={setPhoto}
          label="Add a photo"
        />

        <div className="flex items-center gap-3">
          <Submit label="Post it" busy="Posting…" />
          <span className="text-muted-foreground text-xs">{body.length}/1000</span>
          {state.error ? <span className="text-destructive text-sm">{state.error}</span> : null}
        </div>
      </form>

      {posts.length > 0 ? (
        <ul className="divide-y rounded-lg border">
          {posts.map((p) => (
            <li key={p.id} className="flex items-start justify-between gap-3 p-3 text-sm">
              <div>
                <p className="whitespace-pre-line">{p.body}</p>
                <p className="text-muted-foreground pt-1 text-xs">
                  {new Date(p.createdAt).toLocaleDateString("en-US", {
                    month: "long",
                    day: "numeric",
                  })}
                </p>
              </div>
              <DeletePost id={p.id} />
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

function DeletePost({ id }: { id: string }) {
  const [, action] = useActionState<StorefrontFormState, FormData>(deletePostAction, {});
  return (
    <form action={action}>
      <input type="hidden" name="id" value={id} />
      <Button type="submit" variant="ghost" size="sm">
        Delete
      </Button>
    </form>
  );
}

export function SellerQuestionQueue({ questions }: { questions: StorefrontQuestion[] }) {
  const open = questions.filter((q) => q.status === "open");
  const answered = questions.filter((q) => q.status === "answered");

  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <h3 className="text-sm font-medium">
          Waiting on you {open.length > 0 ? `(${open.length})` : ""}
        </h3>
        {open.length === 0 ? (
          <p className="text-muted-foreground text-sm">Nothing waiting.</p>
        ) : (
          <ul className="space-y-3">
            {open.map((q) => (
              <li key={q.id} className="rounded-lg border p-4">
                <AnswerForm question={q} />
              </li>
            ))}
          </ul>
        )}
      </div>

      {answered.length > 0 ? (
        <div className="space-y-3">
          <h3 className="text-sm font-medium">Answered — these are public</h3>
          <ul className="divide-y rounded-lg border">
            {answered.map((q) => (
              <li key={q.id} className="space-y-1 p-3 text-sm">
                <p className="font-medium">{q.body}</p>
                <p className="text-muted-foreground">{q.answer}</p>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}

function AnswerForm({ question }: { question: StorefrontQuestion }) {
  const [state, action] = useActionState<StorefrontFormState, FormData>(answerQuestionAction, {});

  return (
    <form action={action} className="space-y-2">
      <input type="hidden" name="id" value={question.id} />
      <p className="text-sm font-medium">{question.body}</p>
      <p className="text-muted-foreground text-xs">
        Asked by {question.askerName} · only you can see this until you answer.
      </p>
      <textarea
        name="answer"
        rows={3}
        maxLength={2000}
        placeholder="Yes — it's flour, water, salt and starter, nothing else."
        className="border-input w-full rounded-md border bg-transparent p-2.5 text-sm"
      />
      <div className="flex flex-wrap items-center gap-2">
        <Submit label="Answer publicly" busy="Posting…" />
        <Button type="submit" name="hide" value="true" variant="ghost" size="sm">
          Hide instead
        </Button>
        {state.error ? <span className="text-destructive text-sm">{state.error}</span> : null}
      </div>
    </form>
  );
}
