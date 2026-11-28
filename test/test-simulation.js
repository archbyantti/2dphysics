// Smoke test for the simulation. Exits with code 1 if any check fails.
// Run from the repo root: npm test
const path = require('path');
const { pathToFileURL } = require('url');
const { chromium } = require('@playwright/test');

const PAGE_URL = pathToFileURL(path.resolve(__dirname, '../src/index.html')).href;
const SHOT_DIR = path.resolve(__dirname, 'screenshots');

const failures = [];
function check(name, ok, detail) {
  console.log((ok ? 'PASS ' : 'FAIL ') + name + (detail !== undefined ? ' (' + detail + ')' : ''));
  if (!ok) failures.push(name);
}

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });

  const errors = [];
  page.on('console', (msg) => { if (msg.type() === 'error') errors.push(msg.text()); });
  page.on('pageerror', (err) => errors.push(err.message));

  await page.goto(PAGE_URL, { waitUntil: 'networkidle' });
  await page.waitForFunction(() => typeof engine !== 'undefined' && engine && car);

  check('canvas exists', await page.locator('canvas').count() === 1);

  // The car settles on the terrain at the start.
  await page.waitForTimeout(600);
  const gap = await page.evaluate(() => Math.min.apply(null, car.wheels.map((w) =>
    groundHeightAt(w.position.x) - (w.position.y + car.wheelR))));
  check('car rests on the ground', Math.abs(gap) < 8, gap.toFixed(1) + ' px');

  // The car drives right after load, before anything on the page was clicked or focused.
  const startX = await page.evaluate(() => car.chassis.position.x);
  await page.keyboard.down('ArrowUp');
  await page.waitForTimeout(500);
  await page.keyboard.up('ArrowUp');
  const movedAtLoad = await page.evaluate((x) => car.chassis.position.x - x, startX);
  check('car drives without clicking first', movedAtLoad > 20, Math.round(movedAtLoad) + ' px');
  await page.keyboard.down('Space');
  await page.waitForTimeout(1500);
  await page.keyboard.up('Space');

  // Record impact sounds ('knock' or 'thump') by wrapping the global the collision handler calls.
  await page.evaluate(() => {
    window.__sounds = [];
    var orig = playCollisionSound;
    playCollisionSound = function (kind) { window.__sounds.push(kind); orig.apply(this, arguments); };
  });
  const soundCount = (kind) => page.evaluate((k) => window.__sounds.filter((s) => s === k).length, kind);

  // A click on the canvas no longer drops a box, and there is no box counter.
  await page.mouse.click(820, 120);
  check('a click does not drop a box', await page.evaluate(() => boxes.length) === 0,
    await page.evaluate(() => boxes.length));
  check('no box counter', await page.locator('#count').count() === 0);

  // Boxes still exist in the engine (from code): drop five ahead of the car.
  await page.evaluate(() => {
    for (var i = 0; i < 5; i++) {
      var p = screenToWorld(820 + i * 80, 120);
      addBox(p.x, p.y);
    }
  });

  // Let the boxes fall and hit the ground.
  await page.waitForTimeout(1500);
  const knocks = await soundCount('knock');
  check('boxes landing make a knock', knocks > 0, knocks);

  // The car has a cabin that boxes can land on.
  check('car has a cabin', await page.evaluate(() => car.chassis.parts.length) === 3);
  await page.evaluate(() => {
    var cab = car.chassis.parts[2];
    addBox(cab.position.x, cab.bounds.min.y - 80);
  });
  // Shapes are random and may slide off afterwards, so check that the box touched down on the
  // roof (came to the roof line above the cabin) instead of falling through it.
  const onRoof = await page.waitForFunction(() => {
    var b = boxes[boxes.length - 1], cab = car.chassis.parts[2];
    return Math.abs(b.bounds.max.y - cab.bounds.min.y) < 6 &&
      b.position.x > cab.bounds.min.x && b.position.x < cab.bounds.max.x;
  }, null, { timeout: 1500, polling: 'raf' }).then(() => true, () => false);
  check('box lands on the cabin roof', onRoof);
  await page.waitForTimeout(500);

  // Drive right with the up arrow. Clear the test boxes first so they cannot block the car.
  await page.evaluate(() => {
    World.remove(world, boxes);
    boxes.length = 0;
  });
  await page.waitForTimeout(300);
  await page.evaluate(() => { window.__sounds.length = 0; });
  await page.locator('canvas').focus();
  const x0 = await page.evaluate(() => car.chassis.position.x);
  const idleRpm = await page.evaluate(() => car.engine.rpm);
  await page.keyboard.down('ArrowUp');
  await page.waitForTimeout(400);
  const revs = await page.evaluate(() => car.engine.rpm);
  check('engine revs up with throttle', revs > idleRpm + 1000, Math.round(idleRpm) + ' -> ' + Math.round(revs) + ' rpm');
  // Throttle makes exhaust smoke (back layer) and the tyres throw dirt (front layer).
  const fx = await page.evaluate(() => ({
    smoke: particles.filter((p) => p.layer === 'back').length,
    dirt: particles.filter((p) => p.layer === 'front').length,
    max: MAX_PARTICLES
  }));
  check('exhaust smoke while accelerating', fx.smoke > 0, fx.smoke);
  check('tyre dirt while accelerating', fx.dirt > 0, fx.dirt);
  await page.waitForTimeout(900);
  const gear = await page.evaluate(() => car.engine.gear);
  check('gearbox shifts up while accelerating', gear >= 2, 'gear ' + gear);
  check('gear shown in the HUD', (await page.textContent('#gear')) === String(gear));
  await page.keyboard.up('ArrowUp');
  const x1 = await page.evaluate(() => car.chassis.position.x);
  check('car drives forward', x1 - x0 > 20, Math.round(x1 - x0) + ' px');
  // Rolling over the gentle start area (and the seams between ground pieces) must stay silent.
  // Further out the hills get steep enough to hop the car, so this is checked near the start.
  const rolling = await page.evaluate(() => window.__sounds.length);
  check('no impact sounds while driving on the ground', rolling === 0, rolling);
  check('particle count stays capped', await page.evaluate(() => particles.length <= MAX_PARTICLES));

  const shown = parseInt(await page.textContent('#dist'), 10);
  check('distance shown in meters', shown > 5, shown + ' m');

  // Down arrow brakes, then engages reverse and backs up.
  await page.keyboard.down('ArrowDown');
  await page.waitForTimeout(2500);
  const rev = await page.evaluate(() => ({ gear: car.engine.gear, speed: car.speed }));
  await page.keyboard.up('ArrowDown');
  check('down arrow reverses', rev.gear === -1 && rev.speed < -0.3, 'gear ' + rev.gear + ', speed ' + rev.speed.toFixed(1));
  check('reverse shown as R', (await page.textContent('#gear')) === 'R');

  // The C key toggles camera follow (on by default) and shows it in the help text.
  await page.keyboard.press('KeyC');
  check('centering status shown', (await page.textContent('#info')).includes('centering OFF'));
  await page.keyboard.press('KeyC');
  check('centering back on', (await page.textContent('#info')).includes('centering ON'));

  await page.screenshot({ path: path.join(SHOT_DIR, 'simulation-test.png') });

  // Terrain streams with the car: jump 640 m ahead (past the 600 m pond) and keep driving on solid ground.
  await page.evaluate(() => {
    var x = START_X + 640 * PX_PER_M;
    World.remove(world, car.all);
    updateTerrain(x);
    createCar(x);
  });
  await page.waitForTimeout(300);
  await page.keyboard.down('ArrowUp');
  await page.waitForTimeout(1500);
  await page.keyboard.up('ArrowUp');
  const far = await page.evaluate(() => ({
    above: groundHeightAt(car.chassis.position.x) - car.chassis.position.y,
    chunks: terrainChunks.size,
    startUnloaded: !terrainChunks.has(0),
    dist: parseInt(document.getElementById('dist').textContent, 10)
  }));
  check('car stays on streamed ground far away', far.above > 0 && far.above < 300, Math.round(far.above) + ' px');
  check('only nearby terrain is loaded', far.chunks <= 7 && far.startUnloaded, far.chunks + ' chunks');
  check('distance counts from the start', far.dist >= 600, far.dist + ' m');

  // Dropping the car from a height lands with a thump.
  await page.evaluate(() => {
    window.__sounds.length = 0;
    car.all.slice(0, 3).forEach((b) => {
      Matter.Body.translate(b, { x: 0, y: -350 });
      Matter.Body.setVelocity(b, { x: 0, y: 0 });
    });
  });
  await page.waitForTimeout(1500);
  const thumps = await soundCount('thump');
  check('landing from a height thumps', thumps >= 1, thumps);

  // Jump ramps: at speed, the ramp before the 700 m marker launches the car into the air.
  await page.evaluate(() => {
    var x = jumpLipX(7) - 2400;
    World.remove(world, car.all);
    updateTerrain(x);
    createCar(x);
    car.engine.gear = 4;
    car.all.slice(0, 3).forEach((b) => Matter.Body.setVelocity(b, { x: 20, y: 0 }));
    car.wheels.forEach((w) => Matter.Body.setAngularVelocity(w, 20 / car.wheelR));
    window.__sounds.length = 0;
  });
  await page.keyboard.down('ArrowUp');
  const airborne = await page.waitForFunction(() => car.wheels.every((w) =>
    groundHeightAt(w.position.x) - (w.position.y + car.wheelR) > 25), null, { timeout: 5000, polling: 'raf' })
    .then(() => true, () => false);
  await page.keyboard.up('ArrowUp');
  check('jump ramp launches the car', airborne);
  await page.waitForTimeout(2500);
  const landed = await soundCount('thump');
  check('landing after the jump thumps', landed >= 1, landed);

  // Ponds: one after every third jump (300 m, 600 m, ...) and none elsewhere.
  const ponds = await page.evaluate(() => [1, 2, 3, 4, 5, 6, 9].map((m) => !!jumpSpec(m).pond));
  check('a pond every 300 m', ponds.join() === 'false,false,true,false,false,true,true', ponds.join());
  // Dropped into the pond, the car splashes and sits on the bottom half under water; a box floats.
  await page.evaluate(() => {
    var p = jumpSpec(3).pond, x = (p.x0 + p.x1) / 2;
    World.remove(world, car.all);
    World.remove(world, boxes);
    boxes.length = 0;
    updateTerrain(x);
    createCar(x);
    car.all.slice(0, 3).forEach((b) => Matter.Body.translate(b, { x: 0, y: -300 }));
    addBox(x + 320, pondLevel(p) - 200);
    window.__sounds.length = 0;
  });
  // Spray drops sink back into the water quickly, so look for them right after the car hits it
  const sprayed = await page.waitForFunction(() => particles.some((p) => p.sinkAt !== null), null,
    { timeout: 1500, polling: 'raf' }).then(() => true, () => false);
  await page.waitForTimeout(2500);
  const wet = await page.evaluate(() => ({
    splashes: window.__sounds.filter((s) => s === 'splash').length,
    frac: car.chassis.wetFrac,
    gap: groundHeightAt(car.wheels[0].position.x) - (car.wheels[0].position.y + car.wheelR),
    box: boxes.length ? Math.abs(boxes[0].position.y - waterLevelAt(boxes[0].position.x)) : Infinity
  }));
  check('falling into a pond splashes', wet.splashes >= 1 && sprayed, wet.splashes + ' sounds, spray ' + sprayed);
  check('car sits on the pond bottom partly under water', wet.frac > 0.2 && wet.frac < 0.9 && Math.abs(wet.gap) < 8,
    'wet ' + wet.frac.toFixed(2) + ', gap ' + wet.gap.toFixed(1) + ' px');
  check('a box floats on the water', wet.box < 30, wet.box.toFixed(1) + ' px from the surface');
  // The car can drive up the far bank and out of the pond.
  await page.keyboard.down('ArrowUp');
  const out = await page.waitForFunction(() => car.chassis.position.x > jumpSpec(3).pond.x1 + 100, null,
    { timeout: 8000, polling: 'raf' }).then(() => true, () => false);
  await page.keyboard.up('ArrowUp');
  check('car drives out of the pond', out);

  // The brake stops a car rolling back down a hill and holds it there.
  await page.evaluate(() => {
    var best = 0, bx = 0;
    for (var x = 3000; x < 30000; x += 20) {
      if (jumpRise(x - 400) || jumpRise(x + 400) || jumpRise(x)) continue;
      if (pondAt(x - 400) || pondAt(x + 400) || pondAt(x)) continue;
      var sl = (groundHeightAt(x - 150) - groundHeightAt(x + 150)) / 300;  // Rising to the right
      if (sl > best) { best = sl; bx = x; }
    }
    World.remove(world, car.all);
    updateTerrain(bx);
    createCar(bx);
  });
  await page.waitForTimeout(1200);
  const rollBack = await page.evaluate(() => car.speed);
  await page.keyboard.down('Space');
  await page.waitForTimeout(2000);
  const heldX = await page.evaluate(() => car.chassis.position.x);
  await page.waitForTimeout(1000);
  const hold = await page.evaluate((x) => ({ creep: car.chassis.position.x - x, speed: car.speed }), heldX);
  await page.keyboard.up('Space');
  check('car rolls back on a hill without brakes', rollBack < -0.3, rollBack.toFixed(2));
  check('brake holds the car on the hill', Math.abs(hold.creep) < 5 && Math.abs(hold.speed) < 0.1,
    'creep ' + hold.creep.toFixed(1) + ' px');

  // R puts a flipped car back on its wheels.
  await page.evaluate(() => {
    [car.chassis].concat(car.wheels).forEach((b) => Matter.Body.rotate(b, Math.PI, car.chassis.position));
  });
  await page.keyboard.press('KeyR');
  await page.waitForTimeout(500);
  check('R resets the car upright', await page.evaluate(() => Math.abs(car.chassis.angle) < 0.3),
    await page.evaluate(() => car.chassis.angle.toFixed(2)));

  // The renderer follows the window size.
  await page.setViewportSize({ width: 900, height: 600 });
  await page.waitForTimeout(300);
  const scr = await page.evaluate(() => [app.renderer.screen.width, app.renderer.screen.height]);
  check('renderer resizes with the window', scr[0] === 900 && scr[1] === 600, scr.join('x'));

  // Desktop has no on-screen pedals.
  check('no pedals on desktop', !(await page.locator('#btnGas').isVisible()));

  // Phone in landscape: pedals show instead of the keyboard help, GAS drives, BRAKE reverses, a tap spawns a box.
  const phone = await browser.newContext({ viewport: { width: 844, height: 390 }, isMobile: true, hasTouch: true });
  const mob = await phone.newPage();
  mob.on('console', (msg) => { if (msg.type() === 'error') errors.push(msg.text()); });
  mob.on('pageerror', (err) => errors.push(err.message));
  await mob.goto(PAGE_URL, { waitUntil: 'networkidle' });
  await mob.waitForFunction(() => typeof engine !== 'undefined' && engine && car);
  await mob.waitForTimeout(600);
  const ui = await mob.evaluate(() => ({ gas: !!document.querySelector('#btnGas').offsetParent,
    brake: !!document.querySelector('#btnBrake').offsetParent, info: !!document.querySelector('#info').offsetParent,
    zoom: zoom }));
  check('pedals shown on a phone', ui.gas && ui.brake && !ui.info, JSON.stringify(ui));
  check('phone view zooms out', ui.zoom < 0.8, ui.zoom.toFixed(2));
  // Hold a pedal with a real touch (Chrome DevTools Protocol), as a finger would
  const cdp = await phone.newCDPSession(mob);
  const pedal = async (id, type) => {
    const b = await mob.locator(id).boundingBox();
    const pt = { x: b.x + b.width / 2, y: b.y + b.height / 2, id: 1 };
    await cdp.send('Input.dispatchTouchEvent', type === 'pointerdown'
      ? { type: 'touchStart', touchPoints: [pt] } : { type: 'touchEnd', touchPoints: [] });
  };
  const mx0 = await mob.evaluate(() => car.chassis.position.x);
  await pedal('#btnGas', 'pointerdown');
  await mob.waitForTimeout(1200);
  const held = await mob.evaluate(() => input.accel && document.querySelector('#btnGas').classList.contains('down'));
  await pedal('#btnGas', 'pointerup');
  const mx1 = await mob.evaluate(() => car.chassis.position.x);
  check('GAS pedal drives the car', held && mx1 - mx0 > 100, Math.round(mx1 - mx0) + ' px');
  check('GAS released on lift', await mob.evaluate(() => !input.accel));
  await pedal('#btnBrake', 'pointerdown');
  await mob.waitForTimeout(2500);
  const mrev = await mob.evaluate(() => ({ gear: car.engine.gear, speed: car.speed }));
  await pedal('#btnBrake', 'pointerup');
  check('BRAKE pedal brakes, then reverses', mrev.gear === -1 && mrev.speed < -0.3,
    'gear ' + mrev.gear + ', speed ' + mrev.speed.toFixed(1));
  await mob.touchscreen.tap(600, 80);
  check('a tap does not drop a box', await mob.evaluate(() => boxes.length) === 0,
    await mob.evaluate(() => boxes.length));
  await mob.screenshot({ path: path.join(SHOT_DIR, 'simulation-mobile.png') });
  await phone.close();

  check('no console errors', errors.length === 0, errors.join(' | ') || undefined);

  await browser.close();
  console.log(failures.length ? '\n' + failures.length + ' check(s) failed' : '\nAll checks passed');
  process.exit(failures.length ? 1 : 0);
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
