// flight.js — the Skylark's flight model, pure numbers in, pure numbers
// out: no canvas, no DOM, so the logic tests can fly it in Node.
// Units: feet, knots, degrees, seconds. Speed is stored in knots and
// converted where the world needs feet per second.
import { FLIGHT, RUNWAY } from './config.js';
import { heightAt, onRunway } from './terrain.js';

export const KTS_TO_FPS = 1.68781;
export const DEG = Math.PI / 180;

export function createPlane(mission) {
  return {
    // Start on the runway threshold, heading east, rolling.
    x: -RUNWAY.lengthFt / 2 + 120,
    z: 0,
    y: heightAt(-RUNWAY.lengthFt / 2 + 120, 0) + 2,
    headingDeg: 90,
    pitchDeg: 0,
    rollDeg: 0,
    speedKts: 0,
    throttle: 0.55,
    fuel: mission.fuel,
    flaps: false,
    airborne: false,
    verticalSpeedFps: 0,
    distanceFlownFt: 0,
    stalled: false,
  };
}

// One physics step. `ctl` is { pitch: -1..1, roll: -1..1, throttle: -1..1,
// flaps: bool } and `wind` is { xKts, zKts, gustKts } for this step.
export function updateFlight(plane, ctl, wind, dt) {
  const F = FLIGHT;

  // Throttle eases toward its target; flaps cost speed.
  const targetThrottle = Math.min(1, Math.max(0, plane.throttle + ctl.throttle * dt * 0.45));
  plane.throttle = targetThrottle;
  plane.flaps = ctl.flaps;

  // Speed: thrust against drag, with a flap penalty. Wind gusts shove.
  const thrust = plane.throttle * 46;
  const drag = 0.0016 * plane.speedKts * plane.speedKts + (plane.flaps ? 9 : 0);
  const gust = (wind.gustKts || 0) * Math.sin(plane.distanceFlownFt / 900);
  plane.speedKts += (thrust - drag) * dt;
  plane.speedKts = Math.max(0, Math.min(F.maxSpeedKts, plane.speedKts));

  // Stall: below stall speed the wing quits and the nose drops.
  plane.stalled = plane.airborne && plane.speedKts < F.stallSpeedKts;
  const authority = plane.stalled ? 0.35 : 1;

  // Pitch and roll ease toward the pilot's demand.
  const pitchTarget = ctl.pitch * F.maxPitchDeg * authority;
  const rollTarget = ctl.roll * F.maxRollDeg * authority;
  plane.pitchDeg += (pitchTarget - plane.pitchDeg) * Math.min(1, dt * 2.2);
  plane.rollDeg += (rollTarget - plane.rollDeg) * Math.min(1, dt * 2.6);
  if (plane.pitchDeg < F.minPitchDeg) plane.pitchDeg = F.minPitchDeg;
  if (plane.pitchDeg > F.maxPitchDeg) plane.pitchDeg = F.maxPitchDeg;

  // A banked wing turns the nose: turn rate grows with bank, shrinks with speed.
  const speedFps = Math.max(30, plane.speedKts * KTS_TO_FPS);
  const turnRateDeg = (32.2 * Math.tan(plane.rollDeg * DEG) / speedFps) / DEG;
  plane.headingDeg = (plane.headingDeg + turnRateDeg * dt + 360) % 360;

  // Climb and sink: pitch lifts only when the wing has speed; a stalled
  // wing sinks hard. On the ground the plane stays on the ground.
  let climbFps = 0;
  if (plane.airborne || plane.speedKts > 62) {
    climbFps = speedFps * Math.sin(plane.pitchDeg * DEG) * F.climbFactor;
    if (plane.stalled) climbFps -= 26;
    if (plane.flaps) climbFps -= 4;
  }
  plane.verticalSpeedFps = climbFps;
  plane.y += climbFps * dt;

  // Move over the ground, wind included.
  const hdg = plane.headingDeg * DEG;
  const vx = Math.sin(hdg) * speedFps + (wind.xKts || 0) * KTS_TO_FPS + gust * 0.4;
  const vz = Math.cos(hdg) * speedFps + (wind.zKts || 0) * KTS_TO_FPS;
  plane.x += vx * dt;
  plane.z += vz * dt;
  plane.distanceFlownFt += speedFps * dt;

  // Takeoff: fast enough on the runway and the wheels leave the ground.
  // The liftoff step itself never counts as a touchdown.
  const ground = heightAt(plane.x, plane.z);
  let justLifted = false;
  if (!plane.airborne) {
    plane.y = ground + 2;
    if (plane.speedKts > 62 && plane.pitchDeg > 2) {
      plane.airborne = true;
      justLifted = true;
    }
  }

  // Fuel: throttle drinks, idling sips; empty tanks mean no thrust.
  const burn = (F.fuelBurnIdle + (F.fuelBurnPerSec - F.fuelBurnIdle) * plane.throttle) * dt;
  plane.fuel = Math.max(0, plane.fuel - burn);
  if (plane.fuel <= 0) plane.throttle = 0;

  // Ground contact: landing or crash, decided by where and how hard.
  if (plane.airborne && !justLifted && plane.y <= ground + 2) {
    plane.y = ground + 2;
    const sink = -plane.verticalSpeedFps;
    const overRunway = onRunway(plane.x, plane.z);
    const aligned = Math.abs(angleDiff(plane.headingDeg, RUNWAY.headingDeg)) < 18;
    if (overRunway && aligned && sink <= F.crashDescentFps && plane.speedKts <= F.landingSpeedKts) {
      plane.airborne = false;
      plane.pitchDeg = 0;
      plane.rollDeg = 0;
      return 'landed';
    }
    return 'crashed';
  }
  if (!plane.airborne && plane.speedKts < 8 && plane.distanceFlownFt < 10) {
    // Parked at the start: nothing to report.
  }
  return plane.airborne || plane.speedKts > 0 ? 'flying' : 'parked';
}

// Smallest signed difference between two headings, in degrees.
export function angleDiff(a, b) {
  let d = ((a - b + 540) % 360) - 180;
  return d;
}

// Distance from the plane to a point, in feet.
export function distanceTo(plane, p) {
  return Math.hypot(plane.x - p.x, plane.y - p.y, plane.z - p.z);
}
