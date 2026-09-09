import "server-only";

import { env } from "@/lib/env";
import { screenCopy, isSafeToApply, type ClaimFinding } from "@/lib/ai/claims";
import {
  buildPrompt,
  hasEnoughToGenerate,
  NOT_ENOUGH_MESSAGE,
  type CopyKind,
  type CopySource,
} from "@/lib/ai/prompt";
import { stripWrapping } from "@/lib/ai/response";

/**
 * The listing-copy assistant.
 *
 * A direct call to the Messages API, no SDK — the same approach as the Twilio and Mapbox calls
 * elsewhere in this codebase, and one fewer dependency to keep current.
 *
 * Three properties matter more than the copy quality:
 *
 *   1. **It never writes to a product.** This returns a draft. Applying it is a separate act by the
 *      seller, in a form they can edit first. Nothing here has write access to anything.
 *   2. **Every draft is screened before the seller sees it**, and the findings travel with it. A
 *      draft carrying a `block` finding is still returned — with the finding — because "here is
 *      what it wrote and here is what's wrong with it" teaches, where a silent retry does not.
 *   3. **With no key it says so.** It does not fall back to a template, because a template dressed
 *      as generated copy is a worse lie than an honest absence.
 */

export const AI_MODEL = "claude-sonnet-5";

export type GenerateResult =
  | { ok: true; text: string; findings: ClaimFinding[]; safe: boolean }
  | { ok: false; reason: "not_configured" | "not_enough" | "failed" | "empty"; message: string };

const configured = !!env.ANTHROPIC_API_KEY;

export function isAssistantConfigured(): boolean {
  return configured;
}

export async function generateCopy(
  kind: CopyKind,
  source: CopySource,
): Promise<GenerateResult> {
  if (!configured) {
    return {
      ok: false,
      reason: "not_configured",
      message:
        "The writing assistant isn't switched on for this site. Everything else on this page works as normal.",
    };
  }

  if (!hasEnoughToGenerate(source)) {
    return { ok: false, reason: "not_enough", message: NOT_ENOUGH_MESSAGE };
  }

  const prompt = buildPrompt(kind, source);

  let res: Response;
  try {
    res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": env.ANTHROPIC_API_KEY!,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: AI_MODEL,
        max_tokens: kind === "social" ? 300 : 500,
        // Low but not zero: the copy should read like a person, and a seller regenerating wants a
        // different sentence rather than the same one back.
        temperature: 0.6,
        messages: [{ role: "user", content: prompt }],
      }),
      signal: AbortSignal.timeout(30_000),
    });
  } catch (err) {
    console.error("[ai] request failed:", err);
    return { ok: false, reason: "failed", message: "Couldn't reach the writing assistant. Try again in a moment." };
  }

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    console.error("[ai] non-OK response", res.status, body.slice(0, 500));
    return {
      ok: false,
      reason: "failed",
      message:
        res.status === 429
          ? "The writing assistant is busy. Try again in a moment."
          : "The writing assistant didn't answer. Try again in a moment.",
    };
  }

  let text: string;
  try {
    const json = (await res.json()) as { content?: { type: string; text?: string }[] };
    text = (json.content ?? [])
      .filter((b) => b.type === "text")
      .map((b) => b.text ?? "")
      .join("")
      .trim();
  } catch (err) {
    console.error("[ai] unparseable response:", err);
    return { ok: false, reason: "failed", message: "Couldn't read the assistant's answer." };
  }

  // A model asked for "the text only" sometimes wraps it anyway.
  text = stripWrapping(text);
  if (!text) {
    return { ok: false, reason: "empty", message: "The assistant came back empty. Try again." };
  }

  const findings = screenCopy(text);
  return { ok: true, text, findings, safe: isSafeToApply(findings) };
}
