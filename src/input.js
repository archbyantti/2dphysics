// Help text shown in the info panel
var HELP_TEXT = 'Arrows: drive | Space: brake | R: reset car | Left mouse: create box | ' +
  'Shift+click: remove box | Drag: pan view | Ctrl+scroll: zoom | C: toggle car centering';

// Set up canvas event listeners
function setUpCanvas() {
  window.addEventListener('resize', handleResize);
  canvas.addEventListener('mousedown', handleMouseDown);
  canvas.addEventListener('mouseup', handleMouseUp);
  canvas.addEventListener('mousemove', handleMouseMove);
  canvas.addEventListener('wheel', handleWheel, { passive: false });
  canvas.addEventListener('keydown', handleKeyDown);
  canvas.addEventListener('keyup', handleKeyUp);
}

// Handle window resize
function handleResize() {
  W = window.innerWidth;
  H = window.innerHeight;
  resizeRenderer();
}

// Handle mouse press
function handleMouseDown(e) {
  mousedown = true;
  lastMp = { x: e.clientX, y: e.clientY };
  // Shift+click removes box at position
  if (e.shiftKey) {
    removeBoxAt(e.clientX, e.clientY);
    return;
  }
  // Ignore middle and right buttons for spawning
  if (e.button === 1 || e.button === 2) {
    return;
  }
}

// Handle mouse release - spawn box
function handleMouseUp(e) {
  mousedown = false;
  // Left click without modifiers spawns a box
  if (e.button === 0 && !(e.ctrlKey || e.shiftKey)) {
    var worldPos = screenToWorld(e.clientX, e.clientY);
    addBox(worldPos.x, worldPos.y);
  }
}

// Handle mouse drag for panning
function handleMouseMove(e) {
  if (!mousedown) return;
  var dx = e.clientX - lastMp.x, dy = e.clientY - lastMp.y;
  if (dx !== 0 || dy !== 0) {
    panOffset.x += dx;
    panOffset.y += dy;
  }
  lastMp = { x: e.clientX, y: e.clientY };
}

// Handle keyboard input for car controls
function handleKeyDown(e) {
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
  var zoomFactor = e.deltaY > 0 ? 0.9 : 1.1;
  var mouseWorldX = (e.clientX - panOffset.x) / zoom;
  var mouseWorldY = (e.clientY - panOffset.y) / zoom;
  zoom *= zoomFactor;
  zoom = Math.max(0.1, Math.min(5, zoom));
  if (!centerCar) {
    panOffset.x = e.clientX - mouseWorldX * zoom;
    panOffset.y = e.clientY - mouseWorldY * zoom;
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
