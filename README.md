# Skylark Run

[![Make the best flight game](https://make.fun/badge/best-flight-game-20261126-0057.svg)](https://make.fun/bounty/best-flight-game-20261126-0057)
[![Rank](https://make.fun/badge/best-flight-game-20261126-0057/satsuki-sys/best-flight-game/rank.svg)](https://make.fun/bounty/best-flight-game-20261126-0057)
[![Reward](https://make.fun/badge/best-flight-game-20261126-0057/satsuki-sys/best-flight-game/reward.svg)](https://make.fun/bounty/best-flight-game-20261126-0057)

A little red prop plane, three valleys, and a runway to come home to — a complete flight game for the [make.fun "Make the best flight game" bounty](https://make.fun/bounty/best-flight-game-20261126-0057). Take off from runway 09, thread the rings in order, mind your fuel and your airspeed, and land her gently: smooth touchdowns pay best.

## How to play

Open `game/index.html` in a desktop browser (or serve `game/` with any static server). No network, no build step, no downloads — every sound is synthesized in the browser.

- **W / S** — throttle up / down. **↑ / ↓** — pitch nose up / down. **← / →** — bank and turn.
- **Space** — flaps, to slow down for landing. **Mouse drag in flight** — steer. **Mouse click** — menus.
- **P** — pause. **M** — mute. **R** — restart the sortie.
- Fly through every ring in order (the next one glows and the HUD points at it), then land on runway 09: on the centreline, facing down the runway, sinking gently, under 95 knots. Land hard or short of the runway and the valley keeps the Skylark.
- Three sorties: **First Light** (dawn, 6 rings, gentle air), **Valley Run** (midday, 8 rings between the ridges, gusts), **Storm Ridge** (dusk, 10 rings, low fuel, crosswind landing). Each pays rings, speed bonuses and landing quality, rated up to three stars.

The HUD shows altitude, vertical speed, airspeed, throttle, heading on a compass tape, fuel, an artificial horizon, ring progress, score, time, and the bearing and distance to the next ring. Stall, low fuel and pull-up warnings light up when they matter.

## Layout

- `game/` — the game itself: `index.html` plus `src/` (one file per job: `config.js` the facts, `random.js` seeded noise, `terrain.js` the valley, `flight.js` the flight model, `missions.js` sorties and scoring, `input.js` keyboard and mouse, `audio.js` synthesized sound, `render.js` the chase view and HUD, `game.js` the state machine, `shots.js` the screenshot scenes, `main.js` the loop).
- `screenshots/` — four screenshots, real renders of the game's own code (`?shot=cover|valley|storm|land`).
- `tests/logic.test.mjs` — headless logic tests (terrain, flight model, missions, scoring): `node tests/logic.test.mjs`.
- `main.ts` — the hand-in program: copies `game/` and `screenshots/` to `/output` and writes `/output/dossier.json` with `buildDossier` from `vendor/makefun-game.ts`.
- `vendor/makefun-game.ts` — the kit's library, unchanged.

## Referral

Built with [make.fun](https://make.fun/r/27qytqes) — referral code `27qytqes`.
