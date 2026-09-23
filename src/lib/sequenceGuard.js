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
