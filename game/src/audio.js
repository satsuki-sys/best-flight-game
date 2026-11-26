// audio.js — every sound the game makes is synthesized with WebAudio:
// an engine drone that follows the throttle, a chime for a ring, wind
// that rises with speed, and a thud for touchdown. No audio files.
export function createAudio() {
  return {
    ctx: null,
    muted: false,
    engineOsc: null,
    engineGain: null,
    windGain: null,
    windSrc: null,
    started: false,
  };
}

function ensureContext(audio) {
  if (audio.ctx) return audio.ctx;
  const Ctx = window.AudioContext || window.webkitAudioContext;
  if (!Ctx) return null;
  audio.ctx = new Ctx();
  return audio.ctx;
}

// Start the engine and wind loops. Called on the first user gesture.
export function startAudio(audio) {
  const ctx = ensureContext(audio);
  if (!ctx || audio.started) return;
  audio.started = true;
  audio.engineOsc = ctx.createOscillator();
  audio.engineOsc.type = 'sawtooth';
  audio.engineOsc.frequency.value = 55;
  const engineFilter = ctx.createBiquadFilter();
  engineFilter.type = 'lowpass';
  engineFilter.frequency.value = 320;
  audio.engineGain = ctx.createGain();
  audio.engineGain.gain.value = 0.0;
  audio.engineOsc.connect(engineFilter);
  engineFilter.connect(audio.engineGain);
  audio.engineGain.connect(ctx.destination);
  audio.engineOsc.start();

  // Wind: looped filtered noise, gain follows airspeed.
  const len = ctx.sampleRate * 2;
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < len; i += 1) data[i] = Math.random() * 2 - 1;
  audio.windSrc = ctx.createBufferSource();
  audio.windSrc.buffer = buf;
  audio.windSrc.loop = true;
  const windFilter = ctx.createBiquadFilter();
  windFilter.type = 'bandpass';
  windFilter.frequency.value = 480;
  windFilter.Q.value = 0.6;
  audio.windGain = ctx.createGain();
  audio.windGain.gain.value = 0.0;
  audio.windSrc.connect(windFilter);
  windFilter.connect(audio.windGain);
  audio.windGain.connect(ctx.destination);
  audio.windSrc.start();
}

// Called every frame while flying: throttle sets the drone, speed the wind.
export function updateAudio(audio, plane) {
  if (!audio.ctx || !audio.started || audio.muted) {
    if (audio.engineGain) audio.engineGain.gain.value = 0;
    if (audio.windGain) audio.windGain.gain.value = 0;
    return;
  }
  const t = audio.ctx.currentTime;
  audio.engineOsc.frequency.setTargetAtTime(48 + plane.throttle * 70 + plane.speedKts * 0.25, t, 0.1);
  audio.engineGain.gain.setTargetAtTime(0.035 + plane.throttle * 0.05, t, 0.1);
  audio.windGain.gain.setTargetAtTime(Math.min(0.09, plane.speedKts * 0.00045), t, 0.15);
}

function blip(audio, freq, dur, vol, type) {
  if (!audio.ctx || audio.muted) return;
  const ctx = audio.ctx;
  const osc = ctx.createOscillator();
  osc.type = type || 'sine';
  osc.frequency.value = freq;
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(vol, ctx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + dur);
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start();
  osc.stop(ctx.currentTime + dur);
}

export function playRingChime(audio) {
  blip(audio, 880, 0.35, 0.16);
  setTimeout(() => blip(audio, 1318, 0.4, 0.14), 90);
}

export function playThud(audio) {
  blip(audio, 90, 0.3, 0.25, 'triangle');
}

export function playCrash(audio) {
  blip(audio, 55, 0.8, 0.3, 'sawtooth');
  blip(audio, 40, 1.0, 0.2, 'square');
}

export function playClick(audio) {
  blip(audio, 660, 0.08, 0.08);
}

export function setMuted(audio, muted) {
  audio.muted = muted;
  if (muted) updateAudio(audio, { throttle: 0, speedKts: 0 });
}
