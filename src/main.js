// Initialize the simulation
function init() {
  canvas = document.getElementById('canvas');
  ctx = canvas.getContext('2d');
  W = window.innerWidth;
  H = window.innerHeight;
  canvas.width = W;
  canvas.height = H;
  countEl = document.getElementById('count');
  engine = Engine.create({
    enableSleeping: false,
    gravity: { y: 1.5, x: 0 },
    timing: { timeScale: 1.0 }
  });
  world = engine.world;
  addWalls();
  createCar();
  setUpCollisionSound();
  setUpCanvas();
  startLoop();
}

// Start the main loop: physics runs in fixed steps, independent of the display refresh rate
function startLoop() {
  var acc = 0;
  var last = null;
  function loop(now) {
    if (last !== null) {
      // Cap the catch-up after a stalled or hidden tab
      acc += Math.min(now - last, 250);
    }
    last = now;
    while (acc >= STEP_MS) {
      updateCarMotor();
      Engine.update(engine, STEP_MS);
      acc -= STEP_MS;
    }
    updateEngineSound();
    updateCameraPosition();
    draw();
    requestAnimationFrame(loop);
  }
  requestAnimationFrame(loop);
}

// Start when page is loaded
window.addEventListener('load', init);
