// missions.js — the three sorties: where the rings hang, what passing one
// is worth, and how a sortie is scored. Ring paths are laid out from the
// mission's turn and spacing, seeded so every pilot flies the same course.
import { MISSIONS, RUNWAY, FLIGHT } from './config.js';
import { mulberry32 } from './random.js';
import { heightAt } from './terrain.js';
import { distanceTo } from './flight.js';

export function missionById(id) {
  return MISSIONS.find((m) => m.id === id) || MISSIONS[0];
}

// Lay the rings along a gentle S-course from the runway, turning a little
// at each ring, climbing over the valley. Ring height clears the ground
// below it by a safe margin.
export function buildRings(mission) {
  const rand = mulberry32(1000 + MISSIONS.indexOf(mission) * 131);
  const rings = [];
  let x = RUNWAY.lengthFt / 2 + 900;
  let z = 0;
  let heading = 90;
  let alt = mission.startAltFt;
  for (let i = 0; i < mission.rings; i += 1) {
    const turn = (rand() - 0.5) * 2 * mission.pathTurnDeg;
    heading = (heading + turn + 360) % 360;
    const rad = (heading * Math.PI) / 180;
    x += Math.sin(rad) * mission.ringSpacingFt;
    z += Math.cos(rad) * mission.ringSpacingFt;
    alt += (rand() - 0.35) * 260;
    alt = Math.max(650, Math.min(2400, alt));
    const ground = heightAt(x, z);
    const y = Math.max(alt, ground + 420);
    rings.push({ x, y, z, r: FLIGHT.ringRadiusFt, passed: false, index: i, heading });
  }
  return rings;
}

export function createSortie(mission) {
  return {
    mission,
    rings: buildRings(mission),
    nextRing: 0,
    score: 0,
    ringsHit: 0,
    timeSec: 0,
    status: 'flying', // flying | landed | crashed | out-of-fuel
    landingQuality: 0, // 0..1, set on a good landing
    message: '',
    messageUntil: 0,
  };
}

// The ring the pilot is aiming at right now.
export function nextRing(sortie) {
  return sortie.rings[sortie.nextRing] || null;
}

// True when the plane is close enough to the ring's centre to count.
export function ringPassed(plane, ring) {
  if (!ring || ring.passed) return false;
  return distanceTo(plane, ring) <= ring.r * 1.05;
}

// Score one ring: base points plus a speed bonus for keeping the pace up.
export function scoreRing(sortie, plane) {
  const ring = nextRing(sortie);
  if (!ring) return 0;
  ring.passed = true;
  sortie.nextRing += 1;
  sortie.ringsHit += 1;
  const speedBonus = Math.round(Math.max(0, plane.speedKts - 70) / 2);
  const points = FLIGHT.ringBonus + speedBonus;
  sortie.score += points;
  return points;
}

// Landing score: a gentle touchdown, on the centreline, facing down the
// runway, with fuel to spare, is worth the full bonus.
export function scoreLanding(sortie, plane) {
  const sink = Math.max(0, -plane.verticalSpeedFps);
  const sinkQ = Math.max(0, 1 - sink / FLIGHT.crashDescentFps);
  const speedQ = Math.max(0, 1 - Math.max(0, plane.speedKts - 55) / 60);
  const centreQ = Math.max(0, 1 - Math.abs(plane.z) / (RUNWAY.widthFt / 2));
  const quality = Math.min(1, (sinkQ * 0.5 + speedQ * 0.25 + centreQ * 0.25));
  sortie.landingQuality = quality;
  const points = Math.round(FLIGHT.landingBonus * quality) + Math.round(plane.fuel) * 2;
  sortie.score += points;
  return { points, quality };
}

// Stars for a finished sortie: rings, a landing, and speed all count.
export function starsFor(sortie) {
  if (sortie.status === 'crashed') return 0;
  let stars = 0;
  if (sortie.ringsHit >= sortie.rings.length) stars += 1;
  if (sortie.status === 'landed') stars += 1;
  if (sortie.landingQuality >= 0.7) stars += 1;
  return stars;
}

export function allRingsDone(sortie) {
  return sortie.nextRing >= sortie.rings.length;
}
