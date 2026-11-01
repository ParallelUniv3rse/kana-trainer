// Pronunciation through the device's built-in Japanese voice.
// iPhone, iPad and Mac ship one (Kyoko / O-Ren) that works offline.

let voice = null;
let ready = false;
const listeners = new Set();

function pickVoice() {
  if (!('speechSynthesis' in window)) return;
  const voices = speechSynthesis.getVoices();
  const ja = voices.filter((v) => /^ja(-|_|$)/i.test(v.lang));
  const before = [voice, ready];
  // Prefer voices that run on the device so it works in airplane mode.
  voice = ja.find((v) => v.localService) || ja[0] || null;
  if (voices.length) ready = true;
  if (before[0] !== voice || before[1] !== ready) listeners.forEach((fn) => fn());
}

if ('speechSynthesis' in window) {
  pickVoice();
  speechSynthesis.addEventListener?.('voiceschanged', pickVoice);
  // Some browsers never fire voiceschanged; poll briefly.
  let tries = 0;
  const t = setInterval(() => {
    pickVoice();
    if (voice || ++tries > 10) {
      clearInterval(t);
      if (!ready) { ready = true; listeners.forEach((fn) => fn()); }
    }
  }, 300);
}

export function hasVoice() { return !!voice; }
export function voicesChecked() { return ready || !('speechSynthesis' in window); }
export function onVoices(fn) { listeners.add(fn); return () => listeners.delete(fn); }

export function speak(text, { enabled = true } = {}) {
  if (!enabled || !voice) return;
  try {
    speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.voice = voice;
    u.lang = voice.lang;
    u.rate = 0.8;
    speechSynthesis.speak(u);
  } catch (e) { /* ignore */ }
}
