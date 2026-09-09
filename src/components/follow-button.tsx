"use client";

import { useActionState, useOptimistic, startTransition } from "react";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { toggleFollowAction, type FollowState } from "@/app/(shop)/follows/actions";
import type { FollowTarget } from "@/lib/follows/queries";

/**
 * Follow a seller, a market or a product.
 *
 * The count beside it is public; who is behind it is not (see `follower_counts` in the migration).
 * A guest gets a sign-in prompt rather than a dead button — a follow is a promise to email someone,
 * so there has to be an account to email.
 */
export function FollowButton({
  target,
  id,
  following,
  count,
  path,
  label = "Follow",
  followingLabel = "Following",
  size = "sm",
}: {
  target: FollowTarget;
  id: string;
  following: boolean;
  count?: number;
  path?: string;
  label?: string;
  followingLabel?: string;
  size?: "sm" | "default";
}) {
  const [state, action, pending] = useActionState<FollowState, FormData>(toggleFollowAction, {
    following,
  });

  // The server is authoritative once it answers; until then the button reflects the click, because
  // a follow that appears to do nothing for a second reads as broken.
  const [optimistic, setOptimistic] = useOptimistic(
    state.following ?? following,
    (_prev: boolean, next: boolean) => next,
  );

  const isFollowing = optimistic;
  const shown = (count ?? 0) + (isFollowing === following ? 0 : isFollowing ? 1 : -1);

  return (
    <div className="space-y-1">
      <form
        action={(formData) => {
          startTransition(() => setOptimistic(!isFollowing));
          return action(formData);
        }}
        className="flex items-center gap-2"
      >
        <input type="hidden" name="target" value={target} />
        <input type="hidden" name="id" value={id} />
        {path ? <input type="hidden" name="path" value={path} /> : null}
        <Button
          type="submit"
          size={size}
          variant={isFollowing ? "outline" : "default"}
          disabled={pending}
        >
          {isFollowing ? followingLabel : label}
        </Button>
        {count != null ? (
          <span className="text-muted-foreground text-sm tabular-nums">
            {shown} following
          </span>
        ) : null}
      </form>

      {state.needsAccount ? (
        <p className="text-muted-foreground text-sm">
          <Link href="/login" className="underline">
            Sign in
          </Link>{" "}
          to follow and get an email when there&apos;s something new.
        </p>
      ) : state.error ? (
        <p className="text-destructive text-sm">{state.error}</p>
      ) : null}
    </div>
  );
}
