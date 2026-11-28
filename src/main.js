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
  setUpImpactDust();
  setUpCanvas();
  startLoop();
}

// Start the main loop. Every frame advances the simulation by exactly the real time that has
// passed (times SIM_SPEED), split into equal substeps of at most MAX_STEP_MS. Motion is smooth
// on any refresh rate and runs at the same speed everywhere.
function startLoop() {
  var last = null;
  function loop(now) {
    if (last !== null) {
      // Cap the jump after a stalled or hidden tab
      var simMs = Math.min(now - last, 100) * SIM_SPEED;
      var n = Math.ceil(simMs / MAX_STEP_MS);
      var h = simMs / n;
      for (var i = 0; i < n; i++) {
        updateCarMotor(h);
        Engine.update(engine, h);
      }
      updateEffects(simMs);
    }
    last = now;
    updateEngineSound();
    updateCameraPosition();
    draw();
    requestAnimationFrame(loop);
  }
  requestAnimationFrame(loop);
}

// Start when page is loaded
window.addEventListener('load', init);
