// tests/logic.test.mjs — headless checks for Skylark Run's pure logic:
// terrain, flight model, missions and scoring. Run: node tests/logic.test.mjs
// Exits non-zero on any failure. No DOM, no canvas, no network.
import { strict as assert } from 'node:assert';
import { heightAt, onRunway, runwayDistance } from '../game/src/terrain.js';
import { createPlane, updateFlight, angleDiff, distanceTo } from '../game/src/flight.js';
import { MISSIONS } from '../game/src/config.js';
import { buildRings, createSortie, nextRing, ringPassed, scoreRing, scoreLanding, starsFor } from '../game/src/missions.js';

let passed = 0;
function check(name, fn) {
  fn();
  passed += 1;
  console.log('ok - ' + name);
}

const idle = { pitch: 0, roll: 0, throttle: 0, flaps: false };
const noWind = { xKts: 0, zKts: 0, gustKts: 0 };

check('runway apron is flat and onRunway agrees with it', () => {
  assert.equal(heightAt(0, 0), 12);
  assert.equal(heightAt(1000, 0), 12);
  assert.equal(onRunway(0, 0), true);
  assert.equal(onRunway(5000, 0), false);
  assert.ok(runwayDistance(5000, 0) > 3000);
});

check('terrain rises away from the valley and is deterministic', () => {
  assert.equal(heightAt(3000, 8000), heightAt(3000, 8000));
  assert.ok(heightAt(0, 9000) > 400, 'ridge height ' + heightAt(0, 9000));
  assert.ok(heightAt(0, 0) < heightAt(0, 9000));
});

check('angleDiff wraps headings', () => {
  assert.equal(angleDiff(350, 10), -20);
  assert.equal(angleDiff(10, 350), 20);
  assert.equal(angleDiff(90, 90), 0);
});

check('plane takes off, climbs and turns with bank', () => {
  const plane = createPlane(MISSIONS[0]);
  const ctl = { pitch: 0.6, roll: 0.4, throttle: 0.8, flaps: false };
  let airborneAt = -1;
  for (let t = 0; t < 30; t += 1 / 60) {
    const r = updateFlight(plane, ctl, noWind, 1 / 60);
    if (plane.airborne && airborneAt < 0) airborneAt = t;
    assert.notEqual(r, 'crashed', 'crashed at t=' + t.toFixed(2));
  }
  assert.ok(airborneAt > 0 && airborneAt < 10, 'airborne at ' + airborneAt);
  assert.ok(plane.y > 400, 'climbed to ' + Math.round(plane.y) + ' ft');
  assert.ok(plane.headingDeg > 95, 'turned to ' + plane.headingDeg.toFixed(1));
  assert.ok(plane.speedKts > 60 && plane.speedKts <= 185);
});

check('stall sinks the plane when slow and nose-high', () => {
  const plane = createPlane(MISSIONS[0]);
  plane.airborne = true;
  plane.y = 1500;
  plane.speedKts = 40;
  plane.throttle = 0;
  const y0 = plane.y;
  updateFlight(plane, { pitch: 0.8, roll: 0, throttle: 0, flaps: false }, noWind, 1);
  assert.equal(plane.stalled, true);
  assert.ok(plane.y < y0, 'sank from ' + y0 + ' to ' + Math.round(plane.y));
});

check('fuel burns and empty tanks cut thrust', () => {
  const plane = createPlane(MISSIONS[0]);
  plane.fuel = 1;
  plane.throttle = 1;
  updateFlight(plane, idle, noWind, 5);
  assert.ok(plane.fuel < 1 && plane.fuel >= 0);
  updateFlight(plane, idle, noWind, 60);
  assert.equal(plane.fuel, 0);
  assert.equal(plane.throttle, 0);
});

check('a gentle runway touchdown lands; a hard one crashes', () => {
  const good = createPlane(MISSIONS[0]);
  good.airborne = true;
  good.x = 0; good.z = 0; good.y = 16;
  good.headingDeg = 90; good.speedKts = 70; good.pitchDeg = -2;
  const r1 = updateFlight(good, { pitch: -0.1, roll: 0, throttle: -0.5, flaps: true }, noWind, 0.5);
  assert.equal(r1, 'landed', 'gentle touchdown got ' + r1);

  const bad = createPlane(MISSIONS[0]);
  bad.airborne = true;
  bad.x = 0; bad.z = 0; bad.y = 200;
  bad.headingDeg = 90; bad.speedKts = 150; bad.pitchDeg = -15;
  let r2 = 'flying';
  for (let i = 0; i < 60 && r2 === 'flying'; i += 1) {
    r2 = updateFlight(bad, { pitch: -0.8, roll: 0, throttle: 0, flaps: false }, noWind, 0.1);
  }
  assert.equal(r2, 'crashed', 'hard touchdown got ' + r2);
});

check('terrain impact away from the runway crashes', () => {
  const plane = createPlane(MISSIONS[0]);
  plane.airborne = true;
  plane.x = 0; plane.z = 9000; plane.y = heightAt(0, 9000) + 6;
  plane.headingDeg = 90; plane.speedKts = 120; plane.pitchDeg = -12;
  let result = 'flying';
  for (let i = 0; i < 40 && result === 'flying'; i += 1) {
    result = updateFlight(plane, { pitch: -0.8, roll: 0, throttle: 0, flaps: false }, noWind, 0.05);
  }
  assert.equal(result, 'crashed', 'ridge impact got ' + result);
});

check('every mission builds its rings above the ground, in order', () => {
  for (const m of MISSIONS) {
    const rings = buildRings(m);
    assert.equal(rings.length, m.rings);
    for (const ring of rings) {
      assert.ok(ring.y > heightAt(ring.x, ring.z) + 300, m.id + ' ring ' + ring.index + ' too low');
    }
    // Same mission, same rings, every time.
    const again = buildRings(m);
    assert.deepEqual(rings.map((r) => [r.x, r.y, r.z]), again.map((r) => [r.x, r.y, r.z]));
  }
});

check('ring pass scores and advances the sortie', () => {
  const sortie = createSortie(MISSIONS[0]);
  const plane = createPlane(MISSIONS[0]);
  const ring = nextRing(sortie);
  plane.x = ring.x; plane.y = ring.y; plane.z = ring.z;
  plane.speedKts = 120;
  assert.equal(ringPassed(plane, ring), true);
  const points = scoreRing(sortie, plane);
  assert.ok(points >= 100, 'ring paid ' + points);
  assert.equal(sortie.ringsHit, 1);
  assert.equal(nextRing(sortie).index, 1);
  // A far ring does not count.
  const far = nextRing(sortie);
  assert.equal(ringPassed(plane, far), false);
});

check('landing score rewards a smooth, centred touchdown', () => {
  const sortie = createSortie(MISSIONS[0]);
  const plane = createPlane(MISSIONS[0]);
  plane.verticalSpeedFps = -3;
  plane.speedKts = 60;
  plane.z = 0;
  plane.fuel = 40;
  const good = scoreLanding(sortie, plane);
  assert.ok(good.quality > 0.8, 'good landing quality ' + good.quality.toFixed(2));
  const sortie2 = createSortie(MISSIONS[0]);
  const rough = createPlane(MISSIONS[0]);
  rough.verticalSpeedFps = -8.5;
  rough.speedKts = 92;
  rough.z = 70;
  rough.fuel = 40;
  const bad = scoreLanding(sortie2, rough);
  assert.ok(bad.quality < good.quality, 'rough ' + bad.quality.toFixed(2) + ' vs good ' + good.quality.toFixed(2));
});

check('stars: full marks need rings, a landing and a smooth touchdown', () => {
  const sortie = createSortie(MISSIONS[0]);
  sortie.ringsHit = 6;
  sortie.nextRing = 6;
  sortie.status = 'landed';
  sortie.landingQuality = 0.85;
  assert.equal(starsFor(sortie), 3);
  sortie.status = 'crashed';
  assert.equal(starsFor(sortie), 0);
});

check('distanceTo measures in feet', () => {
  const plane = createPlane(MISSIONS[0]);
  plane.x = 0; plane.y = 0; plane.z = 0;
  assert.equal(Math.round(distanceTo(plane, { x: 3, y: 4, z: 0 })), 5);
});

console.log('\n' + passed + ' logic tests passed');
