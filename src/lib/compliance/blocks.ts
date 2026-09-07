import "server-only";

/**
 * A refusal the seller can check for themselves.
 *
 * Every compliance gate in this app used to hand back a sentence we wrote. That is fine when the
 * underlying row is right and useless when it is wrong — and the verification pass found seeded
 * errors in BOTH directions: Washington was seeded as permitting internet sales that RCW
 * 69.22.020(4) forbids, and Hawaii was seeded as banning them on nothing at all, blocking lawful
 * sellers for no reason.
 *
 * `verified_at` is still null on essentially every row in `state_food_programs`. So a block is an
 * assertion by us, not by the state, and the seller is the person with both the strongest incentive
 * to check it and the easiest access to their own regulator. Giving them the words and the source
 * link turns an opaque wall into something that gets corrected.
 */
export interface ComplianceBlock {
  /** The plain-language sentence. Written for someone who has never heard of a cottage food law. */
  message: string;
  /**
   * The words this rests on — the `venue_note` or `category_note` from the row, which after the
   * verification pass carry quoted statute rather than a summary's paraphrase.
   */
  citation: string | null;
  /** The programme the block came from, since several states run more than one. */
  programName: string | null;
  /** Where to read it. `state_food_programs.source_url`. */
  sourceUrl: string | null;
  /** When we last read that source, as an ISO date. */
  sourceCheckedAt: string | null;
  /**
   * Whether an admin has signed this row off against the state's own rules. False means our reading
   * has not been checked by a person, and the seller is told so rather than left to assume.
   */
  verified: boolean;
  /**
   * Where the seller goes to clear this, when there is somewhere to go. A refusal that names a
   * page is actionable; one that does not is a locked door.
   */
  fixPath?: string;
  fixLabel?: string;
}

/** For call sites that still want one line — the message alone. */
export function blockMessage(block: ComplianceBlock | null): string | null {
  return block?.message ?? null;
}
