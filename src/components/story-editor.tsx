"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { saveStoryAction, type StoryFormState } from "@/app/(dashboard)/seller/story/actions";
import { storyExcerpt } from "@/lib/stories/select";

const MAX = 2000;

function Submit() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="sm" disabled={pending}>
      {pending ? "Saving…" : "Save"}
    </Button>
  );
}

/**
 * Writing the story, with the home-page excerpt shown live.
 *
 * The preview matters more than it looks: what goes on the front page is the first ~240 characters,
 * so a seller who buries the good sentence in paragraph three should be able to see that happening
 * while they write, rather than discovering it on the live site. `storyExcerpt` is the same function
 * the home page uses, so the preview cannot be a flattering approximation of it.
 */
export function StoryEditor({
  initialStory,
  initialOnHome,
  storefrontSlug,
}: {
  initialStory: string;
  initialOnHome: boolean;
  storefrontSlug: string;
}) {
  const [state, action] = useActionState<StoryFormState, FormData>(saveStoryAction, {});
  const [story, setStory] = useState(initialStory);
  const [onHome, setOnHome] = useState(initialOnHome);

  const trimmed = story.trim();
  const excerpt = trimmed ? storyExcerpt(trimmed) : "";
  const shortened = excerpt !== trimmed;

  return (
    <form action={action} className="space-y-5">
      <div className="space-y-2">
        <Label htmlFor="story">Your story</Label>
        <Textarea
          id="story"
          name="story"
          rows={8}
          maxLength={MAX}
          value={story}
          onChange={(e) => setStory(e.target.value)}
          placeholder="I started baking sourdough during a slow winter and never really stopped. Everything comes out of the same kitchen my grandmother cooked in…"
        />
        <p className="text-muted-foreground text-xs tabular-nums">
          {story.length} / {MAX}
        </p>
      </div>

      <label className="flex items-start gap-2 text-sm">
        <input
          type="checkbox"
          name="onHome"
          checked={onHome}
          onChange={(e) => setOnHome(e.target.checked)}
          disabled={!trimmed}
          className="mt-1"
        />
        <span>
          Show this on the Harvest Local home page
          <span className="text-muted-foreground block text-xs">
            Sellers who opt in take turns on the front page — it rotates daily, so it isn&apos;t
            first-come or whoever edited last. Your story shows on{" "}
            <Link href={`/s/${storefrontSlug}`} className="underline underline-offset-2">
              your storefront
            </Link>{" "}
            either way.
          </span>
        </span>
      </label>

      {trimmed && onHome ? (
        <div className="space-y-1 rounded-lg border p-3">
          <p className="text-sm font-medium">On the home page it&apos;ll read:</p>
          <p className="text-muted-foreground text-sm">{excerpt}</p>
          {shortened ? (
            <p className="text-muted-foreground text-xs">
              Shortened to fit the card — the whole thing shows on your storefront. Put the sentence
              you most want read near the start.
            </p>
          ) : null}
        </div>
      ) : null}

      {state.error ? <p className="text-destructive text-sm">{state.error}</p> : null}
      {state.ok ? <p className="text-sm font-medium">Saved.</p> : null}

      <Submit />
    </form>
  );
}
