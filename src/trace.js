// Practice square with stroke-order animation and finger tracing.
// Stroke paths come from KanjiVG and live in a 109 x 109 box.
import { STROKES } from './data/kana.js';

const NS = 'http://www.w3.org/2000/svg';
const SIZE = 109;
const SAMPLES = 24;
const reducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

function el(name, attrs = {}, parent) {
  const n = document.createElementNS(NS, name);
  for (const [k, v] of Object.entries(attrs)) n.setAttribute(k, v);
  if (parent) parent.appendChild(n);
  return n;
}

/** The empty practice square: frame plus dashed centre guides. */
export function gridSvg(cls = '') {
  const svg = el('svg', { viewBox: `0 0 ${SIZE} ${SIZE}`, class: `grid-svg ${cls}`, 'aria-hidden': 'true' });
  el('line', { x1: SIZE / 2, y1: 2, x2: SIZE / 2, y2: SIZE - 2, class: 'guide' }, svg);
  el('line', { x1: 2, y1: SIZE / 2, x2: SIZE - 2, y2: SIZE / 2, class: 'guide' }, svg);
  return svg;
}

function samplePath(path, n = SAMPLES) {
  const len = path.getTotalLength();
  const pts = [];
  for (let i = 0; i < n; i++) {
    const p = path.getPointAtLength((len * i) / (n - 1));
    pts.push([p.x, p.y]);
  }
  return { pts, len };
}

function resample(points, n = SAMPLES) {
  if (points.length < 2) return Array(n).fill(points[0] || [0, 0]);
  const d = [0];
  for (let i = 1; i < points.length; i++) d.push(d[i - 1] + Math.hypot(points[i][0] - points[i - 1][0], points[i][1] - points[i - 1][1]));
  const total = d[d.length - 1] || 1;
  const out = [];
  let j = 0;
  for (let i = 0; i < n; i++) {
    const t = (total * i) / (n - 1);
    while (j < d.length - 2 && d[j + 1] < t) j++;
    const seg = d[j + 1] - d[j] || 1;
    const f = Math.min(1, Math.max(0, (t - d[j]) / seg));
    out.push([points[j][0] + (points[j + 1][0] - points[j][0]) * f, points[j][1] + (points[j + 1][1] - points[j][1]) * f]);
  }
  return out;
}

const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
const centroid = (pts) => pts.reduce((c, p) => [c[0] + p[0] / pts.length, c[1] + p[1] / pts.length], [0, 0]);

/** Does a drawn stroke match the expected one (position, shape and direction)? */
export function strokeMatches(drawn, expected) {
  const { pts: ref, len } = expected;
  const raw = drawn;
  if (raw.length < 2) {
    // A tap is fine for a dot-sized stroke (like the marks on が).
    return len < 14 && dist(raw[0] || [0, 0], centroid(ref)) < 14;
  }
  const user = resample(raw);
  if (len < 14) return dist(centroid(user), centroid(ref)) < 14;
  const mean = user.reduce((s, p, i) => s + dist(p, ref[i]), 0) / SAMPLES;
  const ends = dist(user[0], ref[0]) < 26 && dist(user[SAMPLES - 1], ref[SAMPLES - 1]) < 26;
  return mean < 15 && ends;
}

/** Draws a character stroke by stroke. Returns a function that stops it. */
export function animateStrokes(svg, kana, { strokeClass = 'ink', delay = 0 } = {}) {
  const paths = STROKES[kana] || [];
  const els = paths.map((d) => el('path', { d, class: strokeClass }, svg));
  if (reducedMotion()) return () => {};
  const anims = [];
  let t = delay;
  els.forEach((p) => {
    const len = p.getTotalLength();
    const dur = Math.max(260, len * 9);
    p.style.strokeDasharray = `${len} ${len}`;
    p.style.strokeDashoffset = len;
    anims.push(p.animate([{ strokeDashoffset: len }, { strokeDashoffset: 0 }], { duration: dur, delay: t, fill: 'forwards', easing: 'ease-in-out' }));
    t += dur + 140;
  });
  return () => anims.forEach((a) => a.cancel());
}

/** A big practice square showing one or more characters drawing themselves. */
export function strokeDemo(kana) {
  const wrap = document.createElement('div');
  wrap.className = 'demo';
  const chars = [...kana];
  chars.forEach((ch, i) => {
    const svg = gridSvg(chars.length > 1 ? 'small' : '');
    wrap.appendChild(svg);
    requestAnimationFrame(() => animateStrokes(svg, ch, { delay: i * 900 }));
  });
  wrap.replay = () => {
    wrap.querySelectorAll('path').forEach((p) => p.remove());
    wrap.querySelectorAll('svg').forEach((svg, i) => animateStrokes(svg, chars[i], { delay: i * 900 }));
  };
  return wrap;
}

/**
 * Tracing exercise. Calls onDone({ misses }) when every stroke is drawn.
 */
export function traceBoard(kana, { onDone, onMiss } = {}) {
  const paths = STROKES[kana];
  const svg = gridSvg('trace');
  svg.setAttribute('role', 'img');
  svg.setAttribute('aria-label', `Trace ${kana} stroke by stroke`);
  svg.removeAttribute('aria-hidden');
  const guides = paths.map((d) => el('path', { d, class: 'ghost' }, svg));
  const inkLayer = el('g', {}, svg);
  const hint = el('circle', { r: 4.5, class: 'start-dot' }, svg);
  let current = 0;
  let misses = 0;
  let strokeMisses = 0;
  let drawing = null;
  let points = [];
  let expected = [];

  // Sample once the SVG is in the document (getTotalLength needs layout in some browsers).
  const ready = () => { expected = guides.map((g) => samplePath(g)); placeHint(); };

  function placeHint() {
    if (current >= paths.length) { hint.style.display = 'none'; return; }
    const [x, y] = expected[current].pts[0];
    hint.setAttribute('cx', x);
    hint.setAttribute('cy', y);
    guides.forEach((g, i) => g.classList.toggle('next', i === current));
  }

  function toLocal(e) {
    const pt = svg.createSVGPoint();
    pt.x = e.clientX; pt.y = e.clientY;
    const p = pt.matrixTransform(svg.getScreenCTM().inverse());
    return [p.x, p.y];
  }

  function showStroke(i, cls = 'hint-anim') {
    const p = el('path', { d: paths[i], class: cls }, svg);
    if (reducedMotion()) { setTimeout(() => p.remove(), 900); return; }
    const len = p.getTotalLength();
    p.style.strokeDasharray = `${len} ${len}`;
    p.animate([{ strokeDashoffset: len }, { strokeDashoffset: 0 }], { duration: Math.max(400, len * 10), fill: 'forwards' })
      .finished.then(() => setTimeout(() => p.remove(), 300));
  }

  svg.addEventListener('pointerdown', (e) => {
    if (current >= paths.length) return;
    e.preventDefault();
    svg.setPointerCapture(e.pointerId);
    points = [toLocal(e)];
    drawing = el('polyline', { class: 'user', points: points.map((p) => p.join(',')).join(' ') }, inkLayer);
  });
  svg.addEventListener('pointermove', (e) => {
    if (!drawing) return;
    const p = toLocal(e);
    const last = points[points.length - 1];
    if (dist(p, last) < 0.8) return;
    points.push(p);
    drawing.setAttribute('points', points.map((q) => q.join(',')).join(' '));
  });
  const finish = () => {
    if (!drawing) return;
    const line = drawing;
    drawing = null;
    if (strokeMatches(points, expected[current])) {
      line.remove();
      el('path', { d: paths[current], class: 'ink done' }, inkLayer);
      current += 1;
      strokeMisses = 0;
      placeHint();
      if (current >= paths.length) setTimeout(() => onDone?.({ misses }), 250);
    } else {
      misses += 1;
      strokeMisses += 1;
      onMiss?.();
      line.classList.add('wrong');
      setTimeout(() => line.remove(), 450);
      if (strokeMisses >= 2) showStroke(current);
    }
  };
  svg.addEventListener('pointerup', finish);
  svg.addEventListener('pointercancel', finish);

  svg.ready = ready;
  svg.showNext = () => current < paths.length && showStroke(current);
  return svg;
}
