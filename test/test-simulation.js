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

  // Count collision sounds by wrapping the global the collision handler calls.
  await page.evaluate(() => {
    window.__collisionSounds = 0;
    var orig = playCollisionSound;
    playCollisionSound = function () { window.__collisionSounds++; orig.apply(this, arguments); };
  });

  // Spawn five boxes away from the car.
  for (let i = 0; i < 5; i++) {
    await page.mouse.click(150 + i * 90, 120);
  }
  check('five boxes spawned', await page.evaluate(() => boxes.length) === 5,
    await page.evaluate(() => boxes.length));
  check('counter shows five', (await page.textContent('#count')) === 'Boxes: 5');

  // Let the boxes fall and hit the ground.
  await page.waitForTimeout(1500);
  check('collision sound played', await page.evaluate(() => window.__collisionSounds) > 0,
    await page.evaluate(() => window.__collisionSounds));

  // The car has a cabin that boxes can land on.
  check('car has a cabin', await page.evaluate(() => car.chassis.parts.length) === 3);
  const drop = await page.evaluate(() => {
    var cab = car.chassis.parts[2];
    return worldToScreen(cab.position.x, cab.bounds.min.y - 80);
  });
  await page.mouse.click(drop.x, drop.y);
  await page.waitForTimeout(1000);
  const onRoof = await page.evaluate(() => {
    var b = boxes[boxes.length - 1], cab = car.chassis.parts[2];
    return b.bounds.max.y <= cab.bounds.min.y + 5 && b.position.x > cab.bounds.min.x && b.position.x < cab.bounds.max.x;
  });
  check('box lands on the cabin roof', onRoof);

  // Shift+click on a resting box removes it.
  const before = await page.evaluate(() => boxes.length);
  const target = await page.evaluate(() => worldToScreen(boxes[0].position.x, boxes[0].position.y));
  await page.keyboard.down('Shift');
  await page.mouse.click(target.x, target.y);
  await page.keyboard.up('Shift');
  check('shift+click removes a box', await page.evaluate(() => boxes.length) === before - 1,
    await page.evaluate(() => boxes.length));

  // Drive right with the up arrow.
  await page.locator('canvas').focus();
  const x0 = await page.evaluate(() => car.chassis.position.x);
  await page.keyboard.down('ArrowUp');
  await page.waitForTimeout(400);
  // Throttle makes exhaust smoke (back layer) and the tyres throw dirt (front layer).
  const fx = await page.evaluate(() => ({
    smoke: particles.filter((p) => p.layer === 'back').length,
    dirt: particles.filter((p) => p.layer === 'front').length,
    max: MAX_PARTICLES
  }));
  check('exhaust smoke while accelerating', fx.smoke > 0, fx.smoke);
  check('tyre dirt while accelerating', fx.dirt > 0, fx.dirt);
  await page.waitForTimeout(600);
  await page.keyboard.up('ArrowUp');
  const x1 = await page.evaluate(() => car.chassis.position.x);
  check('car drives forward', x1 - x0 > 20, Math.round(x1 - x0) + ' px');
  check('particle count stays capped', await page.evaluate(() => particles.length <= MAX_PARTICLES));

  // The C key toggles camera centering and shows it in the help text.
  await page.keyboard.press('KeyC');
  check('centering status shown', (await page.textContent('#info')).includes('centering ON'));
  await page.keyboard.press('KeyC');

  await page.screenshot({ path: path.join(SHOT_DIR, 'simulation-test.png') });

  // Walls follow the window size.
  await page.setViewportSize({ width: 1600, height: 900 });
  await page.waitForTimeout(300);
  const ground = await page.evaluate(() => ({ top: walls[0].bounds.min.y, right: walls[2].bounds.min.x }));
  check('ground moves on resize', ground.top === 900, ground.top);
  check('right wall moves on resize', ground.right === 1600, ground.right);

  // Shrinking the window keeps the car and boxes inside the new walls.
  await page.keyboard.down('ArrowUp');
  await page.waitForTimeout(800);
  await page.keyboard.up('ArrowUp');
  await page.setViewportSize({ width: 700, height: 500 });
  await page.waitForTimeout(1000);
  const inside = await page.evaluate(() => {
    var ok = function (b) { return b.position.x > 0 && b.position.x < W && b.position.y < H; };
    return ok(car.chassis) && boxes.every(ok);
  });
  check('bodies stay inside after shrinking', inside);

  check('no console errors', errors.length === 0, errors.join(' | ') || undefined);

  await browser.close();
  console.log(failures.length ? '\n' + failures.length + ' check(s) failed' : '\nAll checks passed');
  process.exit(failures.length ? 1 : 0);
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
