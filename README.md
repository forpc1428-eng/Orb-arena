# ⚔️ ORB ARENA

A 3D ball battle simulator for Android. Pick fighters, set up the arena, and watch them fight with real physics and powers.

**Download the newest APK:**
`https://github.com/<YOUR-USERNAME>/<REPO-NAME>/releases/latest/download/app.apk`

## What's inside
- **247 built-in fighters**: 13 elements (Lightning, Fire, Ice, Water, Earth, Wind, Poison, Light, Shadow, Void, Metal, Nature, Cosmic) × 19 archetypes (King, Giant, Duplicate, Ninja, Vampire, Bomber, Healer, Summoner, Magnet, Ghost, Mirror, Berserker, Sniper, Time, Gravity, Shapeshifter, Tank, Assassin, Phoenix)
- **Arenas:** circle, square, triangle, hexagon, octagon, donut · 8 floors · 7 backgrounds · hazards (spike walls, bumpers, portals, meteors, lightning storm, lava edge, spinner bar) · physics presets incl. **Zero-G Perpetual** (no gravity, no friction, 100% bounce), plus gravity, bounce, friction, acceleration and momentum controls
- **Modes:** Free For All, Teams, 1v1, Boss Fight, Battle Royale (shrinking ring), Survival waves, Tournament bracket
- **Play your way:** watch, Predict & Bet (coins), Sandbox god tools (grab & fling, spawn, explode, gravity well, smite, freeze, heal, delete)
- **Live stats:** HP, DPS, damage, kills and status effects for every ball · kill feed · end screen with MVP, HP chart and stats table
- **Ball Lab:** design balls (element, archetype, colour, material, size, stats budget, weapon, face) plus an **Easy Code** brain
- **Weapon Forge:** orbit blades, spikes, chain hammer, laser, drones, energy shield, all adjustable
- **Files:** export or import everything as one `.json` file or a share code (`ORB1:…`), with a full example file
- **Recording:** records only the arena (no buttons or menus) with a small HP panel at the side, saved to `Downloads/OrbArena`
- **Look:** realistic shiny materials (chrome, gold, glass, crystal, lava, holographic, pearl…), bloom glow, particles, lightning arcs, shadows, liquid-glass UI, Low/High/Ultra quality settings

## Setup (from your phone, one time)
1. Create a **public** repo on github.com, ticking **Add a README**.
2. **Add file → Create new file**, name it `.github/workflows/build-apk.yml`, paste the build file, then **Commit**.
3. **Add file → Upload files**, upload `project.zip`, then **Commit**. GitHub unpacks and builds it.
4. Wait for the green ✓ in **Actions** (about 5 min), then open the APK link above.
5. Optional: add the repo secret `DEBUG_KEYSTORE_B64` so updates install over the old app.

## Changing the game with AI
Send this to any AI that can access your GitHub:
```
Read AI_INSTRUCTIONS.md in https://github.com/<YOUR-USERNAME>/<REPO-NAME> and follow it.
Change: <what you want>
Push to main, make sure the build passes, and give me the APK link.
```
