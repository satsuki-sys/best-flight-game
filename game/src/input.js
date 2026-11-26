// input.js — keyboard and mouse, kept as plain state the game reads each
// frame. Keys are tracked by code so layouts do not matter; the mouse
// steers in flight when dragged and clicks menus everywhere else.
export function createInput() {
  return {
    keys: new Set(),
    mouseX: 0,
    mouseY: 0,
    mouseDown: false,
    dragDX: 0,
    dragDY: 0,
    clicked: null, // { x, y } consumed by the game each frame
    pressed: new Set(), // codes pressed since last frame (edge-triggered)
  };
}

export function attachInput(input, element) {
  function onKeyDown(e) {
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) {
      e.preventDefault();
    }
    if (!e.repeat) input.pressed.add(e.code);
    input.keys.add(e.code);
  }
  function onKeyUp(e) {
    input.keys.delete(e.code);
  }
  function onPointerDown(e) {
    input.mouseDown = true;
    input.mouseX = e.offsetX;
    input.mouseY = e.offsetY;
    input.clicked = { x: e.offsetX, y: e.offsetY };
  }
  function onPointerMove(e) {
    const nx = e.offsetX;
    const ny = e.offsetY;
    if (input.mouseDown) {
      input.dragDX += nx - input.mouseX;
      input.dragDY += ny - input.mouseY;
    }
    input.mouseX = nx;
    input.mouseY = ny;
  }
  function onPointerUp() {
    input.mouseDown = false;
  }
  element.addEventListener('keydown', onKeyDown);
  element.addEventListener('keyup', onKeyUp);
  element.addEventListener('pointerdown', onPointerDown);
  element.addEventListener('pointermove', onPointerMove);
  element.addEventListener('pointerup', onPointerUp);
  element.tabIndex = 0;
  element.focus();
}

// Read the flight controls from the current input state. Mouse drag adds
// to the keyboard demand and fades as the drag ends.
export function readControls(input) {
  const k = input.keys;
  const ctl = {
    pitch: 0,
    roll: 0,
    throttle: 0,
    flaps: k.has('Space'),
  };
  if (k.has('ArrowUp')) ctl.pitch += 1;
  if (k.has('ArrowDown')) ctl.pitch -= 1;
  if (k.has('ArrowLeft')) ctl.roll -= 1;
  if (k.has('ArrowRight')) ctl.roll += 1;
  if (k.has('KeyW')) ctl.throttle += 1;
  if (k.has('KeyS')) ctl.throttle -= 1;
  // Mouse steer: drag up to climb, sideways to bank.
  ctl.pitch += Math.max(-1, Math.min(1, -input.dragDY / 90));
  ctl.roll += Math.max(-1, Math.min(1, input.dragDX / 90));
  ctl.pitch = Math.max(-1, Math.min(1, ctl.pitch));
  ctl.roll = Math.max(-1, Math.min(1, ctl.roll));
  // Drag demand decays so the stick centres when the mouse stops.
  input.dragDX *= 0.82;
  input.dragDY *= 0.82;
  return ctl;
}

// Edge-triggered keys: true once per press, then cleared by endFrame.
export function wasPressed(input, code) {
  return input.pressed.has(code);
}

export function endFrame(input) {
  input.pressed.clear();
  input.clicked = null;
}
