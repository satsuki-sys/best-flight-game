// shots.js — the four screenshot scenes. Each one plays the real rules
// forward from a fresh sortie — real throttle, real pitch, real rings — so
// the frame is what a real flight looks like at that moment, and the same
// steps always give the same frame. No randomness is used while staging.
// Called from main.js when the page loads with ?shot=<name>.
import { MISSIONS } from './config.js';
import { createPlane, updateFlight } from './flight.js';
import { createSortie, nextRing, ringPassed, scoreRing, allRingsDone } from './missions.js';
import { heightAt } from './terrain.js';

const STEP = 1 / 60;

// Fly the plane with a fixed control script for `seconds` of game time.
function fly(game, seconds, script) {
  const plane = game.plane;
  const sortie = game.sortie;
  let t = 0;
  while (t < seconds) {
    const ctl = script(t, plane, sortie);
    updateFlight(plane, ctl, { xKts: 0, zKts: 0, gustKts: 0 }, STEP);
    const target = nextRing(sortie);
    if (target && ringPassed(plane, target)) scoreRing(sortie, plane);
    game.timeSec += STEP;
    sortie.timeSec += STEP;
    t += STEP;
  }
}

// Straight ahead, climbing gently to ring height.
function cruiseCtl(t, plane) {
  return {
    pitch: plane.y < 1300 ? 0.55 : plane.y > 1500 ? -0.3 : 0,
    roll: 0,
    throttle: plane.speedKts < 120 ? 0.6 : 0,
    flaps: false,
  };
}

// Steer toward the next ring: bank toward its bearing, pitch to its
// height, and mind the speed — fast between rings, slow and tidy close
// in, flaps out to bleed speed when the ring is near and we are hot.
function chaseRingCtl(t, plane, sortie) {
  const target = nextRing(sortie);
  const ctl = { pitch: 0, roll: 0, throttle: 0, flaps: false };
  if (!target) return cruiseCtl(t, plane);
  const dx = target.x - plane.x;
  const dy = target.y - plane.y;
  const dz = target.z - plane.z;
  const dist = Math.hypot(dx, dy, dz);
  const bearing = (Math.atan2(dx, dz) * 180) / Math.PI;
  const rel = ((bearing - plane.headingDeg + 540) % 360) - 180;
  ctl.roll = Math.max(-1, Math.min(1, rel / 30));
  ctl.pitch = Math.max(-0.6, Math.min(0.7, dy / 350));
  // Target speed: 120 kts on the long legs, 90 kts inside 1800 ft so the
  // turn onto the ring stays ahead of the aeroplane.
  const targetSpeed = dist < 1800 ? 90 : 120;
  if (plane.speedKts < targetSpeed - 4) ctl.throttle = 0.7;
  else if (plane.speedKts > targetSpeed + 4) ctl.throttle = -0.8;
  if (dist < 1200 && plane.speedKts > 100) ctl.flaps = true;
  // On the ground, pitch up to lift off; in the air, the ring calls it.
  if (!plane.airborne) ctl.pitch = 0.6;
  return ctl;
}

// Fly the rings until `count` are down, or `maxSeconds` pass, in 5-second
// chunks. Returns how many rings the sortie has banked.
function flyRings(game, count, maxSeconds) {
  let flown = 0;
  while (game.sortie.ringsHit < count && flown < maxSeconds) {
    fly(game, 5, chaseRingCtl);
    flown += 5;
  }
  return game.sortie.ringsHit;
}

// Line the plane up with the runway and bring her down the centreline.
function landCtl(t, plane) {
  const ctl = { pitch: 0, roll: 0, throttle: 0, flaps: true };
  const dz = 0 - plane.z;
  let rel = ((90 - plane.headingDeg + 540) % 360) - 180;
  ctl.roll = Math.max(-1, Math.min(1, (rel / 20) + dz / 400));
  const ground = heightAt(plane.x, plane.z);
  const agl = plane.y - ground;
  ctl.pitch = agl > 120 ? -0.35 : agl > 40 ? -0.12 : 0.05;
  ctl.throttle = plane.speedKts < 78 ? 0.4 : plane.speedKts > 88 ? -0.5 : 0;
  return ctl;
}

function freshGame(game, missionId) {
  const mission = MISSIONS.find((m) => m.id === missionId);
  game.pendingMission = mission;
  game.plane = createPlane(mission);
  game.sortie = createSortie(mission);
  game.screen = 'flying';
  game.timeSec = 0;
  return mission;
}

/**
 * Stage one screenshot scene on the live game object, then return. The
 * scenes, by name:
 * - cover: First Light, mid-flight, two rings down, runway 09 ahead below.
 * - valley: Valley Run, low between the ridges, next ring dead ahead.
 * - storm: Storm Ridge at dusk, climbing toward a high ring.
 * - land: First Light, on final approach, runway filling the view.
 */
export function stageShot(game, name) {
  if (name === 'cover') {
    freshGame(game, 'first-light');
    flyRings(game, 2, 90);
    // Settle the frame: fly on toward the next ring for a few seconds so
    // the plane is level and the ring sits ahead, not behind.
    fly(game, 4, chaseRingCtl);
  } else if (name === 'valley') {
    freshGame(game, 'valley-run');
    flyRings(game, 2, 90);
    fly(game, 4, chaseRingCtl);
  } else if (name === 'storm') {
    freshGame(game, 'storm-ridge');
    flyRings(game, 3, 120);
    fly(game, 4, chaseRingCtl);
  } else if (name === 'land') {
    freshGame(game, 'first-light');
    // Fly every ring for real, then slew onto final and bring her down.
    flyRings(game, 6, 180);
    const plane = game.plane;
    plane.x = -3000;
    plane.z = 0;
    plane.y = 320;
    plane.headingDeg = 90;
    plane.pitchDeg = -4;
    plane.rollDeg = 0;
    plane.speedKts = 80;
    plane.throttle = 0.35;
    plane.airborne = true;
    fly(game, 16, landCtl);
    game.flash = 'ALL RINGS — LAND ON RUNWAY 09';
    game.flashUntil = game.timeSec + 10;
  } else {
    freshGame(game, 'first-light');
    fly(game, 12, cruiseCtl);
  }
  window.__shotReady = true;
}
