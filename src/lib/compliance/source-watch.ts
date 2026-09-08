/**
 * Deciding whether a source document has moved.
 *
 * Pure, and separate from the fetching, because the judgement is the part worth testing: a tripwire
 * that cries wolf is worse than none, for the same reason an invented deadline is worse than none —
 * people stop looking.
 */

export interface SourceSnapshot {
  etag: string | null;
  lastModified: string | null;
  contentHash: string | null;
}

export interface StoredSource extends SourceSnapshot {
  signal: SourceSignal | null;
}

export type SourceSignal = "etag" | "last_modified" | "content_hash";

/**
 * Which signal to trust for this document.
 *
 * `ETag` and `Last-Modified` come from the publisher and mean something. A body hash is a fallback
 * for hosts that send neither, and it is noisy — a legislature page can re-render for a session
 * banner without a word of the law changing — so it is only ever used when there is nothing better.
 */
export function chooseSignal(snapshot: SourceSnapshot): SourceSignal | null {
  if (snapshot.etag) return "etag";
  if (snapshot.lastModified) return "last_modified";
  if (snapshot.contentHash) return "content_hash";
  return null;
}

export interface MoveVerdict {
  moved: boolean;
  /** Which signal decided it. Null when nothing could be compared. */
  signal: SourceSignal | null;
  /** Why, in a sentence an admin can act on. */
  reason: string | null;
}

/**
 * Has it moved since we last looked?
 *
 * A first sighting is never a move: with nothing stored there is nothing to compare, and reporting
 * every URL as changed the first time the watcher runs would train an admin to ignore it.
 *
 * The comparison sticks to the signal we recorded last time rather than re-picking the best one
 * each run. A host that starts sending an `ETag` where it previously sent none would otherwise read
 * as a change on the first run after — a false alarm caused entirely by us switching signals.
 */
export function detectMove(stored: StoredSource, fresh: SourceSnapshot): MoveVerdict {
  const signal = stored.signal ?? chooseSignal(fresh);
  if (!signal) return { moved: false, signal: null, reason: null };

  const nothingStored =
    stored.etag == null && stored.lastModified == null && stored.contentHash == null;
  if (nothingStored) return { moved: false, signal, reason: null };

  if (signal === "etag") {
    if (stored.etag == null || fresh.etag == null) {
      return { moved: false, signal, reason: null };
    }
    return stored.etag === fresh.etag
      ? { moved: false, signal, reason: null }
      : {
          moved: true,
          signal,
          reason: "The publisher's ETag changed, so the document was edited.",
        };
  }

  if (signal === "last_modified") {
    if (stored.lastModified == null || fresh.lastModified == null) {
      return { moved: false, signal, reason: null };
    }
    return stored.lastModified === fresh.lastModified
      ? { moved: false, signal, reason: null }
      : {
          moved: true,
          signal,
          reason: `The publisher's Last-Modified moved to ${fresh.lastModified}.`,
        };
  }

  if (stored.contentHash == null || fresh.contentHash == null) {
    return { moved: false, signal, reason: null };
  }
  return stored.contentHash === fresh.contentHash
    ? { moved: false, signal, reason: null }
    : {
        moved: true,
        signal,
        reason:
          "The document's contents changed. This host sends no ETag or Last-Modified, so this is " +
          "a byte comparison — it can move when a page is re-rendered without the law changing.",
      };
}

/**
 * Does a freshly-read amendment line differ from the one on file?
 *
 * This is the strong signal, and it is a person's copy-paste rather than a machine's. Whitespace is
 * normalised because a line lifted from a PDF and one lifted from HTML differ in spacing and in
 * nothing else; everything past that is a real difference and is reported.
 */
export function versionChanged(stored: string | null, fresh: string | null): boolean {
  if (!stored || !fresh) return false;
  const tidy = (v: string) => v.replace(/\s+/g, " ").trim().toLowerCase();
  return tidy(stored) !== tidy(fresh);
}
