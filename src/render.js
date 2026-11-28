// PixiJS (WebGL) renderer. Every Matter.js body is mirrored by a Pixi display object whose shape
// is built once in body-local coordinates; each frame only positions and rotations are updated.
// The whole world sits in one container, so pan and zoom are just that container's transform.

var app = null;   // PIXI.Application
var scene = {};   // Layers and display objects, filled by initRenderer

// '#rrggbb' -> 0xrrggbb
function hexColor(hex) {
  return parseInt(hex.slice(1), 16);
}

// Vertices of `verts` in the local frame of `body` (undo its position and rotation)
function toLocal(body, verts) {
  var c = Math.cos(-body.angle), s = Math.sin(-body.angle);
  return verts.map(function (v) {
    var dx = v.x - body.position.x, dy = v.y - body.position.y;
    return { x: dx * c - dy * s, y: dx * s + dy * c };
  });
}

// Texture from a small canvas painted by `paint(ctx2d, w, h)`
function canvasTexture(w, h, paint) {
  var c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  paint(c.getContext('2d'), w, h);
  return PIXI.Texture.from(c);
}

// Create the Pixi app on the page canvas and build the static parts of the scene
async function initRenderer() {
  app = new PIXI.Application();
  await app.init({
    canvas: canvas,
    width: W,
    height: H,
    background: '#1a1a2e',
    antialias: true,
    resolution: window.devicePixelRatio || 1,
    autoDensity: true,
    autoStart: false   // The main loop renders each frame itself
  });

  // White soft dot (tinted per particle) and a vertical glass gradient for the windows
  scene.softTex = canvasTexture(64, 64, function (g) {
    var grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    grad.addColorStop(0, 'rgba(255,255,255,1)');
    grad.addColorStop(0.4, 'rgba(255,255,255,0.6)');
    grad.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = grad;
    g.fillRect(0, 0, 64, 64);
  });
  scene.glassTex = canvasTexture(4, 64, function (g, w, h) {
    var grad = g.createLinearGradient(0, 0, 0, h);
    grad.addColorStop(0, '#cdeef8');
    grad.addColorStop(1, '#6fa9c0');
    g.fillStyle = grad;
    g.fillRect(0, 0, w, h);
  });

  scene.grid = new PIXI.Graphics();
  scene.world = new PIXI.Container();
  scene.walls = new PIXI.Graphics();
  scene.boxes = new PIXI.Container();
  scene.back = new PIXI.Container();    // Particles behind the car (smoke)
  scene.carLayer = new PIXI.Container();
  scene.front = new PIXI.Container();   // Particles in front of the car (dust, mud)
  scene.world.addChild(scene.walls, scene.boxes, scene.back, scene.carLayer, scene.front);
  app.stage.addChild(scene.grid, scene.world);

  scene.wallsFor = null;      // The walls array the wall graphics were built from
  scene.boxGfx = new Map();   // Box body -> Graphics
  scene.pool = { back: [], front: [] };
  scene.car = null;
}

// Match the renderer to the window size
function resizeRenderer() {
  if (app) app.renderer.resize(W, H);
}

// Background grid in screen space (follows pan and zoom)
function drawGrid() {
  var g = scene.grid;
  g.clear();
  var gridSize = 50 * zoom;
  if (gridSize < 10) return;
  var startX = ((panOffset.x % gridSize) + gridSize) % gridSize;
  var startY = ((panOffset.y % gridSize) + gridSize) % gridSize;
  for (var x = startX; x < W; x += gridSize) g.moveTo(x, 0).lineTo(x, H);
  for (var y = startY; y < H; y += gridSize) g.moveTo(0, y).lineTo(W, y);
  g.stroke({ width: 1, color: 0xffffff, alpha: 0.06 });
}

// Walls are static: rebuild their graphics only when the walls are recreated (resize)
function syncWalls() {
  if (scene.wallsFor === walls) return;
  scene.wallsFor = walls;
  var g = scene.walls;
  g.clear();
  walls.forEach(function (b) {
    g.poly(b.vertices).fill(hexColor(b.renderColor || '#3a4358'))
      .stroke({ width: 2, color: 0xffffff, alpha: 0.35 });
  });
}

// One Graphics per box, built from its real vertices the first time it is seen
function syncBoxes() {
  var seen = new Set();
  for (var i = 0; i < boxes.length; i++) {
    var b = boxes[i];
    var g = scene.boxGfx.get(b);
    if (!g) {
      var pts = toLocal(b, b.vertices);
      g = new PIXI.Graphics();
      g.poly(pts).fill(hexColor(b.renderColor || '#aaaaaa'))
        .stroke({ width: 1.5, color: 0xffffff, alpha: 0.4 });
      scene.boxes.addChild(g);
      scene.boxGfx.set(b, g);
    }
    g.position.set(b.position.x, b.position.y);
    g.rotation = b.angle;
    seen.add(b);
  }
  // Drop graphics of removed boxes
  scene.boxGfx.forEach(function (g, b) {
    if (!seen.has(b)) {
      g.destroy();
      scene.boxGfx.delete(b);
    }
  });
}

// One side window: gradient glass and a reflection streak, clipped to the window shape, plus a frame
function buildWindow(pts) {
  var minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  pts.forEach(function (p) {
    minX = Math.min(minX, p.x); maxX = Math.max(maxX, p.x);
    minY = Math.min(minY, p.y); maxY = Math.max(maxY, p.y);
  });
  var win = new PIXI.Container();
  var glass = new PIXI.Sprite(scene.glassTex);
  glass.position.set(minX, minY);
  glass.width = maxX - minX;
  glass.height = maxY - minY;
  var streak = new PIXI.Graphics()
    .moveTo(pts[1].x + 10, pts[1].y).lineTo(pts[1].x - 4, pts[0].y)
    .stroke({ width: 7, color: 0xffffff, alpha: 0.45 });
  var mask = new PIXI.Graphics().poly(pts).fill(0xffffff);
  win.addChild(glass, streak, mask);
  win.mask = mask;
  var frame = new PIXI.Graphics().poly(pts).stroke({ width: 2.5, color: 0x2b2b2b, join: 'round' });
  var group = new PIXI.Container();
  group.addChild(win, frame);
  return group;
}

// A wheel in its own frame: tyre, five spokes, hub
function buildWheel(r) {
  var g = new PIXI.Graphics();
  g.circle(0, 0, r).fill(0x222222).stroke({ width: 1.5, color: 0xffffff, alpha: 0.35 });
  for (var i = 0; i < 5; i++) {
    var a = (i / 5) * Math.PI * 2;
    g.moveTo(0, 0).lineTo(Math.cos(a) * r * 0.8, Math.sin(a) * r * 0.8);
  }
  g.stroke({ width: r * 0.08, color: 0xaaaaaa });
  g.circle(0, 0, r * 0.2).fill(0x888888);
  return g;
}

// Car body in chassis-local coordinates. Draw order: cabin, windows, tailpipe, then the base,
// which covers the cabin seam and the inner end of the pipe.
function buildCar() {
  var ch = car.chassis;
  var color = hexColor(car.color);
  var body = new PIXI.Container();
  var cabin = new PIXI.Graphics().poly(toLocal(ch, ch.parts[2].vertices)).fill(color)
    .stroke({ width: 2, color: 0x222222 });
  body.addChild(cabin);
  car.windows.forEach(function (pts) { body.addChild(buildWindow(pts)); });
  body.addChild(new PIXI.Graphics()
    .moveTo(car.exhaust.x + 14, car.exhaust.y).lineTo(car.exhaust.x - 22, car.exhaust.y)
    .stroke({ width: 6, color: 0x3a3a3a, cap: 'round' }));
  body.addChild(new PIXI.Graphics().poly(toLocal(ch, ch.parts[1].vertices)).fill(color)
    .stroke({ width: 2, color: 0x222222 }));
  var wheels = car.wheels.map(function () { return buildWheel(car.wheelR); });
  scene.carLayer.addChild(body);
  wheels.forEach(function (w) { scene.carLayer.addChild(w); });
  scene.car = { forCar: car, body: body, wheels: wheels };
}

function syncCar() {
  if (!car) return;
  if (!scene.car || scene.car.forCar !== car) {
    scene.carLayer.removeChildren().forEach(function (c) { c.destroy({ children: true }); });
    buildCar();
  }
  scene.car.body.position.set(car.chassis.position.x, car.chassis.position.y);
  scene.car.body.rotation = car.chassis.angle;
  car.wheels.forEach(function (wl, i) {
    scene.car.wheels[i].position.set(wl.position.x, wl.position.y);
    scene.car.wheels[i].rotation = wl.angle;
  });
}

// Particles reuse a pool of tinted sprites per layer; unused sprites are hidden
function syncParticles() {
  var used = { back: 0, front: 0 };
  for (var i = 0; i < particles.length; i++) {
    var p = particles[i];
    var t = p.age / p.life;
    // Fade in over the first 60 ms, fade out over the whole life
    var a = p.alpha * (1 - t) * Math.min(1, p.age / 60);
    if (a <= 0.01) continue;
    var pool = scene.pool[p.layer];
    var s = pool[used[p.layer]];
    if (!s) {
      s = new PIXI.Sprite(PIXI.Texture.WHITE);
      s.anchor.set(0.5);
      pool.push(s);
      scene[p.layer].addChild(s);
    }
    used[p.layer]++;
    s.texture = p.soft ? scene.softTex : PIXI.Texture.WHITE;
    s.visible = true;
    s.position.set(p.x, p.y);
    s.width = s.height = p.size * 2;
    if (p.tint === undefined) p.tint = hexColor(p.color);
    s.tint = p.tint;
    s.alpha = a;
  }
  ['back', 'front'].forEach(function (layer) {
    var pool = scene.pool[layer];
    for (var j = used[layer]; j < pool.length; j++) pool[j].visible = false;
  });
}

// Draw one frame
function draw() {
  if (!app || !isFinite(zoom) || zoom <= 0) return;
  drawGrid();
  scene.world.position.set(panOffset.x, panOffset.y);
  scene.world.scale.set(zoom);
  syncWalls();
  syncBoxes();
  syncCar();
  syncParticles();
  app.render();
}
