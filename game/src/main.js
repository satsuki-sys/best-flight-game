// main.js — boot the Skylark: wire the canvas to the game, run the loop,
// and stage a screenshot scene when the page loads with ?shot=<name>.
import { VIEW_W, VIEW_H } from './config.js';
import { createGame, updateGame, drawGame } from './game.js';
import { stageShot } from './shots.js';

const canvas = document.getElementById('game');
canvas.width = VIEW_W;
canvas.height = VIEW_H;

const game = createGame(canvas);
window.__game = game;

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
if (shot) {
  stageShot(game, shot);
  drawGame(game);
  window.__shotReady = true;
} else {
  let last = performance.now();
  function frame(now) {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    updateGame(game, dt);
    drawGame(game);
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
  window.__shotReady = true;
}
