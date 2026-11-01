// Progress saved on the device (localStorage). Nothing leaves the phone.
import { newRecord, grade } from './srs.js';

const KEY = 'kana.progress.v1';

const DEFAULTS = () => ({
  version: 1,
  items: {},          // itemId -> SRS record
  done: {},           // lessonId -> true
  xp: 0,
  days: {},           // 'YYYY-MM-DD' -> xp earned that day
  streak: { count: 0, last: null },
  settings: { sound: true, dailyGoal: 20, unlockAll: false },
  ui: { script: 'hiragana', installHintDismissed: false },
});

let state = load();

function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const saved = JSON.parse(raw);
      const d = DEFAULTS();
      return { ...d, ...saved, settings: { ...d.settings, ...saved.settings }, ui: { ...d.ui, ...saved.ui } };
    }
  } catch (e) { /* storage unavailable: start fresh in memory */ }
  return DEFAULTS();
}

export function save() {
  try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) { /* ignore */ }
}

export function get() { return state; }

export function reset() {
  state = DEFAULTS();
  save();
}

export function record(id) {
  return state.items[id] || newRecord();
}

export function dayKey(d = new Date()) {
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

function yesterdayKey() {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return dayKey(d);
}

/** Streak as it should be shown today (0 if a day was missed). */
export function currentStreak() {
  const { count, last } = state.streak;
  if (last === dayKey() || last === yesterdayKey()) return count;
  return 0;
}

export function todayXp() {
  return state.days[dayKey()] || 0;
}

/**
 * Apply a finished (or failed) session.
 * results: Map itemId -> { missed: boolean }
 */
export function applySession({ results, lessonId, completed, xp }) {
  const now = Date.now();
  for (const [id, r] of results) {
    state.items[id] = grade(record(id), !r.missed, now);
  }
  if (completed) {
    if (lessonId) state.done[lessonId] = true;
    state.xp += xp;
    const today = dayKey();
    state.days[today] = (state.days[today] || 0) + xp;
    const { last, count } = state.streak;
    if (last !== today) {
      state.streak = { count: last === yesterdayKey() ? count + 1 : 1, last: today };
    }
  }
  save();
}

export function setSetting(k, v) { state.settings[k] = v; save(); }
export function setUi(k, v) { state.ui[k] = v; save(); }
