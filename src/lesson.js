// Builds the queue of exercises for a lesson or practice session.
import { ITEMS, UNITS } from './data/kana.js';
import { strength, isLearned, isDue } from './srs.js';

// Characters people commonly mix up; used as wrong options first.
const LOOKALIKES = [
  'ぬめ', 'われね', 'るろ', 'はほ', 'さちき', 'いり', 'こに', 'あお', 'けは', 'うら', 'しつ', 'たな', 'まも', 'へく',
  'シツ', 'ソンリ', 'クケタ', 'ウワフ', 'アマ', 'コユロ', 'ナメ', 'セヤ', 'チテ', 'ノメ', 'ヌス', 'ルレ', 'ヲラ', 'ホオ',
];

const ORDER = Object.keys(ITEMS);
const shuffle = (a) => {
  const arr = [...a];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
};
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

export function unitOfLesson(lessonId) {
  for (const u of UNITS) {
    const i = u.lessons.findIndex((l) => l.id === lessonId);
    if (i >= 0) return { unit: u, lesson: u.lessons[i], index: i };
  }
  return null;
}

export function isSingle(item) {
  return [...item.kana].length === 1;
}

/** Wrong options for an item: lookalikes, then things already learned, then neighbours. */
function distractors(item, pool, n) {
  const sameScript = (id) => ITEMS[id].script === item.script;
  const okId = (id) => id !== item.id && sameScript(id) && ITEMS[id].romaji !== item.romaji;
  const chosen = [];
  const add = (id) => { if (okId(id) && !chosen.includes(id) && !chosen.some((c) => ITEMS[c].romaji === ITEMS[id].romaji)) chosen.push(id); };

  const look = LOOKALIKES.find((g) => g.includes(item.kana));
  if (look) shuffle([...look]).forEach((ch) => { const id = `${item.id[0]}:${ch}`; if (pool.includes(id)) add(id); });
  // Combined sounds: other combos sharing the same first or last character.
  if (!isSingle(item)) {
    shuffle(pool.filter((id) => !isSingle(ITEMS[id]) && (ITEMS[id].kana[0] === item.kana[0] || ITEMS[id].kana[1] === item.kana[1]))).forEach(add);
  }
  shuffle(pool).forEach((id) => { if (chosen.length < n) add(id); });
  if (chosen.length < n) {
    // Not enough learned yet: use characters near this one in the course.
    const i = ORDER.indexOf(item.id);
    const near = ORDER.slice(Math.max(0, i - 8), i + 9);
    shuffle(near).forEach((id) => { if (chosen.length < n) add(id); });
  }
  return chosen.slice(0, n);
}

function choiceOptions(item, pool) {
  return shuffle([item.id, ...distractors(item, pool, 3)]);
}

function exercise(type, item, pool) {
  switch (type) {
    case 'pick-reading':
    case 'pick-char':
    case 'listen':
      return { type, item, options: choiceOptions(item, pool) };
    default:
      return { type, item };
  }
}

/** Exercise type for a character you've seen before, harder as it gets stronger. */
function reviewType(item, rec, { voice }) {
  const s = strength(rec);
  const easy = ['pick-reading', 'pick-char'];
  const mid = voice ? ['pick-reading', 'pick-char', 'listen', 'type'] : ['pick-reading', 'pick-char', 'type'];
  const hard = voice ? ['type', 'listen', 'type'] : ['type'];
  if (s < 0.25) return pick(easy);
  if (s < 0.55) return pick(mid);
  return pick(hard);
}

function matchExercise(ids) {
  const items = shuffle(ids).slice(0, 5).map((id) => ITEMS[id]);
  // Pairs with the same reading (じ/ぢ) would be ambiguous.
  const seen = new Set();
  const uniq = items.filter((it) => (seen.has(it.romaji) ? false : seen.add(it.romaji)));
  return uniq.length >= 3 ? { type: 'match', items: uniq } : null;
}

function learnedPool(records, script) {
  return ORDER.filter((id) => ITEMS[id].script === script && isLearned(records[id]));
}

/** Weakest / most overdue learned characters first. */
function reviewCandidates(records, pool, exclude, n) {
  const now = Date.now();
  const scored = pool
    .filter((id) => !exclude.includes(id))
    .map((id) => {
      const r = records[id];
      const overdue = isDue(r, now) ? 1 + (now - r.due) / (24 * 3600e3) : 0;
      return { id, score: overdue * 2 + (1 - strength(r)) + Math.random() * 0.5 };
    })
    .sort((a, b) => b.score - a.score);
  return scored.slice(0, n).map((s) => s.id);
}

/**
 * A course lesson: introduce the new characters, drill them, and mix in
 * a few you've already learned.
 */
export function buildLesson(lessonId, records, { voice }) {
  const { unit, lesson } = unitOfLesson(lessonId);
  const script = unit.script;
  if (lesson.review) return buildReview(lesson.review, records, { voice, script });

  const fresh = lesson.new.map((id) => ITEMS[id]);
  const pool = [...new Set([...learnedPool(records, script), ...lesson.new])];
  const review = reviewCandidates(records, learnedPool(records, script), lesson.new, 4);

  const head = [];
  for (const it of fresh) {
    head.push({ type: 'intro', item: it });
    head.push(exercise('pick-reading', it, pool));
  }
  const body = [];
  for (const it of fresh) {
    body.push(exercise(voice ? pick(['listen', 'pick-char']) : 'pick-char', it, pool));
    if (isSingle(it)) body.push({ type: 'trace', item: it });
    body.push(exercise('type', it, pool));
  }
  for (const id of review) body.push(exercise(reviewType(ITEMS[id], records[id], { voice }), ITEMS[id], pool));

  const m = matchExercise([...lesson.new, ...review]);
  const tail = m ? [m] : [];
  return [...head, ...shuffle(body), ...tail];
}

/** Unit review or general practice over a set of characters. */
export function buildReview(ids, records, { voice, script, size = 12 }) {
  const items = ids.map((id) => ITEMS[id]);
  const pool = [...new Set([...learnedPool(records, script || items[0].script), ...ids])];
  const order = shuffle(ids);
  const out = [];
  let i = 0;
  while (out.length < size && order.length) {
    const id = order[i % order.length];
    out.push(exercise(reviewType(ITEMS[id], records[id], { voice }), ITEMS[id], pool));
    i++;
  }
  // One tracing drill on a single character, if any.
  const tr = items.filter(isSingle);
  if (tr.length) out.splice(Math.floor(out.length / 2), 0, { type: 'trace', item: pick(tr) });
  const m = matchExercise(ids);
  if (m) out.push(m);
  return out;
}

/**
 * Free drill over any characters, learned or not, from either script.
 * Cycles through the set until `size` exercises, with a matching round every 10.
 */
export function buildDrill(ids, records, { voice, size = 20 }) {
  const pool = [...new Set([...ORDER.filter((id) => isLearned(records[id])), ...ids])];
  const out = [];
  let order = [];
  let last = null;
  while (out.length < size) {
    if (!order.length) {
      order = shuffle(ids);
      // Don't repeat a character across the reshuffle.
      if (order.length > 1 && order[0] === last) order.push(order.shift());
    }
    const id = order.shift();
    last = id;
    out.push(exercise(reviewType(ITEMS[id], records[id], { voice }), ITEMS[id], pool));
  }
  const tr = ids.map((id) => ITEMS[id]).filter(isSingle);
  if (tr.length) out.splice(Math.floor(out.length / 2), 0, { type: 'trace', item: pick(tr) });
  for (let at = 10; at <= out.length; at += 11) {
    const m = matchExercise(ids);
    if (m) out.splice(at, 0, m);
  }
  return out;
}

/** Characters due for review (or the weakest ones, if nothing is due yet). */
export function practiceIds(records, { mistakesOnly = false, n = 8 } = {}) {
  const now = Date.now();
  const learned = ORDER.filter((id) => isLearned(records[id]));
  if (mistakesOnly) {
    return learned
      .filter((id) => records[id].lapses > 0)
      .sort((a, b) => strength(records[a]) - strength(records[b]) || records[b].lapses - records[a].lapses)
      .slice(0, n);
  }
  const due = learned.filter((id) => isDue(records[id], now)).sort((a, b) => records[a].due - records[b].due);
  if (due.length >= n) return due.slice(0, n);
  const rest = learned.filter((id) => !due.includes(id)).sort((a, b) => strength(records[a]) - strength(records[b]));
  return [...due, ...rest].slice(0, n);
}

export function dueCount(records) {
  const now = Date.now();
  return ORDER.filter((id) => isDue(records[id], now)).length;
}

/** Accepts the main reading and common alternatives (shi/si, tsu/tu, ...). */
export function checkRomaji(item, input) {
  const v = input.trim().toLowerCase().replace(/\s+/g, '');
  return v === item.romaji || item.alts.includes(v);
}

export { shuffle };
