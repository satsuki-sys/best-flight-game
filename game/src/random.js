// random.js — a small seeded generator and value noise. Every mission and
// every screenshot scene is built from a fixed seed, so the same seed always
// gives the same valley, the same rings and the same frame.
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function next() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Smooth 2D value noise on a coarse grid, for terrain heights.
export function makeNoise(seed) {
  const rand = mulberry32(seed);
  const grid = new Map();
  const cell = 900; // feet per noise cell
  function lattice(ix, iz) {
    const key = ix + ',' + iz;
    let v = grid.get(key);
    if (v === undefined) {
      v = rand();
      grid.set(key, v);
    }
    return v;
  }
  function smooth(t) {
    return t * t * (3 - 2 * t);
  }
  return function noise(x, z) {
    const gx = x / cell;
    const gz = z / cell;
    const ix = Math.floor(gx);
    const iz = Math.floor(gz);
    const fx = smooth(gx - ix);
    const fz = smooth(gz - iz);
    const a = lattice(ix, iz);
    const b = lattice(ix + 1, iz);
    const c = lattice(ix, iz + 1);
    const d = lattice(ix + 1, iz + 1);
    const top = a + (b - a) * fx;
    const bottom = c + (d - c) * fx;
    return top + (bottom - top) * fz;
  };
}

// Ridge noise: one octave of value noise, folded so valleys stay flat
// and ridges rise. Returns 0..1. A single octave keeps the slopes gentle
// enough for a prop plane to outclimb.
export function makeRidgeNoise(seed) {
  const n1 = makeNoise(seed);
  return function ridge(x, z) {
    const v = n1(x, z);
    const r = Math.abs(v - 0.5) * 2;
    return r * r;
  };
}
