// config.js — the fixed facts of Skylark Run: canvas, flight limits,
// mission list and the three time-of-day palettes. Nothing here reads the
// DOM or the network; every other module takes its numbers from here.
export const VIEW_W = 1280;
export const VIEW_H = 800;

// Flight model limits (feet, knots, degrees).
export const FLIGHT = {
  maxSpeedKts: 185,
  cruiseSpeedKts: 120,
  stallSpeedKts: 52,
  minSpeedKts: 0,
  maxPitchDeg: 22,
  minPitchDeg: -18,
  maxRollDeg: 62,
  maxThrottle: 1,
  fuelBurnPerSec: 0.55, // at full throttle, percent per second
  fuelBurnIdle: 0.12,
  climbFactor: 0.9,
  turnAuthority: 1.0,
  crashDescentFps: 9, // landing is safe only below this sink rate
  landingSpeedKts: 95,
  ringRadiusFt: 70,
  ringBonus: 100,
  landingBonus: 500,
};

// The three sorties. Each names its sky, its wind, its fuel and the path
// its rings follow; missions.js turns the path into ring positions.
export const MISSIONS = [
  {
    id: 'first-light',
    name: 'First Light',
    brief:
      'Dawn over Greenhollow Valley. Thread six rings, then bring her home onto runway 09. Gentle air, full tanks — learn the sky.',
    rings: 6,
    fuel: 100,
    windKts: 4,
    windDirDeg: 250,
    gustKts: 2,
    palette: 'dawn',
    pathTurnDeg: 18,
    ringSpacingFt: 2600,
    startAltFt: 900,
  },
  {
    id: 'valley-run',
    name: 'Valley Run',
    brief:
      'Midday in the Stonefold Valley. Eight rings snake between the ridges and the air bumps. Keep your speed up and your turns tidy.',
    rings: 8,
    fuel: 85,
    windKts: 9,
    windDirDeg: 190,
    gustKts: 6,
    palette: 'noon',
    pathTurnDeg: 32,
    ringSpacingFt: 2400,
    startAltFt: 1100,
  },
  {
    id: 'storm-ridge',
    name: 'Storm Ridge',
    brief:
      'Dusk on the high ridge, fuel low and the wind shoving. Ten rings, a crosswind landing, and no room for a sloppy turn.',
    rings: 10,
    fuel: 70,
    windKts: 16,
    windDirDeg: 120,
    gustKts: 11,
    palette: 'dusk',
    pathTurnDeg: 42,
    ringSpacingFt: 2200,
    startAltFt: 1500,
  },
];

// Sky, light and ground colours per time of day.
export const PALETTES = {
  dawn: {
    skyTop: '#2e4a7a', skyMid: '#e8956b', skyLow: '#f7c98b',
    sun: '#ffd9a0', sunX: 0.72, sunY: 0.30,
    fog: 'rgba(247, 201, 139, 0.35)',
    grass: ['#5d8a46', '#6b9a4e', '#527a3e'],
    rock: '#8a7a68', sand: '#cbb98a', water: '#4a7fa5',
    mountainFar: '#7d6f8e', mountainNear: '#5d5468',
    runway: '#3a3f46', ring: '#ffb02e', ringNext: '#ffe066',
  },
  noon: {
    skyTop: '#2f6fb8', skyMid: '#7db8e8', skyLow: '#cfe8f7',
    sun: '#fff3c4', sunX: 0.5, sunY: 0.16,
    fog: 'rgba(207, 232, 247, 0.30)',
    grass: ['#4f8a3d', '#5f9c46', '#43752f'],
    rock: '#8d8578', sand: '#d6c491', water: '#3f7fb0',
    mountainFar: '#8a9ab0', mountainNear: '#6b7d94',
    runway: '#33383f', ring: '#ff9d1c', ringNext: '#ffd23e',
  },
  dusk: {
    skyTop: '#1c1f3d', skyMid: '#a34d68', skyLow: '#e07a4e',
    sun: '#ff9a5c', sunX: 0.28, sunY: 0.34,
    fog: 'rgba(224, 122, 78, 0.38)',
    grass: ['#4a6b38', '#557a40', '#3e5c30'],
    rock: '#6f6258', sand: '#a8936a', water: '#2f4d6e',
    mountainFar: '#4c3f5e', mountainNear: '#3a3049',
    runway: '#2c3038', ring: '#ff7a2e', ringNext: '#ffc53e',
  },
};

// The home runway: a flat strip on the valley floor, heading east (090).
export const RUNWAY = {
  x: 0, z: 0, headingDeg: 90, lengthFt: 2600, widthFt: 150,
};

// Keyboard bindings, shown on the title and pause screens.
export const KEYS_HELP = [
  ['W / S', 'throttle up / down'],
  ['↑ / ↓', 'pitch nose up / down'],
  ['← / →', 'bank and turn'],
  ['Space', 'flaps: slow down for landing'],
  ['P', 'pause'],
  ['M', 'mute'],
  ['R', 'restart the sortie'],
  ['Mouse', 'menus, and drag in flight to steer'],
];
