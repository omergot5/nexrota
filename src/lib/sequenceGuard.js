// ============================================================
// Race guard for out-of-order async resolution (Phase 11, INLINE-04).
//
// Not tied to React or the DOM on purpose — a plain closure, testable in
// Node like every other pure module in src/lib/.
//
// The problem this solves: useGuardian's refresh() fires api.loadTeam()
// from twelve different action call sites plus a realtime subscription
// that fires on every write. fetch/await are not guaranteed to resolve in
// the order they were sent — two refresh() calls issued back-to-back (e.g.
// a quick add-then-delete before either "Saving…" indicator clears) can
// resolve with the *older* response landing after the newer one, and
// setData(team) from the stale response silently overwrites the correct
// state with an older one. No error, no console.log — "מצב השבוע" (the
// stepper, the board, ScheduleMgmt's publish counts) just shows a stale
// number until the next refresh happens to arrive (11-CONTEXT.md §4).
//
// createSequenceGuard() hands out an incrementing token per call to
// next(); isCurrent(token) is true only for the token issued *last*,
// regardless of the order in which the async work holding earlier tokens
// eventually resolves. A caller wraps every state-painting branch of an
// async operation with `if (!guard.isCurrent(token)) return;` right before
// it writes state, so a superseded response can never win a race against
// a newer one — even if it resolves after the newer one already painted.
//
// Phase 13 (BUG-01..04): sequencedRefresh() and optimisticWrite() below are
// the bodies of useGuardian's refresh() and optimistic(), moved here so the
// race between the two (a read in flight vs. an optimistic write) runs in
// Node — scripts/verify-publish-sync.mjs. The hook keeps only the React glue.
// ============================================================

export function createSequenceGuard() {
  let current = 0;

  return {
    /** Issues a new token, one higher than any issued before. */
    next() {
      current += 1;
      return current;
    },
    /** True only for the most recently issued token. */
    isCurrent(token) {
      return token === current;
    },
  };
}

/**
 * The body of useGuardian's refresh(), minus React. One read of the team,
 * painted only if no newer read was issued while it was in flight.
 *
 * @param guard  the hook's single createSequenceGuard() instance
 * @param load   () => Promise<team> — the actual fetch
 * @param paint  (team) => void — called only for the current token
 * @param fail   (error) => void — called only for the current token
 * @returns {Promise<boolean>} true if this read painted
 */
export async function sequencedRefresh({ guard, load, paint, fail }) {
  const token = guard.next();
  try {
    const next = await load();
    if (!guard.isCurrent(token)) return false;
    paint(next);
    return true;
  } catch (e) {
    if (!guard.isCurrent(token)) return false;
    fail(e);
    return false;
  }
}

/**
 * The body of useGuardian's optimistic(), minus React: paint the patch now,
 * write, restore the snapshot if the write throws.
 *
 * Phase 13 (BUG-02): the guard above only ordered refresh() against other
 * refresh() calls. A read issued *before* this write — e.g. one of the N
 * realtime-triggered refreshes a publish of N rows sets off — was still the
 * "current" token, so when it resolved after the patch it painted the
 * pre-write rows back: "בטל הפצה" flipped straight back to "מפורסם".
 *
 * A reconciling write therefore owns the screen until its own read lands:
 * taking a token before painting makes every read already in flight stale,
 * and the reconcile read — issued after the commit, with a newer token —
 * supersedes anything issued mid-write and repaints server truth without
 * depending on a realtime event that may never arrive. Nothing is lost by
 * dropping the in-flight reads, because the reconcile read replaces them.
 *
 * A write *without* reconcile keeps the old behaviour and invalidates
 * nothing: no read is guaranteed to follow it, so dropping an in-flight read
 * could drop someone else's change (or freshly materialized rows) until the
 * next realtime event.
 *
 * @param read       () => current dataset (the hook's dataRef)
 * @param paint      (patchOrData) => void — setData; accepts an updater fn
 * @param isLive     () => boolean — mounted check, guards the rollback paint
 * @param reconcile  optional () => Promise — the hook passes refresh(). Runs
 *                   only after the write succeeded.
 */
export async function optimisticWrite({
  guard, read, paint, patch, work, isLive = () => true, reconcile = null,
}) {
  const snapshot = read();
  if (reconcile) guard.next();
  paint(patch);
  try {
    await work();
  } catch (e) {
    if (isLive()) paint(snapshot);
    throw e;
  }
  if (reconcile) await reconcile();
}
