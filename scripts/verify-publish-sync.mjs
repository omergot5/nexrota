// Regression check for Phase 13 (BUG-01..04) — "ביטול הפצה" לא נתפס אחרי פרסום.
//   node scripts/verify-publish-sync.mjs
//
// The bug lived in the ordering between two async paths in useGuardian:
// optimistic() paints a patch and writes, while refresh() re-reads the whole
// team. The sequence guard (Phase 11) only ordered refresh() against other
// refresh() calls, so a read issued *before* the unpublish write — e.g. one of
// the N realtime-triggered refreshes that the preceding publish of N rows sets
// off — could resolve *after* the unpublish patch and paint published=true
// back on screen. publish() never re-read after writing, so nothing corrected
// it unless another realtime event happened to arrive (and bulk updates are
// exactly what trips Supabase's realtime rate limit).
//
// useGuardian's refresh()/optimistic() delegate to sequencedRefresh()/
// optimisticWrite() in sequenceGuard.js, so the code under test here is the
// code the hook runs — only React's setState is replaced by a plain store.
// `publishFlow` below is actions.publish with the network replaced: the same
// patch, `reconcile` set, and refresh() as the reconcile read.
// Every race is driven by hand-resolved promises: no timers, no randomness.

import {
  createSequenceGuard,
  optimisticWrite,
  sequencedRefresh,
} from "../src/lib/sequenceGuard.js";

let failures = 0;
const check = (label, cond, extra = "") => {
  if (cond) console.log(`  ok   ${label}`);
  else {
    failures++;
    console.log(`  FAIL ${label}${extra ? ` — ${extra}` : ""}`);
  }
};

/** A promise whose settlement the test controls. */
const deferred = () => {
  let resolve;
  let reject;
  const promise = new Promise((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
};

/**
 * Stand-in for useState: paint accepts a value or an updater, like setData.
 * Every paint is kept, so a test can ask what the screen showed on the way,
 * not only where it ended up.
 */
const makeStore = (initial) => {
  let state = initial;
  const history = [initial];
  return {
    read: () => state,
    paint: (p) => {
      state = typeof p === "function" ? p(state) : p;
      history.push(state);
    },
    get state() {
      return state;
    },
    history,
  };
};

const ids = (n) => Array.from({ length: n }, (_, i) => `s${i + 1}`);
const team = (shiftIds, published) => ({
  shifts: shiftIds.map((id) => ({ id, published })),
});
// Same patch actions.publish hands to optimistic().
const publishPatch = (shiftIds, published) => (d) => ({
  ...d,
  shifts: d.shifts.map((s) => (shiftIds.includes(s.id) ? { ...s, published } : s)),
});
const publishedOf = (state) => state.shifts.filter((s) => s.published).map((s) => s.id);

/** refresh() with the network replaced by `load`. */
const refreshWith = (guard, store, load) =>
  sequencedRefresh({ guard, load, paint: store.paint, fail: () => {} });

/**
 * actions.publish(shiftIds, published) with the network replaced.
 * `server` is the DB; `write` (optional) holds the UPDATE open until resolved.
 */
const publishFlow = ({ guard, store, server, shiftIds, published, write = null }) =>
  optimisticWrite({
    guard,
    read: store.read,
    paint: store.paint,
    patch: publishPatch(shiftIds, published),
    work: async () => {
      if (write) await write.promise;
      server.data = {
        ...server.data,
        shifts: server.data.shifts.map((s) =>
          shiftIds.includes(s.id) ? { ...s, published } : s
        ),
      };
    },
    reconcile: () => refreshWith(guard, store, async () => server.data),
  });

/** Did any paint after the unpublish patch show one of `shiftIds` as published? */
const flickeredBack = (store, shiftIds) => {
  const patchAt = store.history.findIndex((st) =>
    shiftIds.every((id) => !st.shifts.find((s) => s.id === id)?.published)
  );
  return store.history
    .slice(patchAt)
    .some((st) => shiftIds.some((id) => st.shifts.find((s) => s.id === id)?.published));
};

console.log("\nביטול הפצה מול קריאות שכבר בדרך (Phase 13)\n");

// ---------- 1. the reported bug: a pre-write read lands after the unpublish ----------
{
  const guard = createSequenceGuard();
  const week = ids(2);
  const store = makeStore(team(week, true));
  const server = { data: team(week, true) };
  const stormRead = deferred();

  // A refresh from the publish's realtime storm, issued before the unpublish.
  const stormP = refreshWith(guard, store, () => stormRead.promise);
  await publishFlow({ guard, store, server, shiftIds: week, published: false });
  // Its SELECT ran before the UPDATE committed — it still says "published".
  stormRead.resolve(team(week, true));
  const painted = await stormP;

  check("BUG-02 · קריאה שהונפקה לפני הכתיבה לא מחזירה 'מפורסם' אחרי ביטול ההפצה",
    publishedOf(store.state).length === 0, JSON.stringify(publishedOf(store.state)));
  check("BUG-02 · הקריאה הישנה מדווחת שלא צבעה",
    painted === false);
}

// ---------- 1b. same pre-write read, landing while the UPDATE is still open ----------
// Boundary neighbour of #1. The final state is saved by the reconcile read
// either way; what the pre-paint token prevents is the screen flipping back
// to "מפורסם" behind the still-open dialog.
{
  const guard = createSequenceGuard();
  const week = ids(2);
  const store = makeStore(team(week, true));
  const server = { data: team(week, true) };
  const stormRead = deferred();
  const write = deferred();

  const stormP = refreshWith(guard, store, () => stormRead.promise);
  const unpublishP = publishFlow({ guard, store, server, shiftIds: week, published: false, write });
  stormRead.resolve(team(week, true));
  await stormP;
  write.resolve();
  await unpublishP;

  check("BUG-02 · קריאה ישנה שחוזרת בזמן שהכתיבה עוד פתוחה לא מהבהבת 'מפורסם' מאחורי הדיאלוג",
    !flickeredBack(store, week), `history: ${store.history.map((st) => publishedOf(st).length).join("→")}`);
  check("BUG-02 · ובסוף — לא מפורסם",
    publishedOf(store.state).length === 0);
}

// ---------- 2. a read issued mid-write is superseded by the reconcile ----------
{
  const guard = createSequenceGuard();
  const week = ids(2);
  const store = makeStore(team(week, true));
  const server = { data: team(week, true) };
  const write = deferred();
  const midRead = deferred();

  const unpublishP = publishFlow({ guard, store, server, shiftIds: week, published: false, write });
  // Issued after the patch but before the UPDATE commits (a late realtime
  // event from the publish, or from another table).
  const midP = refreshWith(guard, store, () => midRead.promise);
  write.resolve();
  await unpublishP;
  midRead.resolve(team(week, true));
  await midP;

  check("BUG-02 · קריאה שהונפקה באמצע הכתיבה נדרסת ע\"י הקריאה שאחרי הכתיבה",
    publishedOf(store.state).length === 0, JSON.stringify(publishedOf(store.state)));
}

// ---------- 3. publish → unpublish on a real army week, storm in flight ----------
{
  const guard = createSequenceGuard();
  const week = ids(62); // seedArmyRoster: 3 fixed positions + 2 posts × 3 divisions
  const store = makeStore(team(week, false));
  const server = { data: team(week, false) };

  await publishFlow({ guard, store, server, shiftIds: week, published: true });
  check("BUG-03 · פרסום של שבוע army (62) נצבע ונשמר",
    publishedOf(store.state).length === 62 && publishedOf(server.data).length === 62);

  // The publish's 62 realtime events, each one a refresh() still in flight.
  const storm = week.map(() => deferred());
  const stormP = storm.map((d) => refreshWith(guard, store, () => d.promise));
  await publishFlow({ guard, store, server, shiftIds: week, published: false });
  // Resolve in reverse — the newest storm read lands last, the worst case.
  for (let i = storm.length - 1; i >= 0; i--) storm[i].resolve(team(week, true));
  await Promise.all(stormP);

  check("BUG-03 · אף קריאה מסערת ה-realtime של הפרסום לא מחזירה את 62 התורנויות",
    publishedOf(store.state).length === 0, `${publishedOf(store.state).length} still published`);
  check("BUG-03 · המסך והשרת מסכימים אחרי ביטול ההפצה",
    publishedOf(server.data).length === 0);
}

// ---------- 4. day-level unpublish touches only that day's ids ----------
{
  const guard = createSequenceGuard();
  const week = ids(4);
  const store = makeStore(team(week, true));
  const server = { data: team(week, true) };
  const stormRead = deferred();
  const stormP = refreshWith(guard, store, () => stormRead.promise);
  await publishFlow({ guard, store, server, shiftIds: ["s1", "s2"], published: false });
  stormRead.resolve(team(week, true));
  await stormP;

  check("BUG-03 · ביטול הפצה של יום אחד: רק משמרות היום חוזרות לטיוטה, השאר נשארות מפורסמות",
    JSON.stringify(publishedOf(store.state)) === JSON.stringify(["s3", "s4"]),
    JSON.stringify(publishedOf(store.state)));
}

// ---------- 5. nothing in flight — the plain path still works ----------
{
  const guard = createSequenceGuard();
  const week = ids(1);
  const store = makeStore(team(week, true));
  const server = { data: team(week, true) };
  await publishFlow({ guard, store, server, shiftIds: week, published: false });
  check("BUG-03 · בלי קריאות בדרך: ביטול ההפצה נצבע ונשמר",
    publishedOf(store.state).length === 0 && publishedOf(server.data).length === 0);
}

// ---------- 6. the guard does not freeze the screen after the write ----------
{
  const guard = createSequenceGuard();
  const week = ids(2);
  const store = makeStore(team(week, true));
  const server = { data: team(week, true) };
  await publishFlow({ guard, store, server, shiftIds: week, published: false });
  // Someone republishes from another device; its realtime event arrives.
  const later = await refreshWith(guard, store, async () => team(week, true));
  check("BUG-03 · קריאה שהונפקה אחרי הכתיבה עדיין נצבעת (לא מקפיאים את המסך)",
    later === true && publishedOf(store.state).length === 2);
}

// ---------- 7. a failed write still rolls back, and does not reconcile ----------
{
  const guard = createSequenceGuard();
  const week = ids(2);
  const store = makeStore(team(week, true));
  let reconciled = false;
  let caught = null;
  try {
    await optimisticWrite({
      guard, read: store.read, paint: store.paint,
      patch: publishPatch(week, false),
      work: async () => {
        throw new Error("אין לך הרשאה");
      },
      reconcile: async () => {
        reconciled = true;
      },
    });
  } catch (e) {
    caught = e;
  }
  check("rollback · כתיבה שנכשלה מחזירה את המצב הקודם וזורקת הלאה (ConfirmDialog נשאר פתוח)",
    caught?.message === "אין לך הרשאה" && publishedOf(store.state).length === 2);
  check("rollback · כתיבה שנכשלה לא מריצה את הקריאה המיישבת",
    reconciled === false);
}

// ---------- 8. rollback is skipped once unmounted ----------
{
  const guard = createSequenceGuard();
  const week = ids(1);
  const store = makeStore(team(week, true));
  try {
    await optimisticWrite({
      guard, read: store.read, paint: store.paint, isLive: () => false,
      patch: publishPatch(week, false),
      work: async () => {
        throw new Error("x");
      },
    });
  } catch {
    /* expected */
  }
  check("rollback · אחרי unmount לא צובעים את ה-snapshot",
    publishedOf(store.state).length === 0);
}

// ---------- 9. per-click writes (no reconcile) keep their old contract ----------
// toggleAssignment & co. are not followed by a read, so they must not drop
// one that is already in flight — it may carry someone else's change, or the
// rows ensurePositionsForWeek just materialized.
{
  const guard = createSequenceGuard();
  const store = makeStore({ shifts: [{ id: "s1", published: true }] });
  const inFlight = deferred();
  const readP = refreshWith(guard, store, () => inFlight.promise);
  await optimisticWrite({
    guard, read: store.read, paint: store.paint,
    patch: (d) => ({ ...d, marked: true }), work: async () => {},
  });
  inFlight.resolve({ shifts: [{ id: "s1", published: true }, { id: "new", published: false }] });
  const painted = await readP;
  check("scope · כתיבה בלי reconcile לא פוסלת קריאה שכבר בדרך (שורות חדשות עדיין מגיעות למסך)",
    painted === true && store.state.shifts.some((s) => s.id === "new"));
}

// ---------- 10. sequencedRefresh keeps the INLINE-04 contract ----------
{
  const guard = createSequenceGuard();
  const week = ids(1);
  const store = makeStore(team(week, false));
  const older = deferred();
  const newer = deferred();
  let failed = 0;
  const olderP = sequencedRefresh({
    guard, load: () => older.promise, paint: store.paint, fail: () => failed++,
  });
  const newerP = sequencedRefresh({
    guard, load: () => newer.promise, paint: store.paint, fail: () => failed++,
  });
  newer.resolve(team(week, false));
  await newerP;
  older.resolve(team(week, true));
  await olderP;
  check("INLINE-04 · תשובה ישנה שחוזרת אחרי חדשה לא צובעת",
    publishedOf(store.state).length === 0);

  const stale = deferred();
  const staleP = sequencedRefresh({
    guard, load: () => stale.promise, paint: store.paint, fail: () => failed++,
  });
  await sequencedRefresh({ guard, load: async () => team(week, false), paint: store.paint, fail: () => failed++ });
  stale.reject(new Error("network"));
  await staleP;
  check("INLINE-04 · כישלון של קריאה ישנה לא מציג שגיאה",
    failed === 0);
}

console.log(failures ? `\n${failures} FAILED\n` : "\nall ok\n");
process.exit(failures ? 1 : 0);
