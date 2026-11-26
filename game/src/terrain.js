// terrain.js — the valley floor the Skylark flies over. heightAt(x, z)
// answers in feet; the runway apron is flattened, the valley floor stays
// low, and ridges rise to either side. Colours come from the palette so
// dawn, noon and dusk each read as one place at one hour.
import { RUNWAY } from './config.js';
import { makeRidgeNoise, makeNoise } from './random.js';

const ridge = makeRidgeNoise(4107);
const patch = makeNoise(9021);

// Distance from a point to the runway centreline, in feet.
export function runwayDistance(x, z) {
  const dx = x - RUNWAY.x;
  const dz = z - RUNWAY.z;
  // Runway runs east (heading 090): along = x, across = z.
  const along = dx;
  const across = dz;
  const outsideAlong = Math.max(0, Math.abs(along) - RUNWAY.lengthFt / 2);
  const outsideAcross = Math.max(0, Math.abs(across) - RUNWAY.widthFt / 2);
  return Math.hypot(outsideAlong, outsideAcross);
}

export function onRunway(x, z) {
  const dx = Math.abs(x - RUNWAY.x);
  const dz = Math.abs(z - RUNWAY.z);
  return dx <= RUNWAY.lengthFt / 2 && dz <= RUNWAY.widthFt / 2;
}

// Ground height in feet. Flat (12 ft) on the apron, rolling low ground in
// the valley, ridges climbing with distance from the valley centreline.
export function heightAt(x, z) {
  const dRun = runwayDistance(x, z);
  const az = Math.abs(z);
  // The valley is a corridor along z = 0: flat and friendly where the
  // rings hang, rising to walls only well off the flight path.
  const corridor = Math.min(1, Math.max(0, (az - 2200) / 4800)); // 0 in the corridor, 1 at the walls
  const wall = Math.pow(Math.max(0, (az - 5500) / 3500), 1.5) * 2200;
  const ridgeH = ridge(x, z) * 1800 * (0.15 + 0.85 * corridor);
  const roll = (patch(x, z) - 0.5) * 160 * (0.15 + 0.85 * corridor);
  let h = 12 + wall + Math.max(0, ridgeH + roll - 60);
  if (dRun < 700) {
    // Blend to the flat apron near the runway so landings are fair.
    const t = dRun / 700;
    h = 12 + (h - 12) * t * t;
  }
  return h;
}

// The ground colour for a point, by height and patchiness.
export function groundColor(x, z, palette) {
  const h = heightAt(x, z);
  const p = patch(x * 3.1, z * 3.1);
  if (h > 1500) return palette.rock;
  if (h > 900) return p > 0.5 ? palette.rock : palette.grass[2];
  if (h < 40 && runwayDistance(x, z) < 350) return palette.sand;
  const g = palette.grass;
  if (p < 0.33) return g[0];
  if (p < 0.66) return g[1];
  return g[2];
}

// A few still lakes in the low valley, for the map to read as a place.
export function isWater(x, z) {
  if (Math.abs(z) > 6000) return false;
  const d = Math.hypot(x - 5200, z + 3400);
  if (d < 900) return true;
  const d2 = Math.hypot(x + 6100, z - 2900);
  return d2 < 700;
}
