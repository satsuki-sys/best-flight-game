// render.js — everything the eye sees: sky, sun and clouds, the valley
// floor in perspective, the runway, the rings, the Skylark herself from
// the chase camera, the lit instruments, and the menu screens. All drawing
// is canvas 2D; no images, no fonts from the network.
import { VIEW_W, VIEW_H, PALETTES, RUNWAY } from './config.js';
import { heightAt, groundColor, isWater, onRunway } from './terrain.js';
import { mulberry32 } from './random.js';
import { nextRing } from './missions.js';
import { angleDiff } from './flight.js';

const DEG = Math.PI / 180;
const FOCAL = VIEW_H * 0.95;

// Fixed clouds, seeded once, spread over the valley and kept high, so
// they read as weather, not as walls beside the plane.
const clouds = (() => {
  const rand = mulberry32(5150);
  const list = [];
  for (let i = 0; i < 22; i += 1) {
    list.push({
      x: (rand() - 0.5) * 26000,
      y: 3800 + rand() * 1400,
      z: (rand() - 0.5) * 26000,
      r: 220 + rand() * 300,
    });
  }
  return list;
})();

// Project a world point into screen space from the chase camera.
// Returns { x, y, z } (z is depth ahead) or null when behind the camera.
export function project(cam, point) {
  const relX = point.x - cam.x;
  const relY = point.y - cam.y;
  const relZ = point.z - cam.z;
  const hdg = cam.headingDeg * DEG;
  const sinH = Math.sin(hdg);
  const cosH = Math.cos(hdg);
  const xc = relX * cosH - relZ * sinH;
  const zc = relX * sinH + relZ * cosH;
  const yc = relY;
  const pitch = cam.pitchDeg * DEG;
  const cosP = Math.cos(pitch);
  const sinP = Math.sin(pitch);
  const yv = yc * cosP - zc * sinP;
  const zv = yc * sinP + zc * cosP;
  if (zv < 40) return null;
  return {
    x: VIEW_W / 2 + (FOCAL * xc) / zv,
    y: VIEW_H / 2 - (FOCAL * yv) / zv,
    z: zv,
  };
}

// Like project, but a point behind the camera is pulled to the near plane
// instead of vanishing, so a long strip (the runway) still draws when its
// near end passes under the camera.
function projectClamped(cam, point) {
  const p = project(cam, point);
  if (p) return p;
  const relX = point.x - cam.x;
  const relY = point.y - cam.y;
  const relZ = point.z - cam.z;
  const hdg = cam.headingDeg * DEG;
  const sinH = Math.sin(hdg);
  const cosH = Math.cos(hdg);
  const xc = relX * cosH - relZ * sinH;
  const zc = relX * sinH + relZ * cosH;
  const yc = relY;
  const pitch = cam.pitchDeg * DEG;
  const cosP = Math.cos(pitch);
  const sinP = Math.sin(pitch);
  const yv = yc * cosP - zc * sinP;
  const zv = 40;
  return {
    x: VIEW_W / 2 + (FOCAL * xc) / zv,
    y: VIEW_H / 2 - (FOCAL * yv) / zv,
    z: zv,
  };
}

function cameraFor(plane) {
  const hdg = plane.headingDeg * DEG;
  const back = 74;
  const up = 16;
  return {
    x: plane.x - Math.sin(hdg) * back,
    y: plane.y + up,
    z: plane.z - Math.cos(hdg) * back,
    headingDeg: plane.headingDeg,
    pitchDeg: plane.pitchDeg * 0.55,
  };
}

function drawSky(ctx, palette, plane) {
  const g = ctx.createLinearGradient(0, 0, 0, VIEW_H);
  g.addColorStop(0, palette.skyTop);
  g.addColorStop(0.55, palette.skyMid);
  g.addColorStop(0.75, palette.skyLow);
  g.addColorStop(1, palette.skyLow);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  // Sun, placed by palette, with a soft halo.
  const sunX = palette.sunX * VIEW_W;
  const sunY = palette.sunY * VIEW_H;
  const halo = ctx.createRadialGradient(sunX, sunY, 4, sunX, sunY, 130);
  halo.addColorStop(0, palette.sun);
  halo.addColorStop(0.25, palette.sun + 'aa');
  halo.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = halo;
  ctx.fillRect(sunX - 140, sunY - 140, 280, 280);
  ctx.fillStyle = palette.sun;
  ctx.beginPath();
  ctx.arc(sunX, sunY, 30, 0, Math.PI * 2);
  ctx.fill();
}

function drawMountains(ctx, palette, plane) {
  const horizonY = VIEW_H / 2 - FOCAL * Math.tan(plane.pitchDeg * 0.55 * DEG);
  const ridge = (seed, base, amp, color) => {
    // A few control peaks, smoothly interpolated, so the ridge line reads
    // as mountains, not a saw blade.
    const rand = mulberry32(seed);
    const peaks = [];
    for (let i = 0; i <= 8; i += 1) peaks.push(rand());
    const peakAt = (t) => {
      const x = t * 8;
      const i = Math.min(7, Math.floor(x));
      const f = x - i;
      const s = f * f * (3 - 2 * f);
      return peaks[i] + (peaks[i + 1] - peaks[i]) * s;
    };
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(0, VIEW_H);
    for (let i = 0; i <= 24; i += 1) {
      const x = (i / 24) * VIEW_W;
      const y = horizonY - base - peakAt(i / 24) * amp;
      ctx.lineTo(x, y);
    }
    ctx.lineTo(VIEW_W, VIEW_H);
    ctx.closePath();
    ctx.fill();
  };
  ridge(31, 30, 150, palette.mountainFar);
  ridge(77, 8, 90, palette.mountainNear);
}

function drawClouds(ctx, cam, palette) {
  ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
  for (const c of clouds) {
    const p = project(cam, c);
    if (!p || p.z > 16000) continue;
    const r = (FOCAL * c.r) / p.z;
    if (r < 4 || r > 240) continue; // too close a cloud would fill the sky
    ctx.globalAlpha = Math.min(0.85, 9000 / p.z);
    ctx.beginPath();
    ctx.ellipse(p.x, p.y, r, r * 0.32, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

// The valley floor: rows of ground quads from far to near, painted over
// the sky below the horizon. Each quad's colour comes from terrain.js.
function drawTerrain(ctx, cam, palette) {
  const hdg = cam.headingDeg * DEG;
  const sinH = Math.sin(hdg);
  const cosH = Math.cos(hdg);
  const distances = [];
  for (let i = 0; i < 27; i += 1) distances.push(60 * Math.pow(1.16, i));
  const cols = 22;
  // Project the grid once, far row first.
  const rows = distances.map((d) => {
    const half = d * 0.85 + 120;
    const pts = [];
    for (let c = 0; c < cols; c += 1) {
      const lat = -half + (2 * half * c) / (cols - 1);
      const wx = cam.x + sinH * d + cosH * lat;
      const wz = cam.z + cosH * d - sinH * lat;
      const wy = heightAt(wx, wz);
      pts.push({ p: project(cam, { x: wx, y: wy, z: wz }), x: wx, z: wz, y: wy });
    }
    return pts;
  });
  for (let r = rows.length - 2; r >= 0; r -= 1) {
    const near = rows[r];
    const far = rows[r + 1];
    for (let c = 0; c < cols - 1; c += 1) {
      const a = far[c];
      const b = far[c + 1];
      const d = near[c + 1];
      const e = near[c];
      if (!a.p || !b.p || !d.p || !e.p) continue;
      const mx = (a.x + d.x) / 2;
      const mz = (a.z + d.z) / 2;
      ctx.fillStyle = isWater(mx, mz) ? palette.water : groundColor(mx, mz, palette);
      ctx.beginPath();
      ctx.moveTo(a.p.x, a.p.y);
      ctx.lineTo(b.p.x, b.p.y);
      ctx.lineTo(d.p.x, d.p.y);
      ctx.lineTo(e.p.x, e.p.y);
      ctx.closePath();
      ctx.fill();
    }
  }
}

function drawRunway(ctx, cam, palette) {
  const halfL = RUNWAY.lengthFt / 2;
  const halfW = RUNWAY.widthFt / 2;
  const corners = [
    { x: -halfL, z: -halfW },
    { x: halfL, z: -halfW },
    { x: halfL, z: halfW },
    { x: -halfL, z: halfW },
  ].map((c) => projectClamped(cam, { x: c.x, y: 14, z: c.z }));
  if (corners.some((c) => !c)) return;
  ctx.fillStyle = palette.runway;
  ctx.beginPath();
  ctx.moveTo(corners[0].x, corners[0].y);
  for (let i = 1; i < 4; i += 1) ctx.lineTo(corners[i].x, corners[i].y);
  ctx.closePath();
  ctx.fill();
  // Centreline dashes and threshold bars.
  ctx.fillStyle = '#f2f2e8';
  for (let s = -halfL + 200; s < halfL - 100; s += 320) {
    const a = project(cam, { x: s, y: 15, z: -6 });
    const b = project(cam, { x: s + 160, y: 15, z: -6 });
    const c2 = project(cam, { x: s + 160, y: 15, z: 6 });
    const d2 = project(cam, { x: s, y: 15, z: 6 });
    if (!a || !b || !c2 || !d2) continue;
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.lineTo(c2.x, c2.y);
    ctx.lineTo(d2.x, d2.y);
    ctx.closePath();
    ctx.fill();
  }
}

function drawRings(ctx, cam, sortie, palette, timeSec) {
  const target = nextRing(sortie);
  for (const ring of sortie.rings) {
    if (ring.passed) continue;
    const centre = project(cam, ring);
    if (!centre) continue;
    const isNext = ring === target;
    // The ring faces the pilot flying its course: its plane spans the
    // course's lateral direction and the vertical.
    const hdg = (ring.heading * Math.PI) / 180;
    const latX = Math.cos(hdg);
    const latZ = -Math.sin(hdg);
    const edge = project(cam, { x: ring.x + latX * ring.r, y: ring.y, z: ring.z + latZ * ring.r });
    const top = project(cam, { x: ring.x, y: ring.y + ring.r, z: ring.z });
    if (!edge || !top) continue;
    const rx = Math.abs(edge.x - centre.x);
    const ry = Math.abs(top.y - centre.y);
    if (rx < 3 || ry < 3) continue;
    const pulse = isNext ? 1 + 0.08 * Math.sin(timeSec * 5) : 1;
    ctx.lineWidth = isNext ? 7 : 4;
    ctx.strokeStyle = isNext ? palette.ringNext : palette.ring;
    ctx.shadowColor = palette.ring;
    ctx.shadowBlur = isNext ? 22 : 8;
    ctx.beginPath();
    ctx.ellipse(centre.x, centre.y, rx * pulse, ry * pulse, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.shadowBlur = 0;
    if (isNext) {
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 20px system-ui, sans-serif';
      ctx.textAlign = 'center';
      const dist = Math.round(Math.hypot(ring.x - cam.x, ring.y - cam.y, ring.z - cam.z));
      ctx.fillText('RING ' + (ring.index + 1) + '  ·  ' + dist + ' ft', centre.x, centre.y - ry - 14);
    }
  }
}

// The Skylark from the chase camera: wings spread, tail high, nav lights
// lit. Banks with the roll, lifts a little with pitch.
function drawPlane(ctx, plane) {
  const cx = VIEW_W / 2;
  const cy = VIEW_H - 210 - plane.pitchDeg * 1.6;
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(-plane.rollDeg * DEG);
  const S = 1;
  // Main wings.
  ctx.fillStyle = '#d8433a';
  ctx.beginPath();
  ctx.moveTo(-150 * S, 6);
  ctx.lineTo(-30 * S, -8);
  ctx.lineTo(30 * S, -8);
  ctx.lineTo(150 * S, 6);
  ctx.lineTo(132 * S, 22);
  ctx.lineTo(-132 * S, 22);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#b93228';
  ctx.fillRect(-150 * S, 6, 300 * S, 5);
  // Fuselage, seen from behind and above: spine, canopy, tail.
  ctx.fillStyle = '#f2ede2';
  ctx.beginPath();
  ctx.moveTo(-16 * S, -64);
  ctx.quadraticCurveTo(-26 * S, 10, -14 * S, 52);
  ctx.lineTo(14 * S, 52);
  ctx.quadraticCurveTo(26 * S, 10, 16 * S, -64);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#2f6fb8';
  ctx.beginPath();
  ctx.ellipse(0, -18, 13 * S, 20 * S, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.55)';
  ctx.beginPath();
  ctx.ellipse(-4, -24, 5 * S, 9 * S, 0, 0, Math.PI * 2);
  ctx.fill();
  // Tailplane and fin.
  ctx.fillStyle = '#d8433a';
  ctx.beginPath();
  ctx.moveTo(-58 * S, 46);
  ctx.lineTo(58 * S, 46);
  ctx.lineTo(48 * S, 58);
  ctx.lineTo(-48 * S, 58);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#d8433a';
  ctx.beginPath();
  ctx.moveTo(0, 30);
  ctx.lineTo(10 * S, 62);
  ctx.lineTo(-10 * S, 62);
  ctx.closePath();
  ctx.fill();
  // Registration on the wing, and lit nav lights.
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 15px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('SKYLARK', 0, 18);
  ctx.shadowBlur = 12;
  ctx.shadowColor = '#ff2e2e';
  ctx.fillStyle = '#ff4d4d';
  ctx.beginPath();
  ctx.arc(-150 * S, 14, 5, 0, Math.PI * 2);
  ctx.fill();
  ctx.shadowColor = '#2eff5e';
  ctx.fillStyle = '#37ff6a';
  ctx.beginPath();
  ctx.arc(150 * S, 14, 5, 0, Math.PI * 2);
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.restore();
}

// --- HUD: lit instruments on dark glass panels. ---

function panel(ctx, x, y, w, h) {
  ctx.fillStyle = 'rgba(10, 16, 26, 0.62)';
  ctx.strokeStyle = 'rgba(120, 200, 255, 0.45)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, 8);
  ctx.fill();
  ctx.stroke();
}

function hudText(ctx, label, value, unit, x, y, align) {
  ctx.textAlign = align || 'left';
  ctx.fillStyle = '#8fb8d8';
  ctx.font = '11px system-ui, sans-serif';
  ctx.fillText(label, x, y);
  ctx.fillStyle = '#eaf6ff';
  ctx.font = 'bold 26px system-ui, sans-serif';
  ctx.fillText(value, x, y + 28);
  ctx.fillStyle = '#8fb8d8';
  ctx.font = '11px system-ui, sans-serif';
  ctx.fillText(unit, x + (align === 'right' ? -2 : 0), y + 44);
}

export function drawHUD(ctx, game) {
  const plane = game.plane;
  const sortie = game.sortie;
  const palette = PALETTES[sortie.mission.palette];
  ctx.save();
  ctx.shadowColor = 'rgba(120, 200, 255, 0.8)';
  ctx.shadowBlur = 6;
  // Top-left: altitude and vertical speed.
  panel(ctx, 16, 14, 210, 74);
  hudText(ctx, 'ALTITUDE', String(Math.round(plane.y)), 'ft  ·  VS ' + (plane.verticalSpeedFps >= 0 ? '+' : '') + Math.round(plane.verticalSpeedFps) + ' ft/s', 30, 32);
  // Top-right: speed and throttle.
  panel(ctx, VIEW_W - 226, 14, 210, 74);
  hudText(ctx, 'AIRSPEED', String(Math.round(plane.speedKts)), 'kts', VIEW_W - 30, 32, 'right');
  ctx.fillStyle = '#12303f';
  ctx.fillRect(VIEW_W - 212, 66, 182, 8);
  ctx.fillStyle = plane.throttle > 0.85 ? '#ffb02e' : '#37c8ff';
  ctx.fillRect(VIEW_W - 212, 66, 182 * plane.throttle, 8);
  ctx.fillStyle = '#8fb8d8';
  ctx.font = '11px system-ui, sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText('THR ' + Math.round(plane.throttle * 100) + '%', VIEW_W - 212, 82);
  // Top-centre: heading compass tape.
  panel(ctx, VIEW_W / 2 - 190, 14, 380, 56);
  const hdg = plane.headingDeg;
  ctx.fillStyle = '#8fb8d8';
  ctx.font = '11px system-ui, sans-serif';
  ctx.textAlign = 'center';
  const dirs = [[0, 'N'], [45, 'NE'], [90, 'E'], [135, 'SE'], [180, 'S'], [225, 'SW'], [270, 'W'], [315, 'NW']];
  for (const [deg, name] of dirs) {
    let d = angleDiff(deg, hdg);
    if (Math.abs(d) > 55) continue;
    const x = VIEW_W / 2 + d * 2.6;
    ctx.fillText(name, x, 40);
    ctx.fillRect(x - 0.5, 46, 1, 8);
  }
  ctx.fillStyle = '#ffe066';
  ctx.font = 'bold 20px system-ui, sans-serif';
  ctx.fillText(String(Math.round(hdg)).padStart(3, '0') + '°', VIEW_W / 2, 66);
  ctx.fillStyle = '#ffe066';
  ctx.beginPath();
  ctx.moveTo(VIEW_W / 2 - 6, 16);
  ctx.lineTo(VIEW_W / 2 + 6, 16);
  ctx.lineTo(VIEW_W / 2, 26);
  ctx.closePath();
  ctx.fill();
  ctx.shadowBlur = 0;
  // Left: fuel gauge.
  panel(ctx, 16, 104, 54, 190);
  ctx.fillStyle = '#8fb8d8';
  ctx.font = '11px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('FUEL', 43, 122);
  ctx.fillStyle = '#12303f';
  ctx.fillRect(28, 130, 30, 140);
  const fuelH = 140 * (plane.fuel / 100);
  ctx.fillStyle = plane.fuel < 20 ? '#ff5a3c' : '#37c8ff';
  ctx.fillRect(28, 130 + (140 - fuelH), 30, fuelH);
  ctx.fillStyle = '#eaf6ff';
  ctx.font = 'bold 15px system-ui, sans-serif';
  ctx.fillText(Math.round(plane.fuel) + '%', 43, 288);
  // Right: artificial horizon.
  panel(ctx, VIEW_W - 170, 104, 154, 154);
  const hx = VIEW_W - 93;
  const hy = 181;
  ctx.save();
  ctx.beginPath();
  ctx.arc(hx, hy, 58, 0, Math.PI * 2);
  ctx.clip();
  ctx.translate(hx, hy);
  ctx.rotate(-plane.rollDeg * DEG);
  ctx.translate(0, plane.pitchDeg * 1.2);
  ctx.fillStyle = '#2f6fb8';
  ctx.fillRect(-70, -70, 140, 70);
  ctx.fillStyle = '#8a6a45';
  ctx.fillRect(-70, 0, 140, 70);
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(-70, -1, 140, 2);
  ctx.restore();
  ctx.strokeStyle = '#8fb8d8';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.arc(hx, hy, 58, 0, Math.PI * 2);
  ctx.stroke();
  ctx.fillStyle = '#ffe066';
  ctx.fillRect(hx - 18, hy - 2, 36, 4);
  ctx.fillStyle = '#8fb8d8';
  ctx.font = '11px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('ATTITUDE', hx, 252);
  // Bottom-left: mission, rings, score, time.
  panel(ctx, 16, VIEW_H - 96, 300, 80);
  ctx.textAlign = 'left';
  ctx.fillStyle = '#8fb8d8';
  ctx.font = '11px system-ui, sans-serif';
  ctx.fillText(sortie.mission.name.toUpperCase(), 30, VIEW_H - 74);
  ctx.fillStyle = '#eaf6ff';
  ctx.font = 'bold 22px system-ui, sans-serif';
  ctx.fillText('RINGS ' + sortie.ringsHit + '/' + sortie.rings.length + '   SCORE ' + sortie.score, 30, VIEW_H - 46);
  ctx.fillStyle = '#8fb8d8';
  ctx.font = '12px system-ui, sans-serif';
  const mm = String(Math.floor(sortie.timeSec / 60)).padStart(2, '0');
  const ss = String(Math.floor(sortie.timeSec % 60)).padStart(2, '0');
  ctx.fillText('TIME ' + mm + ':' + ss + (sortie.status === 'flying' && sortie.nextRing >= sortie.rings.length ? '  ·  ALL RINGS — LAND ON RUNWAY 09' : ''), 30, VIEW_H - 28);
  // Bottom-right: next-ring bearing.
  const target = nextRing(sortie);
  panel(ctx, VIEW_W - 316, VIEW_H - 96, 300, 80);
  if (target) {
    const dx = target.x - plane.x;
    const dz = target.z - plane.z;
    const bearing = (Math.atan2(dx, dz) / DEG + 360) % 360;
    const rel = angleDiff(bearing, plane.headingDeg);
    ctx.save();
    ctx.translate(VIEW_W - 270, VIEW_H - 56);
    ctx.rotate(rel * DEG);
    ctx.fillStyle = '#ffe066';
    ctx.beginPath();
    ctx.moveTo(0, -18);
    ctx.lineTo(12, 12);
    ctx.lineTo(-12, 12);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
    ctx.fillStyle = '#eaf6ff';
    ctx.font = 'bold 20px system-ui, sans-serif';
    ctx.textAlign = 'left';
    const distFt = Math.round(Math.hypot(dx, target.y - plane.y, dz));
    ctx.fillText((distFt / 6076).toFixed(1) + ' nm to ring ' + (target.index + 1), VIEW_W - 236, VIEW_H - 50);
    ctx.fillStyle = '#8fb8d8';
    ctx.font = '12px system-ui, sans-serif';
    ctx.fillText(rel === 0 ? 'straight ahead' : (rel > 0 ? 'turn right ' : 'turn left ') + Math.abs(Math.round(rel)) + '°', VIEW_W - 236, VIEW_H - 30);
  } else {
    ctx.fillStyle = '#eaf6ff';
    ctx.font = 'bold 20px system-ui, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('All rings flown — land!', VIEW_W - 300, VIEW_H - 50);
  }
  // Warnings.
  ctx.textAlign = 'center';
  if (plane.stalled) {
    ctx.fillStyle = '#ff5a3c';
    ctx.font = 'bold 30px system-ui, sans-serif';
    ctx.fillText('STALL — NOSE DOWN, THROTTLE UP', VIEW_W / 2, 150);
  } else if (plane.fuel < 20 && plane.fuel > 0) {
    ctx.fillStyle = '#ffb02e';
    ctx.font = 'bold 24px system-ui, sans-serif';
    ctx.fillText('LOW FUEL', VIEW_W / 2, 150);
  } else if (plane.fuel <= 0) {
    ctx.fillStyle = '#ff5a3c';
    ctx.font = 'bold 24px system-ui, sans-serif';
    ctx.fillText('OUT OF FUEL — GLIDE TO THE RUNWAY', VIEW_W / 2, 150);
  }
  // Flash message.
  if (game.flash && game.timeSec < game.flashUntil) {
    ctx.fillStyle = '#ffe066';
    ctx.font = 'bold 28px system-ui, sans-serif';
    ctx.fillText(game.flash, VIEW_W / 2, 200);
  }
}

// --- Screens ---

function button(ctx, rect, label, active) {
  ctx.fillStyle = active ? '#ffb02e' : 'rgba(10, 16, 26, 0.72)';
  ctx.strokeStyle = active ? '#ffe066' : 'rgba(120, 200, 255, 0.6)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.roundRect(rect.x, rect.y, rect.w, rect.h, 10);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = active ? '#1a1206' : '#eaf6ff';
  ctx.font = 'bold 22px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(label, rect.x + rect.w / 2, rect.y + rect.h / 2 + 8);
}

export function drawTitle(ctx, game) {
  const palette = PALETTES.dawn;
  drawSky(ctx, palette, { pitchDeg: 0 });
  ctx.fillStyle = 'rgba(10, 16, 26, 0.35)';
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#ffe066';
  ctx.font = 'bold 84px system-ui, sans-serif';
  ctx.shadowColor = 'rgba(0,0,0,0.5)';
  ctx.shadowBlur = 18;
  ctx.fillText('SKYLARK RUN', VIEW_W / 2, 150);
  ctx.shadowBlur = 0;
  ctx.fillStyle = '#ffffff';
  ctx.font = '24px system-ui, sans-serif';
  ctx.fillText('A little red prop plane, three valleys, ten rings a sortie — fly it home.', VIEW_W / 2, 196);
  ctx.fillStyle = '#cfe8f7';
  ctx.font = '16px system-ui, sans-serif';
  ctx.fillText('Keyboard and mouse · no network · every sound synthesized in your browser', VIEW_W / 2, 226);
  const buttons = game.uiButtons;
  buttons.length = 0;
  const missions = game.missionList;
  missions.forEach((m, i) => {
    const rect = { x: VIEW_W / 2 - 260, y: 280 + i * 84, w: 520, h: 62, id: 'mission:' + m.id };
    buttons.push(rect);
    button(ctx, rect, m.name + '  ·  ' + m.rings + ' rings', game.hoverButton === rect.id);
    ctx.fillStyle = '#cfe8f7';
    ctx.font = '14px system-ui, sans-serif';
    ctx.fillText(game.bestStars[m.id] ? 'Best: ' + '★'.repeat(game.bestStars[m.id]) + '☆'.repeat(3 - game.bestStars[m.id]) : 'Not flown yet', VIEW_W / 2, 280 + i * 84 + 82);
  });
  ctx.fillStyle = '#eaf6ff';
  ctx.font = '15px system-ui, sans-serif';
  ctx.fillText('W/S throttle · ↑/↓ pitch · ←/→ bank and turn · Space flaps · P pause · M mute', VIEW_W / 2, 560);
  ctx.fillText('Fly through every ring, then land gently on runway 09. Smooth landings pay best.', VIEW_W / 2, 586);
  ctx.fillStyle = '#8fb8d8';
  ctx.font = '13px system-ui, sans-serif';
  ctx.fillText('An original game built for the make.fun best flight game bounty.', VIEW_W / 2, 640);
}

export function drawBriefing(ctx, game) {
  const m = game.pendingMission;
  const palette = PALETTES[m.palette];
  drawSky(ctx, palette, { pitchDeg: 0 });
  ctx.fillStyle = 'rgba(10, 16, 26, 0.45)';
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#ffe066';
  ctx.font = 'bold 56px system-ui, sans-serif';
  ctx.fillText(m.name.toUpperCase(), VIEW_W / 2, 170);
  ctx.fillStyle = '#ffffff';
  ctx.font = '20px system-ui, sans-serif';
  wrapText(ctx, m.brief, VIEW_W / 2, 230, 760, 30);
  ctx.fillStyle = '#cfe8f7';
  ctx.font = '18px system-ui, sans-serif';
  ctx.fillText(m.rings + ' rings  ·  fuel ' + m.fuel + '%  ·  wind ' + m.windKts + ' kts, gusts to ' + (m.windKts + m.gustKts) + ' kts', VIEW_W / 2, 340);
  ctx.fillText('Take off from runway 09, fly the rings in order, land back on 09.', VIEW_W / 2, 372);
  const buttons = game.uiButtons;
  buttons.length = 0;
  const start = { x: VIEW_W / 2 - 160, y: 430, w: 320, h: 64, id: 'start' };
  const back = { x: VIEW_W / 2 - 160, y: 512, w: 320, h: 56, id: 'back' };
  buttons.push(start, back);
  button(ctx, start, 'TAKE OFF', game.hoverButton === 'start');
  button(ctx, back, 'Back to menu', game.hoverButton === 'back');
}

function wrapText(ctx, text, cx, y, maxW, lh) {
  const words = text.split(' ');
  const lines = [''];
  for (const w of words) {
    const test = lines[lines.length - 1] ? lines[lines.length - 1] + ' ' + w : w;
    if (ctx.measureText(test).width > maxW) lines.push(w);
    else lines[lines.length - 1] = test;
  }
  lines.forEach((line, i) => ctx.fillText(line, cx, y + i * lh));
}

export function drawPause(ctx, game) {
  ctx.fillStyle = 'rgba(6, 10, 18, 0.6)';
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#ffe066';
  ctx.font = 'bold 52px system-ui, sans-serif';
  ctx.fillText('PAUSED', VIEW_W / 2, 300);
  ctx.fillStyle = '#ffffff';
  ctx.font = '20px system-ui, sans-serif';
  ctx.fillText('P to resume · R to restart the sortie · M to mute', VIEW_W / 2, 350);
  const buttons = game.uiButtons;
  buttons.length = 0;
  const resume = { x: VIEW_W / 2 - 160, y: 400, w: 320, h: 60, id: 'resume' };
  const quit = { x: VIEW_W / 2 - 160, y: 476, w: 320, h: 56, id: 'quit' };
  buttons.push(resume, quit);
  button(ctx, resume, 'Resume', game.hoverButton === 'resume');
  button(ctx, quit, 'Quit to menu', game.hoverButton === 'quit');
}

export function drawSortieEnd(ctx, game) {
  const sortie = game.sortie;
  const crashed = sortie.status === 'crashed';
  ctx.fillStyle = crashed ? 'rgba(40, 8, 6, 0.72)' : 'rgba(6, 18, 10, 0.66)';
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  ctx.textAlign = 'center';
  ctx.fillStyle = crashed ? '#ff5a3c' : '#ffe066';
  ctx.font = 'bold 56px system-ui, sans-serif';
  ctx.fillText(crashed ? 'DOWN IN THE VALLEY' : 'WHEELS DOWN — SORTIE COMPLETE', VIEW_W / 2, 180);
  ctx.fillStyle = '#ffffff';
  ctx.font = '22px system-ui, sans-serif';
  const lines = crashed
    ? ['The Skylark came down short of the runway. The valley keeps her — this time.']
    : ['Rings ' + sortie.ringsHit + '/' + sortie.rings.length + '  ·  landing quality ' + Math.round(sortie.landingQuality * 100) + '%  ·  fuel left ' + Math.round(game.plane.fuel) + '%'];
  lines.forEach((l, i) => ctx.fillText(l, VIEW_W / 2, 240 + i * 32));
  ctx.fillStyle = '#ffe066';
  ctx.font = 'bold 30px system-ui, sans-serif';
  ctx.fillText('SCORE ' + sortie.score + '   ' + '★'.repeat(game.starsEarned) + '☆'.repeat(3 - game.starsEarned), VIEW_W / 2, 320);
  const buttons = game.uiButtons;
  buttons.length = 0;
  const retry = { x: VIEW_W / 2 - 340, y: 400, w: 210, h: 60, id: 'retry' };
  const next = { x: VIEW_W / 2 - 105, y: 400, w: 210, h: 60, id: 'next' };
  const menu = { x: VIEW_W / 2 + 130, y: 400, w: 210, h: 60, id: 'menu' };
  buttons.push(retry, next, menu);
  button(ctx, retry, 'Fly again', game.hoverButton === 'retry');
  button(ctx, next, 'Next sortie', game.hoverButton === 'next');
  button(ctx, menu, 'Menu', game.hoverButton === 'menu');
}

// The in-flight frame: world (rolled with the plane) then the plane, then
// the unrotated HUD.
export function drawFlight(ctx, game) {
  const plane = game.plane;
  const sortie = game.sortie;
  const palette = PALETTES[sortie.mission.palette];
  const cam = cameraFor(plane);
  ctx.save();
  ctx.translate(VIEW_W / 2, VIEW_H / 2);
  ctx.rotate(-plane.rollDeg * DEG * 0.9);
  ctx.translate(-VIEW_W / 2, -VIEW_H / 2);
  drawSky(ctx, palette, plane);
  drawMountains(ctx, palette, plane);
  drawClouds(ctx, cam, palette);
  drawTerrain(ctx, cam, palette);
  drawRunway(ctx, cam, palette);
  drawRings(ctx, cam, sortie, palette, game.timeSec);
  ctx.restore();
  drawPlane(ctx, plane);
  drawHUD(ctx, game);
}
