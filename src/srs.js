// Spaced repetition: a Leitner-style box per character.
// Box 0 = not yet learned. Each correct review moves the character up a box
// and pushes its next review further out; a miss drops it back two boxes.

const MIN = 60 * 1000;
const DAY = 24 * 60 * MIN;
// Waiting time before the next review, by box.
export const INTERVALS = [0, 10 * MIN, 60 * MIN, 8 * 60 * MIN, DAY, 3 * DAY, 7 * DAY, 16 * DAY, 35 * DAY, 90 * DAY];
export const MAX_BOX = INTERVALS.length - 1;

export function newRecord() {
  return { box: 0, due: 0, lapses: 0, reviews: 0, last: 0 };
}

/** Update a record after a lesson. `ok` means no mistakes on it this lesson. */
export function grade(rec, ok, now = Date.now()) {
  const r = { ...newRecord(), ...rec };
  r.reviews += 1;
  if (ok) {
    // Reviewing before it's due only counts for a first step up; otherwise
    // cramming the same characters would race them to the top box.
    const early = r.box >= 2 && r.due > now;
    if (!early) r.box = Math.min(MAX_BOX, r.box + 1);
    else if (r.box < 1) r.box = 1;
  } else {
    r.lapses += 1;
    r.box = Math.max(1, r.box - 2);
  }
  r.due = now + INTERVALS[r.box];
  r.last = now;
  return r;
}

export function isLearned(rec) {
  return !!rec && rec.box > 0;
}

export function isDue(rec, now = Date.now()) {
  return isLearned(rec) && rec.due <= now;
}

/** 0..1, used to tint the chart and pick harder exercise types. */
export function strength(rec) {
  if (!isLearned(rec)) return 0;
  return rec.box / MAX_BOX;
}
