# AI_INSTRUCTIONS.md: ORB ARENA (3D ball battle game) → APK

You are a game developer working inside this GitHub repository. The user asks for features,
fixes or new content. You change the code, push to `main`, make sure the automatic build passes,
and give the user the APK link. The user is usually on a phone with no PC. Do everything yourself.

APK link (always the newest build):
`https://github.com/<OWNER>/<REPO>/releases/latest/download/app.apk`

---

## 1. How the project is built

The game is a **web game (HTML/CSS/JavaScript + Three.js)** that runs inside a small Android app (WebView).

```
app/src/main/assets/www/          ← THE GAME (edit here 99% of the time)
  index.html                      page + import map for Three.js (CDN, bundled offline at build time)
  css/style.css                   liquid-glass UI styles
  js/data.js                      ALL content: elements, archetypes, weapons, arenas, floors, backdrops,
                                  hazards, modes, easy-code help/examples, EXAMPLE_FILE
  js/code.js                      Easy Code parser (WHEN/EVERY … IF … DO …)
  js/sim.js                       battle engine: physics, AI, powers, statuses, hazards, rules, sandbox tools
  js/render.js                    Three.js renderer: materials, arenas, effects, cameras, recording
  js/audio.js                     synthesized sound effects
  js/storage.js                   save data, share codes, Android bridge (save files, vibrate, copy)
  js/app.js                       UI + game flow: tabs, catalog, lab, forge, files, HUD, betting, tournament
app/src/main/java/com/orbarena/app/MainActivity.kt   Android WebView host (rarely needs changes)
.github/workflows/build-apk.yml   builds + publishes the APK (do not edit)
```

- The Android wrapper serves `assets/www` from `https://appassets.androidplatform.net/assets/www/`.
- The workflow downloads Three.js (version in `index.html`) and rewrites the import map so the APK works offline.
- JS bridge (`window.AndroidBridge`): `saveStart/saveChunk/saveEnd` (save to Downloads/OrbArena), `vibrate(ms)`, `copy(text)`.
  Android back button calls `window.onAndroidBack()` (return true if handled).

## 2. Hard rules

1. Do **not** edit `.github/workflows/build-apk.yml`, the Gradle files, or plugin versions unless asked.
2. Keep Three.js at the version in `index.html` (`three@0.170.0`). Only import from `three` and
   `three/addons/{controls,environments,postprocessing,shaders}/…` (only those folders are bundled).
3. No build tools, bundlers, npm packages or TypeScript. Plain ES modules only.
4. Text files only. No binary assets (images/sounds). Make textures with canvas, sounds with WebAudio.
5. Content lives in `data.js`. To add a new **element** or **archetype**, add it to `data.js` AND implement
   its behaviour in `sim.js` (`castElement`, `elementOnHit` for elements; `archetypeTick` for archetypes).
   Every element × archetype pair automatically becomes a catalog fighter.
6. Keep `sim.js` free of DOM/Three.js code (it must run headless).
7. Never break saved data: new settings need defaults in `DEFAULTS` in `app.js` (it merges with saved state).
8. Keep it fast on phones: reuse geometries, use pools for effects, respect the quality settings.

## 3. Steps for every request

1. **Understand.** Ask at most 3 short questions only if essential, otherwise decide and list your choices.
2. **Change the code.** Edit the files listed above.
3. **Self-check before pushing:**
   - [ ] Every new import/export name exists and is spelled the same in both files.
   - [ ] No undefined variables (check every new identifier).
   - [ ] New data keys are used consistently (`data.js` ↔ `sim.js` ↔ `render.js` ↔ `app.js`).
   - [ ] `fx` hooks called from `sim.js` exist in `Renderer.fxHooks()` (the sim fills missing hooks with no-ops).
   - [ ] No `alert/confirm/prompt` (use `modal()` / `toast()` in app.js).
   - [ ] JSON in `EXAMPLE_FILE` is still valid and its easy-code lines still parse.
4. **Push to `main`** with a clear commit message.
5. **Watch the build** (Actions → "Build APK", 3–6 min). If it fails, read the log, fix, push again (up to 5 tries).
6. **Reply** in short, simple English:

```
✅ Updated ORB ARENA
Download APK: https://github.com/<OWNER>/<REPO>/releases/latest/download/app.apk
What changed:
- ...
```

If you cannot push: output every changed file **in full** with its path, and tell the user to paste each
one on github.com (open the file → ✏️ edit → paste → Commit changes to `main`).

## 4. Easy Code reference (for balls' brains)

```
WHEN <event> [IF <condition>] DO <action> [AND <action>…]
EVERY <seconds> [IF <condition>] DO <action>
events: start hit hurt kill lowhp near death
conditions: hp<50 hp>50 enemies>3 enemies<2 allies>1 allies<3 chance 30
actions: heal N, damage N, explode N, dash, speed N, shield N, grow, shrink, clone, summon,
         power, pull, push, teleport, ghost, freeze, rage, say TEXT
```
