// Help text shown in the info panel
var HELP_TEXT = 'Arrows: drive | Space: brake | R: reset car | Drag: pan view | Ctrl+scroll: zoom | ' +
  'C: toggle car centering';

// Phones and tablets (or ?touch=1) get on-screen pedals instead of the keyboard help
var isTouch = window.matchMedia('(pointer: coarse)').matches || /[?&]touch=1/.test(location.search);

// Starting zoom: the desktop default, smaller on small screens so enough of the road ahead shows
function defaultZoom() {
  return Math.max(0.45, Math.min(0.8, W / 1600, H / 820));
}

// Set up canvas event listeners. Pointer events cover mouse, touch and pen alike.
function setUpCanvas() {
  window.addEventListener('resize', handleResize);
  canvas.addEventListener('pointerdown', handlePointerDown);
  canvas.addEventListener('pointermove', handlePointerMove);
  canvas.addEventListener('pointerup', handlePointerUp);
  canvas.addEventListener('pointercancel', handlePointerUp);
  canvas.addEventListener('wheel', handleWheel, { passive: false });
  canvas.addEventListener('contextmenu', function (e) { e.preventDefault(); });
  setUpTouchControls();
  // Keys go to the whole window, so the car drives right after load without clicking the canvas first
  window.addEventListener('keydown', handleKeyDown);
  window.addEventListener('keyup', handleKeyUp);
  // Releasing all keys when the window loses focus avoids a stuck throttle
  window.addEventListener('blur', function () { input.accel = input.rev = input.brake = false; });
  document.addEventListener('visibilitychange', function () {
    if (document.hidden) input.accel = input.rev = input.brake = false;
  });
}

// Handle window resize
function handleResize() {
  W = window.innerWidth;
  H = window.innerHeight;
  resizeRenderer();
}

// Pointers down on the canvas (id -> screen position). One pointer pans; two pinch-zoom.
var pointers = new Map();
var pinch = null;        // { dist, zoom } when the second finger came down

// Distance and midpoint of the first two pointers
function pinchState() {
  var p = Array.from(pointers.values());
  var dx = p[1].x - p[0].x, dy = p[1].y - p[0].y;
  return { dist: Math.sqrt(dx * dx + dy * dy) || 1, x: (p[0].x + p[1].x) / 2, y: (p[0].y + p[1].y) / 2 };
}

// Keep receiving a pointer's events after it leaves the element (fails harmlessly for synthetic events)
function capturePointer(el, id) {
  try { el.setPointerCapture(id); } catch (err) { /* No active pointer with this id */ }
}

function handlePointerDown(e) {
  capturePointer(canvas, e.pointerId);
  pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
  if (pointers.size === 1) {
    mousedown = true;
    lastMp = { x: e.clientX, y: e.clientY };
  } else if (pointers.size === 2) {
    pinch = { dist: pinchState().dist, zoom: zoom };
  }
}

function handlePointerMove(e) {
  if (!pointers.has(e.pointerId)) return;
  pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
  if (pinch && pointers.size >= 2) {
    var st = pinchState();
    zoomAt(st.x, st.y, pinch.zoom * st.dist / pinch.dist);
    return;
  }
  if (!mousedown) return;
  var dx = e.clientX - lastMp.x, dy = e.clientY - lastMp.y;
  panOffset.x += dx;
  panOffset.y += dy;
  lastMp = { x: e.clientX, y: e.clientY };
}

function handlePointerUp(e) {
  if (!pointers.has(e.pointerId)) return;
  pointers.delete(e.pointerId);
  if (pointers.size < 2) pinch = null;
  if (pointers.size === 1) {
    lastMp = Array.from(pointers.values())[0];  // Keep panning with the remaining finger, without a jump
  } else if (pointers.size === 0) {
    mousedown = false;
  }
}

// On-screen pedals for touch screens: GAS works like the Up arrow, BRAKE like the Down arrow (brakes
// while rolling forward, then reverses); the round arrow resets the car like R
function setUpTouchControls() {
  if (isTouch) document.body.classList.add('touch');
  var bind = function (id, key) {
    var el = document.getElementById(id);
    if (!el) return;
    var set = function (on) {
      return function (e) {
        e.preventDefault();
        if (on) capturePointer(el, e.pointerId);
        input[key] = on;
        el.classList.toggle('down', on);
      };
    };
    el.addEventListener('pointerdown', set(true));
    ['pointerup', 'pointercancel', 'lostpointercapture'].forEach(function (t) {
      el.addEventListener(t, set(false));
    });
    el.addEventListener('contextmenu', function (e) { e.preventDefault(); });
  };
  bind('btnGas', 'accel');
  bind('btnBrake', 'rev');
  var reset = document.getElementById('btnReset');
  if (reset) {
    reset.addEventListener('click', function () { resetCar(); });
    reset.addEventListener('contextmenu', function (e) { e.preventDefault(); });
  }
}

// Handle keyboard input for car controls
function handleKeyDown(e) {
  // Driving keys must not scroll the page or press a focused button
  if (e.code === 'ArrowUp' || e.code === 'ArrowDown' || e.code === 'Space') e.preventDefault();
  switch (e.code) {
    case 'ArrowUp': input.accel = true; break;
    case 'ArrowDown': input.rev = true; break;
    case 'Space': input.brake = true; break;
  }
}

function handleKeyUp(e) {
  switch (e.code) {
    case 'ArrowUp': input.accel = false; break;
    case 'ArrowDown': input.rev = false; break;
    case 'Space': input.brake = false; break;
    case 'KeyC': toggleCarCentering(); break;
    case 'KeyR': resetCar(); break;
  }
}

// Toggle car centering on/off
function toggleCarCentering() {
  centerCar = !centerCar;
  var status = centerCar ? ' (centering ON)' : ' (centering OFF)';
  document.getElementById('info').textContent = HELP_TEXT + status;
}

// Handle mouse wheel for zoom (Ctrl or Cmd + scroll)
function handleWheel(e) {
  e.preventDefault();
  if (!(e.ctrlKey || e.metaKey)) return;
  zoomAt(e.clientX, e.clientY, zoom * (e.deltaY > 0 ? 0.9 : 1.1));
}

// Set the zoom, keeping the world point under screen (sx, sy) in place (when the camera is not following)
function zoomAt(sx, sy, z) {
  var wx = (sx - panOffset.x) / zoom, wy = (sy - panOffset.y) / zoom;
  zoom = Math.max(0.1, Math.min(5, z));
  if (!centerCar) {
    panOffset.x = sx - wx * zoom;
    panOffset.y = sy - wy * zoom;
  }
}

// Camera follow state: a smoothed look-ahead (world px) and whether to jump straight to the target
var camAhead = 0;
var camSnap = true;

// Follow the car smoothly when centering is on. The car sits a bit left of center and the view
// leads in the driving direction, so you can see the hills coming. `ms` is real frame time.
function updateCameraPosition(ms) {
  if (!car || !centerCar) return;
  var p = car.chassis.position;
  var v = Matter.Body.getVelocity(car.chassis);
  var aheadTarget = Math.max(-350, Math.min(350, v.x * 30));
  var tx, ty;
  if (camSnap) {
    camAhead = aheadTarget;
  } else {
    camAhead += (aheadTarget - camAhead) * (1 - Math.exp(-ms / 900));
  }
  tx = W * 0.5 - (p.x + camAhead) * zoom;
  ty = H * 0.62 - p.y * zoom;
  if (camSnap) {
    panOffset.x = tx;
    panOffset.y = ty;
    camSnap = false;
    return;
  }
  var a = 1 - Math.exp(-ms / 180);
  panOffset.x += (tx - panOffset.x) * a;
  panOffset.y += (ty - panOffset.y) * a;
}
