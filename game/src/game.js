// game.js — the Skylark's state machine: title, briefing, flying, paused,
// sortie end. It owns the clock, the wind, the ring and landing calls, and
// turns clicks and keys into screen changes. Rendering lives in render.js.
import { MISSIONS } from './config.js';
import { createPlane, updateFlight } from './flight.js';
import { createSortie, nextRing, ringPassed, scoreRing, scoreLanding, starsFor, allRingsDone } from './missions.js';
import { createInput, attachInput, readControls, wasPressed, endFrame } from './input.js';
import { createAudio, startAudio, updateAudio, playRingChime, playThud, playCrash, playClick, setMuted } from './audio.js';
import { drawFlight, drawTitle, drawBriefing, drawPause, drawSortieEnd } from './render.js';
import { heightAt } from './terrain.js';

export const SCREEN_TITLE = 'title';
export const SCREEN_BRIEFING = 'briefing';
export const SCREEN_FLYING = 'flying';
export const SCREEN_PAUSED = 'paused';
export const SCREEN_END = 'end';

export function createGame(canvas) {
  const input = createInput();
  attachInput(input, canvas);
  return {
    canvas,
    input,
    audio: createAudio(),
    screen: SCREEN_TITLE,
    missionList: MISSIONS,
    pendingMission: MISSIONS[0],
    plane: null,
    sortie: null,
    timeSec: 0,
    flash: '',
    flashUntil: 0,
    starsEarned: 0,
    bestStars: {},
    totalScore: 0,
    uiButtons: [],
    hoverButton: null,
    muted: false,
  };
}

export function startSortie(game, mission) {
  game.pendingMission = mission;
  game.plane = createPlane(mission);
  game.sortie = createSortie(mission);
  game.screen = SCREEN_FLYING;
  game.timeSec = 0;
  game.flash = 'TAKE OFF — HOLD ↑ TO LIFT OFF';
  game.flashUntil = 4;
  startAudio(game.audio);
}

function windFor(game, t) {
  const m = game.sortie.mission;
  const dir = (m.windDirDeg * Math.PI) / 180;
  const gust = m.gustKts * Math.sin(t * 0.7) * Math.sin(t * 1.3 + 2);
  return {
    xKts: Math.sin(dir) * m.windKts,
    zKts: Math.cos(dir) * m.windKts,
    gustKts: gust,
  };
}

function setFlash(game, text, seconds) {
  game.flash = text;
  game.flashUntil = game.timeSec + seconds;
}

function updateFlying(game, dt) {
  const plane = game.plane;
  const sortie = game.sortie;
  game.timeSec += dt;
  sortie.timeSec += dt;
  const ctl = readControls(game.input);
  const result = updateFlight(plane, ctl, windFor(game, game.timeSec), dt);
  updateAudio(game.audio, plane);

  // Ring checks: the next ring only — flying through it in order counts.
  const target = nextRing(sortie);
  if (target && ringPassed(plane, target)) {
    const points = scoreRing(sortie, plane);
    playRingChime(game.audio);
    setFlash(game, 'RING ' + (target.index + 1) + '  +' + points, 1.6);
    if (allRingsDone(sortie)) setFlash(game, 'ALL RINGS — LAND ON RUNWAY 09', 4);
  }

  // Fuel out while airborne: the glide is the game now.
  if (plane.fuel <= 0 && plane.airborne && !sortie.fuelWarned) {
    sortie.fuelWarned = true;
    setFlash(game, 'OUT OF FUEL — GLIDE HER HOME', 3);
  }

  // Low over the ground with no runway under: a warning, not a crash yet.
  const ground = heightAt(plane.x, plane.z);
  if (plane.airborne && plane.y - ground < 120 && plane.verticalSpeedFps < -6) {
    setFlash(game, 'PULL UP', 0.4);
  }

  if (result === 'landed') {
    const { points, quality } = scoreLanding(sortie, plane);
    sortie.status = 'landed';
    playThud(game.audio);
    game.starsEarned = starsFor(sortie);
    game.bestStars[sortie.mission.id] = Math.max(game.bestStars[sortie.mission.id] || 0, game.starsEarned);
    game.totalScore += sortie.score;
    game.screen = SCREEN_END;
  } else if (result === 'crashed') {
    sortie.status = 'crashed';
    playCrash(game.audio);
    game.starsEarned = 0;
    game.totalScore += sortie.score;
    game.screen = SCREEN_END;
  }

  if (wasPressed(game.input, 'KeyP')) game.screen = SCREEN_PAUSED;
  if (wasPressed(game.input, 'KeyR')) startSortie(game, sortie.mission);
  if (wasPressed(game.input, 'KeyM')) toggleMute(game);
}

function toggleMute(game) {
  game.muted = !game.muted;
  setMuted(game.audio, game.muted);
}

function buttonAt(game, x, y) {
  return game.uiButtons.find((b) => x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h) || null;
}

function clickButton(game, id) {
  playClick(game.audio);
  if (id === 'start') startSortie(game, game.pendingMission);
  else if (id === 'back' || id === 'menu' || id === 'quit') game.screen = SCREEN_TITLE;
  else if (id === 'resume') game.screen = SCREEN_FLYING;
  else if (id === 'retry') startSortie(game, game.sortie.mission);
  else if (id === 'next') {
    const idx = MISSIONS.indexOf(game.sortie.mission);
    const next = MISSIONS[(idx + 1) % MISSIONS.length];
    game.pendingMission = next;
    game.screen = SCREEN_BRIEFING;
  } else if (id && id.startsWith('mission:')) {
    const mission = MISSIONS.find((m) => m.id === id.slice(8));
    if (mission) {
      game.pendingMission = mission;
      game.screen = SCREEN_BRIEFING;
    }
  }
}

function updateMenu(game) {
  const input = game.input;
  const click = input.clicked;
  const hover = buttonAt(game, input.mouseX, input.mouseY);
  game.hoverButton = hover ? hover.id : null;
  if (click) {
    const hit = buttonAt(game, click.x, click.y);
    if (hit) clickButton(game, hit.id);
  }
  if (wasPressed(input, 'KeyM')) toggleMute(game);
  if (game.screen === SCREEN_TITLE && wasPressed(input, 'Enter')) {
    game.pendingMission = MISSIONS[0];
    game.screen = SCREEN_BRIEFING;
  }
  if (game.screen === SCREEN_BRIEFING && wasPressed(input, 'Enter')) {
    startSortie(game, game.pendingMission);
  }
  if (game.screen === SCREEN_PAUSED) {
    if (wasPressed(input, 'KeyP')) game.screen = SCREEN_FLYING;
    if (wasPressed(input, 'KeyR')) startSortie(game, game.sortie.mission);
  }
  if (game.screen === SCREEN_END) {
    if (wasPressed(input, 'KeyR')) startSortie(game, game.sortie.mission);
    if (wasPressed(input, 'Enter')) clickButton(game, 'next');
  }
}

export function updateGame(game, dt) {
  if (game.screen === SCREEN_FLYING) updateFlying(game, dt);
  else updateMenu(game);
  endFrame(game.input);
}

export function drawGame(game) {
  const ctx = game.canvas.getContext('2d');
  if (game.screen === SCREEN_FLYING || game.screen === SCREEN_PAUSED) {
    drawFlight(ctx, game);
    if (game.screen === SCREEN_PAUSED) drawPause(ctx, game);
  } else if (game.screen === SCREEN_BRIEFING) {
    drawBriefing(ctx, game);
  } else if (game.screen === SCREEN_END) {
    drawFlight(ctx, game);
    drawSortieEnd(ctx, game);
  } else {
    drawTitle(ctx, game);
  }
}
