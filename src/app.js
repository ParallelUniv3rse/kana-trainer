import { ITEMS, UNITS } from './data/kana.js';
import * as store from './store.js';
import { strength, isLearned, MAX_BOX } from './srs.js';
import { speak, hasVoice, onVoices, voicesChecked } from './speech.js';
import { buildLesson, buildReview, buildDrill, practiceIds, dueCount, checkRomaji, unitOfLesson, isSingle, shuffle } from './lesson.js';
import { traceBoard, strokeDemo, gridSvg } from './trace.js';

const app = document.getElementById('app');
const HEARTS = 5;
const MAX_REQUEUE = 6;

// ---------- small helpers ----------------------------------------------------
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
function h(html) {
  const t = document.createElement('template');
  t.innerHTML = html.trim();
  return t.content.firstElementChild;
}
const say = (text) => speak(text, { enabled: store.get().settings.sound });
const reduced = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const vibrate = (ms) => { try { navigator.vibrate?.(ms); } catch (e) { /* ignore */ } };

const ICON = {
  streak: '<svg viewBox="0 0 24 24" class="ic" aria-hidden="true"><path d="M12 2c.5 3.5 4.5 5.5 4.5 10.5A4.5 4.5 0 0 1 12 17a4.5 4.5 0 0 1-4.5-4.5c0-2 1-3.2 2-4.2.2 1.4.9 2.3 1.8 2.7C11 8.5 11.3 5 12 2Z" fill="currentColor"/><path d="M6 15.5A6 6 0 0 0 18 15.5" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round"/></svg>',
  xp: '<svg viewBox="0 0 24 24" class="ic" aria-hidden="true"><path d="M13 2 5 13.5h5.5L10 22l9-12h-6Z" fill="currentColor"/></svg>',
  heart: '<svg viewBox="0 0 24 24" class="ic" aria-hidden="true"><path d="M12 21s-8-5.2-8-11.2A4.3 4.3 0 0 1 12 7a4.3 4.3 0 0 1 8 2.8C20 15.8 12 21 12 21Z" fill="currentColor"/></svg>',
  close: '<svg viewBox="0 0 24 24" class="ic" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"/></svg>',
  sound: '<svg viewBox="0 0 24 24" class="ic" aria-hidden="true"><path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4Z" fill="currentColor"/><path d="M15.5 9a4 4 0 0 1 0 6M18 6.5a7.5 7.5 0 0 1 0 11" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round"/></svg>',
  lock: '<svg viewBox="0 0 24 24" class="ic" aria-hidden="true"><rect x="5.5" y="10.5" width="13" height="9.5" rx="2" fill="currentColor"/><path d="M8.5 10.5V8a3.5 3.5 0 0 1 7 0v2.5" stroke="currentColor" stroke-width="2.2" fill="none"/></svg>',
  review: '<svg viewBox="0 0 24 24" class="ic" aria-hidden="true"><path d="M5 12a7 7 0 0 1 12-4.9M19 12a7 7 0 0 1-12 4.9" stroke="currentColor" stroke-width="2.2" fill="none" stroke-linecap="round"/><path d="M17.5 3.5v4h-4M6.5 20.5v-4h4" stroke="currentColor" stroke-width="2.2" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  path: '<svg viewBox="0 0 24 24" class="ic" aria-hidden="true"><rect x="4" y="3" width="7" height="7" rx="1.5" stroke="currentColor" stroke-width="2" fill="none"/><rect x="13" y="14" width="7" height="7" rx="1.5" stroke="currentColor" stroke-width="2" fill="none"/><path d="M7.5 10v3.5a2 2 0 0 0 2 2H13" stroke="currentColor" stroke-width="2" fill="none"/></svg>',
  chart: '<svg viewBox="0 0 24 24" class="ic" aria-hidden="true"><path d="M4 4h16v16H4zM4 9.3h16M4 14.6h16M9.3 4v16M14.6 4v16" stroke="currentColor" stroke-width="1.8" fill="none"/></svg>',
  gear: '<svg viewBox="0 0 24 24" class="ic" aria-hidden="true"><circle cx="12" cy="12" r="3" stroke="currentColor" stroke-width="2" fill="none"/><path d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3M5.3 5.3l2.1 2.1M16.6 16.6l2.1 2.1M5.3 18.7l2.1-2.1M16.6 7.4l2.1-2.1" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>',
};

const NOTES = {
  'は': 'Read “wa” when it marks the topic of a sentence.',
  'ハ': 'Same sound as は.',
  'へ': 'Read “e” when it means “to” (a direction).',
  'を': 'Sounds like “o”. Used almost only to mark the object of a sentence.',
  'ヲ': 'Sounds like “o”. Rare in katakana.',
  'ん': 'Sounds like “m” before b, p and m.',
  'ぢ': 'Sounds the same as じ and is rare. Most words use じ.',
  'づ': 'Sounds the same as ず and is rare. Most words use ず.',
  'ヂ': 'Sounds the same as ジ and is rare.',
  'ヅ': 'Sounds the same as ズ and is rare.',
  'ふ': 'Between “fu” and “hu”: blow softly, lips barely rounded.',
  'つ': 'Like the “ts” in “cats”, followed by “u”.',
  'し': 'Like English “she”.',
  'シ': 'Strokes go up and to the right. Compare ツ, whose strokes go down.',
  'ツ': 'Strokes go down. Compare シ, whose strokes go up and to the right.',
  'ソ': 'The long stroke goes down from the top. Compare ン, which sweeps up from the bottom.',
  'ン': 'The long stroke sweeps up from the bottom. Compare ソ.',
};

function noteFor(item) {
  if (NOTES[item.kana]) return NOTES[item.kana];
  if (!isSingle(item)) {
    const [a, b] = [...item.kana];
    return `${a} with a small ${b}. Said as one beat.`;
  }
  return '';
}

// ---------- routing ------------------------------------------------------------
let tab = 'learn';
let session = null;

function render() {
  window.scrollTo(0, 0);
  app.innerHTML = '';
  if (session) return renderLesson();
  app.appendChild(tab === 'learn' ? learnScreen() : tab === 'chart' ? chartScreen() : settingsScreen());
  app.appendChild(navBar());
}

function navBar() {
  const items = [['learn', 'Learn', ICON.path], ['chart', 'Characters', ICON.chart], ['settings', 'Settings', ICON.gear]];
  const nav = h(`<nav class="tabs" aria-label="Sections">${items
    .map(([k, label, ic]) => `<button data-tab="${k}" ${tab === k ? 'aria-current="page"' : ''}>${ic}<span>${label}</span></button>`)
    .join('')}</nav>`);
  nav.addEventListener('click', (e) => {
    const b = e.target.closest('button[data-tab]');
    if (b) { tab = b.dataset.tab; render(); }
  });
  return nav;
}

function scriptSwitch(onChange) {
  const s = store.get().ui.script;
  const el = h(`<div class="seg" role="tablist" aria-label="Script">
    <button role="tab" data-s="hiragana" aria-selected="${s === 'hiragana'}"><span class="jp">ひ</span> Hiragana</button>
    <button role="tab" data-s="katakana" aria-selected="${s === 'katakana'}"><span class="jp">カ</span> Katakana</button>
  </div>`);
  el.addEventListener('click', (e) => {
    const b = e.target.closest('button[data-s]');
    if (!b) return;
    store.setUi('script', b.dataset.s);
    onChange();
  });
  return el;
}

function statusBar() {
  const st = store.get();
  const streak = store.currentStreak();
  const today = store.todayXp();
  const goal = st.settings.dailyGoal;
  const pct = Math.min(1, today / goal);
  return h(`<div class="status">
    <span class="stat streak ${streak ? 'on' : ''}" title="Day streak">${ICON.streak}<b>${streak}</b><span class="sr">day streak</span></span>
    <span class="stat goal" title="Today's goal">${ICON.xp}<b>${today}</b><span class="of">/ ${goal} XP</span>
      <span class="meter" aria-hidden="true"><span style="width:${pct * 100}%"></span></span></span>
  </div>`);
}

// ---------- Learn (the path) ---------------------------------------------------
function lessonsOf(script) {
  return UNITS.filter((u) => u.script === script).flatMap((u) => u.lessons);
}

function frontier(script) {
  const st = store.get();
  const ls = lessonsOf(script);
  const i = ls.findIndex((l) => !st.done[l.id]);
  return i < 0 ? ls.length : i;
}

function isStandalone() {
  return window.matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
}

function learnScreen() {
  const st = store.get();
  const script = st.ui.script;
  const screen = h('<main class="screen learn"></main>');
  const top = h('<header class="top"></header>');
  top.appendChild(scriptSwitch(render));
  top.appendChild(statusBar());
  screen.appendChild(top);

  if (!isStandalone() && !st.ui.installHintDismissed) {
    const hint = h(`<aside class="install">
      <p><b>To use this on a plane</b>, add it to your home screen while you're online. On iPhone: Share, then Add to Home Screen.</p>
      <button class="link" type="button">Dismiss</button></aside>`);
    hint.querySelector('button').onclick = () => { store.setUi('installHintDismissed', true); hint.remove(); };
    screen.appendChild(hint);
  }

  const due = dueCount(st.items);
  const learnedAny = Object.values(st.items).some(isLearned);
  const mistakes = practiceIds(st.items, { mistakesOnly: true }).length;
  if (learnedAny) {
    const p = h(`<section class="practice">
      <div><h2>${due ? `${due} character${due === 1 ? '' : 's'} ready for review` : 'Nothing due right now'}</h2>
      <p>${due ? 'Reviewing on time is what makes them stick.' : 'You can still practise your weakest characters.'}</p></div>
      <div class="row">
        <button class="btn ${due ? 'primary' : 'secondary'}" data-act="practice">${due ? 'Review now' : 'Practise'}</button>
        ${mistakes ? '<button class="btn secondary" data-act="mistakes">Practise mistakes</button>' : ''}
        <button class="btn secondary" data-act="drill">Free drill</button>
      </div></section>`);
    p.addEventListener('click', (e) => {
      const b = e.target.closest('button[data-act]');
      if (!b) return;
      if (b.dataset.act === 'drill') drillSheet();
      else startPractice(b.dataset.act === 'mistakes');
    });
    screen.appendChild(p);
  }

  const ls = lessonsOf(script);
  const front = frontier(script);
  const path = h('<div class="path"></div>');
  let n = 0;
  const offsets = [0, 1, 1.6, 1, 0, -1, -1.6, -1];
  for (const unit of UNITS.filter((u) => u.script === script)) {
    const unitKana = [...new Set(unit.lessons.flatMap((l) => l.new))].map((id) => ITEMS[id].kana);
    const all = [...unitKana.join('')];
    const preview = all.length > 8 ? all.slice(0, 6).join('') + '…' : all.join('');
    const sec = h(`<section class="unit"><header class="unit-head"><h2>${esc(unit.title)}</h2><span class="jp unit-kana" lang="ja">${preview}</span></header><ol class="nodes"></ol></section>`);
    const ol = sec.querySelector('ol');
    for (const lesson of unit.lessons) {
      const idx = ls.indexOf(lesson);
      const done = !!st.done[lesson.id];
      const open = st.settings.unlockAll || idx <= front;
      const current = idx === front;
      const state = current ? 'current' : done ? 'done' : open ? 'open' : 'locked';
      const parts = lesson.new.map((id) => ITEMS[id].kana);
      const combo = parts.some((k) => [...k].length > 1);
      const kana = combo ? parts.join('<br>') : parts.join('');
      const label = lesson.review ? `${unit.title} review` : `Lesson: ${parts.join(' ')}`;
      const size = combo ? 'c' : parts.length <= 2 ? 'l' : parts.length === 3 ? 'm' : 's';
      const li = h(`<li style="--x:${offsets[n++ % offsets.length]}">
        <button class="node ${state}" data-id="${lesson.id}" ${state === 'locked' ? 'disabled' : ''} aria-label="${esc(label)}${done ? ', completed' : ''}${state === 'locked' ? ', locked' : ''}">
          ${current ? '<span class="here">Start</span>' : ''}
          ${lesson.review ? `${ICON.review}` : `<span class="jp k-${size}" lang="ja">${kana}</span>`}
          ${state === 'locked' ? `<span class="lock">${ICON.lock}</span>` : ''}
        </button></li>`);
      ol.appendChild(li);
    }
    path.appendChild(sec);
  }
  if (front >= ls.length) path.appendChild(h(`<p class="finished">You've finished every ${script} lesson. Reviews keep them fresh.</p>`));
  path.addEventListener('click', (e) => {
    const b = e.target.closest('button.node');
    if (b && !b.disabled) lessonSheet(b.dataset.id);
  });
  screen.appendChild(path);

  // Bring the current lesson into view.
  requestAnimationFrame(() => {
    const cur = screen.querySelector('.node.current');
    if (cur && front > 0) cur.scrollIntoView({ block: 'center', behavior: 'instant' });
  });
  return screen;
}

function sheet(content, { onClose } = {}) {
  const back = h('<div class="sheet-back"><div class="sheet" role="dialog" aria-modal="true"></div></div>');
  const box = back.firstElementChild;
  box.appendChild(content);
  const close = () => { back.remove(); document.removeEventListener('keydown', onKey); onClose?.(); };
  const onKey = (e) => { if (e.key === 'Escape') close(); };
  back.addEventListener('click', (e) => { if (e.target === back) close(); });
  document.addEventListener('keydown', onKey);
  document.body.appendChild(back);
  box.querySelector('button')?.focus();
  return close;
}

function lessonSheet(lessonId) {
  const { unit, lesson, index } = unitOfLesson(lessonId);
  const done = store.get().done[lessonId];
  const ids = lesson.review || lesson.new;
  const title = lesson.review ? `${unit.title}: review` : `${unit.title}: lesson ${index + 1}`;
  const body = h(`<div>
    <h2>${esc(title)}</h2>
    <p class="muted">${lesson.review ? 'Every character in this unit, with harder exercises.' : `${ids.length} new character${ids.length === 1 ? '' : 's'}, plus a few you already know.`}</p>
    <div class="chips" lang="ja">${ids.map((id) => `<span class="chip jp">${ITEMS[id].kana}</span>`).join('')}</div>
    <button class="btn primary wide" type="button">${done ? 'Practise again' : 'Start lesson'}</button>
  </div>`);
  const close = sheet(body);
  body.querySelector('.btn').onclick = () => { close(); startLesson(lessonId); };
}

// ---------- Free drill ------------------------------------------------------------
const DRILL_SIZES = [10, 20, 30];
const unitIds = (u) => [...new Set(u.lessons.flatMap((l) => l.new))];

function drillSheet() {
  const st = store.get();
  const saved = st.ui.drill || {};
  const ofScript = (s) => Object.keys(ITEMS).filter((id) => ITEMS[id].script === s);
  let script = st.ui.script;
  const sel = new Set((saved.ids || []).filter((id) => ITEMS[id]));
  if (!sel.size) ofScript(script).filter((id) => isLearned(st.items[id])).forEach((id) => sel.add(id));
  let size = DRILL_SIZES.includes(saved.size) ? saved.size : 20;

  const body = h(`<div class="drill">
    <h2>Free drill</h2>
    <p class="muted">Practise any characters you like. Tap a row's name to pick the whole row; dashed ones you haven't learned yet. Drills don't change your reviews, XP or streak.</p>
    <div class="seg drill-script" role="tablist" aria-label="Script">
      <button role="tab" data-s="hiragana"><span class="jp">ひ</span> Hiragana</button>
      <button role="tab" data-s="katakana"><span class="jp">カ</span> Katakana</button>
    </div>
    <div class="drill-quick"><button class="link" data-q="learned">Select learned</button><button class="link" data-q="all">Select all</button><button class="link" data-q="none">Clear</button></div>
    <div class="drill-units"></div>
    <div class="drill-foot">
      <div class="drill-len"><b>Length</b><div class="seg small">${DRILL_SIZES.map((n) => `<button data-size="${n}">${n}</button>`).join('')}</div></div>
      <button class="btn primary wide" data-act="start" type="button"></button>
    </div>
  </div>`);
  const units = body.querySelector('.drill-units');

  const drawUnits = () => {
    units.innerHTML = UNITS.filter((u) => u.script === script).map((u) => `<section class="drill-unit">
      <button class="drill-unit-head" data-unit="${u.id}"><span>${esc(u.title)}</span><small></small></button>
      <div class="chips">${unitIds(u).map((id) => `<button class="chip jp ${isLearned(st.items[id]) ? '' : 'new'}" data-id="${id}" lang="ja" aria-label="${ITEMS[id].kana}, ${ITEMS[id].romaji}">${ITEMS[id].kana}</button>`).join('')}</div>
    </section>`).join('');
    refresh();
  };
  const refresh = () => {
    body.querySelectorAll('[data-s]').forEach((b) => b.setAttribute('aria-selected', b.dataset.s === script));
    body.querySelectorAll('[data-size]').forEach((b) => b.setAttribute('aria-pressed', Number(b.dataset.size) === size));
    units.querySelectorAll('[data-id]').forEach((b) => b.setAttribute('aria-pressed', sel.has(b.dataset.id)));
    units.querySelectorAll('[data-unit]').forEach((b) => {
      const ids = unitIds(UNITS.find((u) => u.id === b.dataset.unit));
      const on = ids.filter((id) => sel.has(id)).length;
      b.setAttribute('aria-pressed', on === ids.length);
      b.querySelector('small').textContent = on ? `${on} of ${ids.length}` : '';
    });
    const n = sel.size;
    const start = body.querySelector('[data-act="start"]');
    start.disabled = !n;
    start.textContent = n ? `Drill ${n} character${n === 1 ? '' : 's'}` : 'Pick some characters';
  };

  const close = sheet(body);
  body.addEventListener('click', (e) => {
    const b = e.target.closest('button');
    if (!b) return;
    const d = b.dataset;
    if (d.s) { script = d.s; drawUnits(); return; }
    if (d.q) {
      ofScript(script).forEach((id) => sel.delete(id));
      if (d.q !== 'none') ofScript(script).filter((id) => d.q === 'all' || isLearned(st.items[id])).forEach((id) => sel.add(id));
    } else if (d.unit) {
      const ids = unitIds(UNITS.find((u) => u.id === d.unit));
      const full = ids.every((id) => sel.has(id));
      ids.forEach((id) => (full ? sel.delete(id) : sel.add(id)));
    } else if (d.id) {
      if (!sel.delete(d.id)) sel.add(d.id);
    } else if (d.size) {
      size = Number(d.size);
    } else if (d.act === 'start') {
      store.setUi('drill', { ids: [...sel], size });
      close();
      startDrill();
      return;
    }
    refresh();
  });
  drawUnits();
}

// ---------- Character chart ------------------------------------------------------
function chartScreen() {
  const st = store.get();
  const script = st.ui.script;
  const screen = h('<main class="screen chart"></main>');
  const top = h('<header class="top"></header>');
  top.appendChild(scriptSwitch(render));
  screen.appendChild(top);
  screen.appendChild(h('<p class="muted intro-line">Darker squares are characters you know well. Tap one to hear it and see its strokes.</p>'));

  const units = UNITS.filter((u) => u.script === script);
  const ids = (u) => [...new Set(u.lessons.flatMap((l) => l.new))];
  const cell = (id) => {
    if (!id) return '<span class="cell gap"></span>';
    const it = ITEMS[id];
    const r = st.items[id];
    const s = strength(r);
    return `<button class="cell ${isLearned(r) ? 'learned' : ''}" data-id="${id}" style="--s:${s.toFixed(2)}" aria-label="${it.kana}, ${it.romaji}">
      <span class="jp" lang="ja">${it.kana}</span><small>${it.romaji}</small></button>`;
  };
  const rowsOf5 = [];
  for (const u of units.slice(0, 10)) {
    const list = ids(u);
    if (u.id.endsWith('-y')) rowsOf5.push([list[0], null, list[1], null, list[2]]);
    else if (u.id.endsWith('-w')) { rowsOf5.push([list[0], null, null, null, list[1]]); rowsOf5.push([list[2], null, null, null, null]); }
    else rowsOf5.push(list);
  }
  const block = (title, rows, cols) => `<section class="chart-block"><h2>${title}</h2>
    <div class="cells" style="--cols:${cols}">${rows.flat().map(cell).join('')}</div></section>`;

  const daku = units.slice(10, 12).flatMap(ids);
  const combo = units.slice(12).flatMap(ids);
  const chunk = (a, n) => a.reduce((r, x, i) => (i % n ? r[r.length - 1].push(x) : r.push([x]), r), []);
  screen.appendChild(h(`<div>${block('Basic', rowsOf5, 5)}${block('With marks', chunk(daku, 5), 5)}${block('Combined sounds', chunk(combo, 3), 3)}</div>`));
  screen.addEventListener('click', (e) => {
    const b = e.target.closest('button.cell');
    if (b) charSheet(b.dataset.id);
  });
  return screen;
}

const LEVELS = ['Not learned yet', 'Just learned', 'Learning', 'Learning', 'Getting there', 'Familiar', 'Familiar', 'Strong', 'Strong', 'Mastered'];

function charSheet(id) {
  const it = ITEMS[id];
  const r = store.get().items[id];
  const box = r ? r.box : 0;
  const body = h(`<div class="char-sheet">
    <div class="demo-slot"></div>
    <p class="romaji">${it.romaji}</p>
    <p class="muted">${LEVELS[Math.min(box, MAX_BOX)]}${r && r.reviews ? `, reviewed ${r.reviews} time${r.reviews === 1 ? '' : 's'}` : ''}</p>
    ${noteFor(it) ? `<p class="note">${esc(noteFor(it))}</p>` : ''}
    <div class="row center">
      ${hasVoice() ? `<button class="btn secondary" data-act="say">${ICON.sound} Play sound</button>` : ''}
      <button class="btn secondary" data-act="replay">Replay strokes</button>
    </div></div>`);
  const demo = strokeDemo(it.kana);
  body.querySelector('.demo-slot').appendChild(demo);
  body.addEventListener('click', (e) => {
    const b = e.target.closest('button[data-act]');
    if (!b) return;
    if (b.dataset.act === 'say') say(it.kana);
    else demo.replay();
  });
  sheet(body);
  say(it.kana);
}

// ---------- Settings --------------------------------------------------------------
function settingsScreen() {
  const st = store.get();
  const screen = h('<main class="screen settings"><header class="top"><h1>Settings</h1></header></main>');
  const voiceMsg = !voicesChecked()
    ? 'Checking for a Japanese voice…'
    : hasVoice()
      ? 'Using your device’s Japanese voice. It works offline.'
      : 'No Japanese voice found on this device, so listening exercises are off. Add a Japanese voice in your device’s speech or accessibility settings, then reopen the app.';
  const learnedCount = Object.values(st.items).filter(isLearned).length;
  const list = h(`<div class="settings-list">
    <label class="setting"><span><b>Sound</b><small>${voiceMsg}</small></span>
      <input type="checkbox" role="switch" data-k="sound" ${st.settings.sound ? 'checked' : ''}></label>
    <div class="setting stack"><span><b>Daily goal</b><small>XP per day. A lesson gives 10, or 15 with no mistakes.</small></span>
      <div class="seg small">${[10, 20, 30, 50].map((g) => `<button data-goal="${g}" aria-pressed="${st.settings.dailyGoal === g}">${g}</button>`).join('')}</div></div>
    <label class="setting"><span><b>Unlock all lessons</b><small>For when you already know some kana and want to skip ahead.</small></span>
      <input type="checkbox" role="switch" data-k="unlockAll" ${st.settings.unlockAll ? 'checked' : ''}></label>
    <div class="setting"><span><b>Offline</b><small class="offline-status">Checking…</small></span></div>
    <div class="setting stack"><span><b>Progress</b><small>${learnedCount} of ${Object.keys(ITEMS).length} characters learned, ${st.xp} XP in total. Saved on this device only.</small></span>
      <button class="btn danger-quiet" data-act="reset">Reset progress</button></div>
  </div>`);
  list.addEventListener('change', (e) => {
    const k = e.target.dataset.k;
    if (k) store.setSetting(k, e.target.checked);
  });
  list.addEventListener('click', (e) => {
    const g = e.target.closest('button[data-goal]');
    if (g) { store.setSetting('dailyGoal', Number(g.dataset.goal)); render(); return; }
    const r = e.target.closest('button[data-act="reset"]');
    if (r) {
      if (r.dataset.confirm) { store.reset(); render(); return; }
      r.dataset.confirm = '1';
      r.textContent = 'Tap again to erase everything';
      r.classList.add('armed');
    }
  });
  screen.appendChild(list);
  screen.appendChild(h(`<p class="credits muted">Stroke order data from <a href="https://kanjivg.tagaini.net" rel="noopener">KanjiVG</a> by Ulrich Apel (CC BY-SA 3.0). Typeface: Noto Sans JP (SIL Open Font License).</p>`));

  offlineStatus().then((msg) => { const s = screen.querySelector('.offline-status'); if (s) s.textContent = msg; });
  return screen;
}

async function offlineStatus() {
  if (!('serviceWorker' in navigator)) return 'This browser can’t store the app for offline use.';
  try {
    const reg = await navigator.serviceWorker.getRegistration();
    const keys = await caches.keys();
    if (reg?.active && keys.some((k) => k.startsWith('kana-'))) {
      return isStandalone() ? 'Ready. Everything is stored on this device.' : 'Stored on this device. Add it to your home screen to open it without internet.';
    }
    return 'Not stored yet. Keep the app open for a moment while online.';
  } catch (e) {
    return 'Couldn’t check offline storage.';
  }
}

// ---------- Lessons --------------------------------------------------------------
function startLesson(lessonId) {
  const st = store.get();
  const queue = buildLesson(lessonId, st.items, { voice: hasVoice() });
  const { unit, lesson } = unitOfLesson(lessonId);
  beginSession({ kind: 'lesson', lessonId, title: lesson.review ? `${unit.title} review` : unit.title, queue });
}

function startPractice(mistakesOnly) {
  const st = store.get();
  const ids = practiceIds(st.items, { mistakesOnly });
  if (!ids.length) return;
  const queue = buildReview(ids, st.items, { voice: hasVoice(), size: Math.max(8, Math.min(14, ids.length * 2)) });
  beginSession({ kind: mistakesOnly ? 'mistakes' : 'practice', title: mistakesOnly ? 'Mistakes' : 'Review', queue });
}

function startDrill(ids) {
  const st = store.get();
  const saved = st.ui.drill || {};
  const list = (ids || saved.ids || []).filter((id) => ITEMS[id]);
  if (!list.length) return;
  const queue = buildDrill(list, st.items, { voice: hasVoice(), size: saved.size || 20 });
  beginSession({ kind: 'drill', title: 'Drill', ids: list, queue });
}

function beginSession(s) {
  try { navigator.storage?.persist?.(); } catch (e) { /* ignore */ }
  session = { ...s, index: 0, hearts: HEARTS, results: new Map(), mistakes: 0, answered: 0, requeued: 0 };
  render();
}

function mark(item, missed) {
  const prev = session.results.get(item.id);
  session.results.set(item.id, { missed: !!(prev?.missed || missed) });
}

let lessonEls = null;

function renderLesson() {
  const root = h(`<main class="screen lesson">
    <header class="lesson-top">
      <button class="icon-btn" data-act="quit" aria-label="Quit ${session.kind === 'drill' ? 'drill' : 'lesson'}">${ICON.close}</button>
      <div class="progress" role="progressbar" aria-label="Lesson progress" aria-valuemin="0" aria-valuemax="100"><span></span></div>
      ${session.kind === 'drill' ? '' : `<span class="hearts" aria-label="Hearts left">${ICON.heart}<b></b></span>`}
    </header>
    <section class="stage" aria-live="polite"></section>
    <footer class="foot"><div class="foot-inner"><div class="verdict" role="status"></div><button class="btn primary check" type="button" disabled>Check</button></div></footer>
  </main>`);
  app.appendChild(root);
  lessonEls = {
    root,
    stage: root.querySelector('.stage'),
    foot: root.querySelector('.foot'),
    verdict: root.querySelector('.verdict'),
    btn: root.querySelector('.check'),
    bar: root.querySelector('.progress span'),
    barWrap: root.querySelector('.progress'),
    hearts: root.querySelector('.hearts b'),
  };
  root.querySelector('[data-act="quit"]').onclick = confirmQuit;
  showExercise();
}

function updateChrome() {
  const total = session.answered + (session.queue.length - session.index);
  const pct = total ? (session.answered / total) * 100 : 0;
  lessonEls.bar.style.width = `${pct}%`;
  lessonEls.barWrap.setAttribute('aria-valuenow', Math.round(pct));
  if (lessonEls.hearts) lessonEls.hearts.textContent = session.hearts;
}

function confirmQuit() {
  const drill = session.kind === 'drill';
  const body = h(`<div><h2>Quit this ${drill ? 'drill' : 'lesson'}?</h2><p class="muted">${drill ? 'Drills aren’t saved, so you won’t lose anything.' : 'Your answers so far won’t count.'}</p>
    <div class="row"><button class="btn primary" data-a="stay">Keep going</button><button class="btn secondary" data-a="quit">Quit</button></div></div>`);
  const close = sheet(body);
  body.addEventListener('click', (e) => {
    const a = e.target.closest('button')?.dataset.a;
    if (a === 'stay') close();
    if (a === 'quit') { close(); session = null; render(); }
  });
}

/** Footer handling shared by all exercises. */
let footAction = null;
function setFoot({ label = 'Check', enabled = false, action, verdict = null }) {
  const { foot, btn, verdict: v } = lessonEls;
  foot.classList.remove('ok', 'bad');
  v.innerHTML = '';
  if (verdict) {
    foot.classList.add(verdict.ok ? 'ok' : 'bad');
    v.innerHTML = verdict.html;
  }
  btn.textContent = label;
  btn.disabled = !enabled;
  footAction = action;
}
function enableFoot(on = true) { lessonEls.btn.disabled = !on; }

document.addEventListener('click', (e) => {
  if (session && lessonEls && e.target === lessonEls.btn && !lessonEls.btn.disabled) footAction?.();
});
document.addEventListener('keydown', (e) => {
  if (!session || !lessonEls || document.querySelector('.sheet-back')) return;
  if (e.key === 'Enter' && !lessonEls.btn.disabled && !(e.target.tagName === 'INPUT' && lessonEls.btn.textContent === 'Check' && !e.target.value)) {
    e.preventDefault();
    footAction?.();
  }
  if (/^[1-4]$/.test(e.key) && e.target.tagName !== 'INPUT') {
    lessonEls.stage.querySelectorAll('.opt')[Number(e.key) - 1]?.click();
  }
});

function next() {
  session.index += 1;
  if (session.hearts <= 0) return finishSession(false);
  if (session.index >= session.queue.length) return finishSession(true);
  showExercise();
}

/** Record an answer, show the verdict, and queue a retry if it was wrong. */
function answer(ex, ok, { costsHeart = true, correction = '' } = {}) {
  session.answered += 1;
  mark(ex.item, !ok);
  if (!ok) {
    session.mistakes += 1;
    // Drills have no hearts: they're for practising freely.
    if (costsHeart && session.kind !== 'drill') session.hearts = Math.max(0, session.hearts - 1);
    if (session.requeued < MAX_REQUEUE) {
      session.requeued += 1;
      session.queue.push(retryOf(ex));
    }
    vibrate(60);
  }
  updateChrome();
  if (ok) say(ex.item.kana);
  const praise = ['Correct', 'Nice', 'Yes', 'Well done', 'Right'][Math.floor(Math.random() * 5)];
  setFoot({
    label: 'Continue',
    enabled: true,
    action: next,
    verdict: ok
      ? { ok: true, html: `<b>${praise}</b><span><span class="jp" lang="ja">${ex.item.kana}</span> is ${ex.item.romaji}</span>` }
      : { ok: false, html: `<b>${correction || 'Not quite'}</b><span><span class="jp" lang="ja">${ex.item.kana}</span> is ${ex.item.romaji}</span>` },
  });
  lessonEls.btn.focus();
}

function retryOf(ex) {
  if (ex.options) return { ...ex, options: shuffle(ex.options) };
  return { ...ex };
}

function showExercise() {
  const ex = session.queue[session.index];
  const stage = lessonEls.stage;
  stage.innerHTML = '';
  stage.className = `stage ex-${ex.type}`;
  updateChrome();
  setFoot({ enabled: false });
  ({ intro, 'pick-reading': pickReading, 'pick-char': pickChar, listen, type: typeIt, trace, match }[ex.type])(ex, stage);
  if (!reduced()) stage.animate([{ opacity: 0, transform: 'translateX(16px)' }, { opacity: 1, transform: 'none' }], { duration: 220, easing: 'ease-out' });
}

function soundButton(text, big = false) {
  if (!hasVoice()) return null;
  const b = h(`<button class="sound ${big ? 'big' : ''}" type="button" aria-label="Play sound">${ICON.sound}</button>`);
  b.onclick = () => say(text);
  return b;
}

function intro(ex, stage) {
  const it = ex.item;
  mark(it, false);
  stage.appendChild(h('<h1 class="prompt">New character</h1>'));
  const card = h(`<div class="intro-card"><div class="demo-slot"></div>
    <div class="intro-text"><p class="romaji">${it.romaji}</p>${noteFor(it) ? `<p class="note">${esc(noteFor(it))}</p>` : ''}</div></div>`);
  const demo = strokeDemo(it.kana);
  card.querySelector('.demo-slot').appendChild(demo);
  const row = h('<div class="row center"></div>');
  const sb = soundButton(it.kana);
  if (sb) { sb.classList.add('btn', 'secondary'); sb.insertAdjacentHTML('beforeend', ' Play'); row.appendChild(sb); }
  const rb = h('<button class="btn secondary" type="button">Replay strokes</button>');
  rb.onclick = () => demo.replay();
  row.appendChild(rb);
  card.querySelector('.intro-text').appendChild(row);
  stage.appendChild(card);
  say(it.kana);
  setFoot({ label: 'Continue', enabled: true, action: next });
}

function choiceGrid(options, render, onPick) {
  const grid = h(`<div class="opts" role="radiogroup"></div>`);
  options.forEach((o, i) => {
    const b = h(`<button class="opt" role="radio" aria-checked="false" data-v="${esc(o)}"><kbd>${i + 1}</kbd>${render(o)}</button>`);
    b.onclick = () => {
      if (grid.dataset.locked) return;
      grid.querySelectorAll('.opt').forEach((x) => x.setAttribute('aria-checked', 'false'));
      b.setAttribute('aria-checked', 'true');
      onPick(o);
    };
    grid.appendChild(b);
  });
  return grid;
}

function lockAndReveal(grid, chosen, correct) {
  grid.dataset.locked = '1';
  grid.querySelectorAll('.opt').forEach((b) => {
    if (b.dataset.v === correct) b.classList.add('right');
    else if (b.dataset.v === chosen) b.classList.add('wrong');
  });
}

function bigKana(kana) {
  const box = h(`<div class="big-kana"><span class="jp" lang="ja">${kana}</span></div>`);
  box.prepend(gridSvg());
  if ([...kana].length > 1) box.classList.add('two');
  return box;
}

function pickReading(ex, stage) {
  const it = ex.item;
  stage.appendChild(h('<h1 class="prompt">What sound is this?</h1>'));
  stage.appendChild(bigKana(it.kana));
  let chosen = null;
  const grid = choiceGrid(ex.options.map((id) => ITEMS[id].romaji), (r) => `<span>${r}</span>`, (r) => { chosen = r; enableFoot(); });
  stage.appendChild(grid);
  setFoot({ action: () => { lockAndReveal(grid, chosen, it.romaji); answer(ex, chosen === it.romaji); } });
}

function pickChar(ex, stage) {
  const it = ex.item;
  stage.appendChild(h(`<h1 class="prompt">Which one is “${it.romaji}”?</h1>`));
  let chosen = null;
  const grid = choiceGrid(ex.options, (id) => `<span class="jp" lang="ja">${ITEMS[id].kana}</span>`, (id) => { chosen = id; say(ITEMS[id].kana); enableFoot(); });
  grid.classList.add('kana-opts');
  stage.appendChild(grid);
  setFoot({ action: () => { lockAndReveal(grid, chosen, it.id); answer(ex, chosen === it.id); } });
}

function listen(ex, stage) {
  const it = ex.item;
  stage.appendChild(h('<h1 class="prompt">Which one do you hear?</h1>'));
  const sb = soundButton(it.kana, true);
  stage.appendChild(sb);
  let chosen = null;
  const grid = choiceGrid(ex.options, (id) => `<span class="jp" lang="ja">${ITEMS[id].kana}</span>`, (id) => { chosen = id; enableFoot(); });
  grid.classList.add('kana-opts');
  stage.appendChild(grid);
  setTimeout(() => say(it.kana), 250);
  setFoot({ action: () => { lockAndReveal(grid, chosen, it.id); answer(ex, chosen === it.id); } });
}

function typeIt(ex, stage) {
  const it = ex.item;
  stage.appendChild(h('<h1 class="prompt">Type it in rōmaji</h1>'));
  stage.appendChild(bigKana(it.kana));
  const input = h('<input class="romaji-input" type="text" inputmode="latin" autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false" aria-label="Reading in rōmaji" placeholder="e.g. ka">');
  input.addEventListener('input', () => enableFoot(input.value.trim().length > 0));
  stage.appendChild(input);
  setTimeout(() => input.focus(), 50);
  setFoot({
    action: () => {
      input.readOnly = true;
      const ok = checkRomaji(it, input.value);
      input.classList.add(ok ? 'right' : 'wrong');
      answer(ex, ok, { correction: ok ? '' : `You typed “${esc(input.value.trim())}”` });
    },
  });
}

function trace(ex, stage) {
  const it = ex.item;
  stage.appendChild(h(`<h1 class="prompt">Trace <span class="jp" lang="ja">${it.kana}</span> in stroke order</h1>`));
  stage.appendChild(h('<p class="muted sub">Start at the dot. After two misses, the stroke is shown.</p>'));
  const board = traceBoard(it.kana, {
    onDone: ({ misses }) => {
      // Tracing is for learning, so it never costs a heart. Lots of misses still
      // counts as a weak answer for scheduling.
      session.answered += 1;
      mark(it, misses > 3);
      updateChrome();
      say(it.kana);
      setFoot({
        label: 'Continue', enabled: true, action: next,
        verdict: { ok: true, html: `<b>${misses === 0 ? 'Perfect strokes' : 'Done'}</b><span>${misses === 0 ? 'Every stroke right first time.' : `${misses} stroke${misses === 1 ? '' : 's'} redrawn.`}</span>` },
      });
      lessonEls.btn.focus();
    },
    onMiss: () => vibrate(30),
  });
  const wrap = h('<div class="trace-wrap"></div>');
  wrap.appendChild(board);
  stage.appendChild(wrap);
  requestAnimationFrame(() => board.ready());
  const row = h('<div class="row center"><button class="btn secondary" data-a="hint">Show next stroke</button><button class="btn quiet" data-a="skip">Can’t draw now</button></div>');
  row.addEventListener('click', (e) => {
    const a = e.target.closest('button')?.dataset.a;
    if (a === 'hint') board.showNext();
    if (a === 'skip') next();
  });
  stage.appendChild(row);
}

function match(ex, stage) {
  stage.appendChild(h('<h1 class="prompt">Tap the matching pairs</h1>'));
  const left = shuffle(ex.items);
  const right = shuffle(ex.items);
  const grid = h('<div class="match"><div class="col l"></div><div class="col r"></div></div>');
  left.forEach((it) => grid.querySelector('.l').appendChild(h(`<button class="opt m" data-id="${it.id}"><span class="jp" lang="ja">${it.kana}</span></button>`)));
  right.forEach((it) => grid.querySelector('.r').appendChild(h(`<button class="opt m" data-id="${it.id}"><span>${it.romaji}</span></button>`)));
  stage.appendChild(grid);
  let sel = null;
  let left_ = ex.items.length;
  const missed = new Set();
  grid.addEventListener('click', (e) => {
    const b = e.target.closest('button.m');
    if (!b || b.disabled) return;
    const side = b.closest('.col').classList.contains('l') ? 'l' : 'r';
    if (side === 'l') say(ITEMS[b.dataset.id].kana);
    if (!sel || sel.side === side) {
      grid.querySelectorAll(`.col.${side} .m`).forEach((x) => x.classList.remove('sel'));
      b.classList.add('sel');
      sel = { b, side };
      return;
    }
    const a = sel.b;
    sel = null;
    a.classList.remove('sel');
    if (a.dataset.id === b.dataset.id) {
      [a, b].forEach((x) => { x.classList.add('paired'); x.disabled = true; });
      if (--left_ === 0) {
        session.answered += 1;
        ex.items.forEach((it) => mark(it, missed.has(it.id)));
        updateChrome();
        setFoot({ label: 'Continue', enabled: true, action: next, verdict: { ok: true, html: `<b>${missed.size ? 'All paired' : 'All paired, no slips'}</b><span></span>` } });
        lessonEls.btn.focus();
      }
    } else {
      missed.add(a.dataset.id); missed.add(b.dataset.id);
      session.mistakes += 1;
      vibrate(40);
      [a, b].forEach((x) => { x.classList.add('nope'); setTimeout(() => x.classList.remove('nope'), 400); });
    }
  });
  setFoot({ enabled: false });
}

/** Drills only show how it went. Nothing is saved: no reviews, XP or streak. */
function finishDrill() {
  const s = session;
  session = null;
  app.innerHTML = '';
  const st = store.get();
  const ids = [...s.results.keys()];
  const missed = ids.filter((id) => s.results.get(id).missed);
  const total = s.answered || 1;
  const acc = Math.round(((total - Math.min(total, s.mistakes)) / total) * 100);
  const screen = h(`<main class="screen finish">
      <h1>Drill complete</h1>
      <div class="tally">
        <div><b>${s.answered}</b><span>answered</span></div>
        <div><b>${acc}%</b><span>accuracy</span></div>
        <div><b>${missed.length}</b><span>missed</span></div>
      </div>
      <h2>Characters drilled</h2>
      <div class="cells mini" lang="ja">${ids.map((id) => `<span class="cell ${isLearned(st.items[id]) ? 'learned' : ''} ${missed.includes(id) ? 'missed' : ''}" style="--s:${strength(st.items[id]).toFixed(2)}"><span class="jp">${ITEMS[id].kana}</span><small>${ITEMS[id].romaji}</small></span>`).join('')}</div>
      ${missed.length ? '<p class="muted">Outlined in red: ones you got wrong at least once.</p>' : ''}
      <div class="finish-actions">
        <button class="btn primary wide" data-a="again" type="button">Drill again</button>
        ${missed.length ? `<button class="btn secondary wide" data-a="missed" type="button">Drill the ${missed.length} missed</button>` : ''}
        <button class="btn quiet wide" data-a="done" type="button">Done</button>
      </div>
    </main>`);
  app.appendChild(screen);
  screen.addEventListener('click', (e) => {
    const a = e.target.closest('button')?.dataset.a;
    if (a === 'again') startDrill(s.ids);
    else if (a === 'missed') startDrill(missed);
    else if (a === 'done') render();
  });
  screen.querySelector('button')?.focus();
}

function finishSession(completed) {
  if (session.kind === 'drill') return finishDrill();
  const s = session;
  const perfect = s.mistakes === 0;
  const xp = completed ? (s.kind === 'lesson' ? 10 : 5) + (perfect ? 5 : 0) : 0;
  const streakBefore = store.currentStreak();
  store.applySession({ results: s.results, lessonId: s.kind === 'lesson' ? s.lessonId : null, completed, xp });
  session = null;
  app.innerHTML = '';
  const st = store.get();
  const ids = [...s.results.keys()];
  const total = s.answered || 1;
  const acc = Math.round(((total - Math.min(total, s.mistakes)) / total) * 100);
  const streak = store.currentStreak();
  const screen = completed
    ? h(`<main class="screen finish">
        <h1>${s.kind === 'lesson' ? 'Lesson complete' : 'Review complete'}</h1>
        <div class="tally">
          <div><b>+${xp}</b><span>XP</span></div>
          <div><b>${acc}%</b><span>accuracy</span></div>
          <div class="${streak > streakBefore ? 'up' : ''}"><b>${streak}</b><span>day streak</span></div>
        </div>
        <h2>Characters practised</h2>
        <div class="cells mini" lang="ja">${ids.map((id) => `<span class="cell learned" style="--s:${strength(st.items[id]).toFixed(2)}"><span class="jp">${ITEMS[id].kana}</span><small>${ITEMS[id].romaji}</small></span>`).join('')}</div>
        <button class="btn primary wide" type="button">Continue</button>
      </main>`)
    : h(`<main class="screen finish failed">
        <h1>Out of hearts</h1>
        <p class="muted">What you answered still counts toward your reviews. Give it another go.</p>
        <div class="row center"><button class="btn primary" data-a="retry">Try again</button><button class="btn secondary" data-a="back">Back to the path</button></div>
      </main>`);
  app.appendChild(screen);
  screen.addEventListener('click', (e) => {
    const b = e.target.closest('button');
    if (!b) return;
    if (b.dataset.a === 'retry') {
      if (s.kind === 'lesson') startLesson(s.lessonId); else startPractice(s.kind === 'mistakes');
      return;
    }
    render();
  });
  screen.querySelector('button')?.focus();
}

// ---------- boot ------------------------------------------------------------------
onVoices(() => { if (!session && tab === 'settings') render(); });
render();

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => navigator.serviceWorker.register('./sw.js').catch(() => {}));
}
