// Initialize the simulation
async function init() {
  canvas = document.getElementById('canvas');
  W = window.innerWidth;
  H = window.innerHeight;
  engine = Engine.create({
    enableSleeping: false,
    gravity: { y: 1.5, x: 0 },
    timing: { timeScale: 1.0 }
  });
  world = engine.world;
  addStartWall();
  updateTerrain(START_X);
  createCar(START_X);
  setUpCollisionSound();
  setUpImpactDust();
  await initRenderer();
  zoom = defaultZoom();
  updateCameraPosition(0);
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
      // Ground under the car must exist before physics runs
      updateTerrain(car.chassis.position.x);
      for (var i = 0; i < n; i++) {
        updateCarMotor(h);
        updateDampers(h);
        applyWater(h);
        Engine.update(engine, h);
      }
      updateEffects(simMs);
      removeLostBoxes();
      updateDistance();
      updateCameraPosition(Math.min(now - last, 100));
    }
    last = now;
    updateEngineSound();
    draw();
    requestAnimationFrame(loop);
  }
  requestAnimationFrame(loop);
}

// Start when page is loaded
window.addEventListener('load', init);
