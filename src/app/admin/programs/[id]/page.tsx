import Link from "next/link";
import { notFound } from "next/navigation";

import { Badge } from "@/components/ui/badge";
import { ProgramReviewForm } from "@/components/program-review-form";
import { createClient } from "@/lib/supabase/server";
import { stateName } from "@/lib/geo/state";
import type { StateFoodProgram } from "@/lib/compliance/programs";

export const metadata = { title: "Review program — Admin" };

/**
 * Reviewing one program against the state's own rules.
 *
 * The source link is put in front of the admin deliberately: the job here is to compare our copy
 * with the state's actual guidance, not to tidy up what we already have.
 */
export default async function ReviewProgramPage({ params }: PageProps<"/admin/programs/[id]">) {
  const { id } = await params;
  const supabase = await createClient();

  const { data } = await supabase.from("state_food_programs").select("*").eq("id", id).maybeSingle();
  if (!data) notFound();
  const program = data as StateFoodProgram;

  const checked = program.source_checked_at
    ? new Date(program.source_checked_at).toLocaleDateString(undefined, { dateStyle: "medium" })
    : null;

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Link href="/admin/programs" className="text-muted-foreground text-sm hover:underline">
          ← All programs
        </Link>
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-2xl font-semibold tracking-tight">{program.name}</h1>
          <span className="text-muted-foreground font-mono text-sm">{program.state_code}</span>
          {program.verified_at ? (
            <Badge variant="default">
              verified{" "}
              {new Date(program.verified_at).toLocaleDateString(undefined, { dateStyle: "medium" })}
            </Badge>
          ) : (
            <Badge variant="destructive">never verified</Badge>
          )}
        </div>
        <p className="text-muted-foreground text-sm">
          {stateName(program.state_code)}. These values decide whether a seller here may list food,
          what they may sell, when their storefront pauses, and what their label says.
        </p>
      </div>

      <div className="rounded-lg border p-4 text-sm">
        <p className="font-medium">Check this against the state, not against us</p>
        <p className="text-muted-foreground mt-1">
          Seeded from{" "}
          <a
            href={program.source_url}
            target="_blank"
            rel="noreferrer noopener"
            className="text-primary underline"
          >
            the source
          </a>
          {checked ? ` on ${checked}` : ""} — a summary of the law, not the statutes. Open{" "}
          {stateName(program.state_code)}&apos;s own guidance alongside this form. Known weak spots
          in the seed: entries that quote pandemic-era rules, paraphrased rather than quoted
          disclaimers, and states whose labelling section is missing entirely.
        </p>
      </div>

      <ProgramReviewForm program={program} />
    </div>
  );
}
