# Kana Trainer

A Duolingo-style app for learning hiragana and katakana. Once installed to a phone's home screen it runs with no connection, so it works in airplane mode.

It has no build step and no dependencies: plain HTML, CSS and ES modules, served as static files.

## What's in it

- 208 characters in 28 units: the basic 46 of each script, dakuten and handakuten (が, ぱ), and combined sounds (きゃ).
- Lessons introduce 2 or 3 new characters and mix in ones you've learned. Each unit ends with a review lesson.
- Six exercise types: new-character card with stroke animation, character to reading, reading to character, listening, typing in rōmaji, tracing in stroke order, and tap-to-match pairs.
- Spaced repetition per character (`src/srs.js`). Misses come back sooner; the Learn screen offers due reviews and a "Practise mistakes" session.
- Free drill: pick any characters (learned or not, either script) and practise them without hearts. Drills don't touch your reviews, XP or streak.
- XP, daily goal, streak, and 5 hearts per lesson.
- Character chart shaded by how well you know each one.
- Light and dark mode.

## Run it locally

```bash
cd ~/Development/kana-trainer
python3 -m http.server 8000
```

Open http://localhost:8000. The service worker works on `localhost`, so you can test offline mode in desktop Chrome (DevTools, Network, Offline).

## Put it on your phone

The phone needs to load it once over HTTPS. GitHub Pages is free and enough:

1. Create a GitHub repo and push this folder to it.
2. In the repo, open Settings, Pages, and set the source to the `main` branch, root folder.
3. Open the Pages URL on your phone in Safari, tap Share, then Add to Home Screen.
4. Open it from the home screen once while online and wait a few seconds. Settings shows "Ready" under Offline when everything is stored.

Do this before the flight. After that it opens and runs in airplane mode.

## Sound

Pronunciation uses the device's built-in Japanese text-to-speech voice. iPhone, iPad and Mac include one (Kyoko or O-Ren) that runs offline. If no Japanese voice is found, listening exercises are skipped and Settings says so. Check this on your phone before you fly.

## Progress

Stored in `localStorage` on the device and nowhere else. Home-screen apps on iOS keep it; a plain Safari tab may lose it after weeks of not opening the site.

## Updating

After changing any file, bump `VERSION` in `sw.js` (for example `kana-v2`). Otherwise installed copies keep serving the old cached files. If you add a file, add it to the `FILES` list there too.

## Layout

```text
index.html              app shell
manifest.webmanifest    install metadata
sw.js                   offline cache
src/app.js              screens, lesson runner, exercises
src/lesson.js           builds each lesson's exercise queue, picks wrong options
src/srs.js              spaced repetition boxes and intervals
src/store.js            saved progress, XP, streak
src/trace.js            practice square, stroke animation, tracing check
src/speech.js           Japanese voice
src/styles.css
src/data/kana.js        generated: characters, units, stroke paths
src/fonts/kana.woff2    generated: Noto Sans JP cut down to kana and Latin
icons/                  generated app icons
build/                  scripts that generate the files above
```

## Regenerating data

`src/data/kana.js`, the font and the icons are generated. To change the course (unit order, lesson size, accepted rōmaji), edit `build/build_data.py` and rerun:

```bash
python3 build/fetch_kvg.py        # downloads KanjiVG stroke files to build/kvg/
curl -L -o build/NotoSansJP.ttf "https://raw.githubusercontent.com/google/fonts/main/ofl/notosansjp/NotoSansJP%5Bwght%5D.ttf"
pip install fonttools brotli pillow
python3 build/build_data.py
python3 build/make_icons.py
```

## Credits

Stroke order data from [KanjiVG](https://kanjivg.tagaini.net) by Ulrich Apel, CC BY-SA 3.0. Typeface Noto Sans JP, SIL Open Font License.
